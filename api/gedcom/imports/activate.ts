import { randomUUID } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireEditAccess } from '../../_lib/auth.js'
import { putPrivateMedia, readPrivateMedia } from '../../_lib/blob.js'
import { getSql, requireAtlasId } from '../../_lib/db.js'
import { allowCors, handleOptions, sendError } from '../../_lib/http.js'
import { collectStaticAtlasAttachments } from '../../../src/gedcom/attachments.js'
import { classifyIdentityTiers } from '../../../src/gedcom/classifyIdentity.js'
import { diffFamilyGraphs } from '../../../src/gedcom/diffFamilyGraphs.js'
import { currentFamilyGraph, familyGraphFromDatabase } from '../../../src/gedcom/graphFromCurrent.js'
import { planGedcomReconciliation } from '../../../src/gedcom/planGedcomReconciliation.js'
import { planGedcomActivation } from '../../../src/gedcom/activate/planActivation.js'
import { rewriteSnapshotToAtlasIds } from '../../../src/gedcom/activate/rewriteSnapshot.js'
import { gedcomImportPathnames } from '../../../src/gedcom/import/importPaths.js'
import type { FamilySnapshot } from '../../../src/gedcom/import/snapshotFromGraph.js'
import { familyDatabase } from '../../../src/data/familyDatabase.js'
import { familyMarriages } from '../../../src/data/familyMarriages.js'

async function readSnapshot(pathname: string): Promise<FamilySnapshot> {
  const blob = await readPrivateMedia({ blobUrl: pathname, blobPathname: pathname })
  return JSON.parse(Buffer.from(blob.body).toString('utf8')) as FamilySnapshot
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  allowCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') {
    sendError(res, 405, 'Method not allowed')
    return
  }
  if (!requireEditAccess(req, res)) return

  try {
    if (process.env.ATLAS_ALLOW_LIVE_ACTIVATE !== '1') {
      res.status(409).json({
        error: 'Live Atlas update is paused.',
        livePaused: true,
      })
      return
    }

    const sql = getSql()
    const atlasId = requireAtlasId()
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
    const importId = typeof body.importId === 'string' ? body.importId.trim() : ''
    if (!importId) {
      sendError(res, 400, 'importId is required')
      return
    }

    const imports = await sql`
      SELECT id, atlas_id, status, snapshot_pathname
      FROM gedcom_imports
      WHERE id = ${importId} AND atlas_id = ${atlasId}
      LIMIT 1
    `
    if (!imports.length) {
      sendError(res, 404, 'Import not found')
      return
    }
    const candidateRow = imports[0] as {
      id: string
      atlas_id: string
      status: string
      snapshot_pathname: string | null
    }
    if (candidateRow.status !== 'ready' || !candidateRow.snapshot_pathname) {
      sendError(res, 409, 'Only a ready candidate with a snapshot can be activated')
      return
    }

    const atlasRows = await sql`
      SELECT active_import_id FROM atlases WHERE id = ${atlasId} LIMIT 1
    `
    const previousImportId =
      (atlasRows[0] as { active_import_id: string | null } | undefined)?.active_import_id ?? null

    let current = currentFamilyGraph()
    let currentRootId = familyDatabase.root
    if (previousImportId) {
      const prevRows = await sql`
        SELECT activated_snapshot_pathname, snapshot_pathname
        FROM gedcom_imports
        WHERE id = ${previousImportId} AND atlas_id = ${atlasId}
        LIMIT 1
      `
      const prev = prevRows[0] as
        | { activated_snapshot_pathname: string | null; snapshot_pathname: string | null }
        | undefined
      const prevPath = prev?.activated_snapshot_pathname || prev?.snapshot_pathname
      if (prevPath) {
        const prevSnapshot = await readSnapshot(prevPath)
        current = familyGraphFromDatabase(prevSnapshot, prevSnapshot.marriages ?? familyMarriages)
        const rootPerson = prevSnapshot.people.find((person) => person.id === prevSnapshot.root)
        currentRootId = rootPerson?.sourcePersonId || prevSnapshot.root
      }
    }

    const candidateSnapshot = await readSnapshot(candidateRow.snapshot_pathname)
    const candidate = familyGraphFromDatabase(candidateSnapshot, candidateSnapshot.marriages ?? [])

    const peopleRows = await sql`
      SELECT id, atlas_id, status, display_name, birth_year, death_year, current_source_person_id
      FROM atlas_people WHERE atlas_id = ${atlasId}
    `
    const aliasRows = await sql`
      SELECT id, atlas_person_id, atlas_id, import_id, source_type, source_person_id, match_kind
      FROM atlas_person_aliases WHERE atlas_id = ${atlasId}
    `
    const eventRows = await sql`
      SELECT id, entity_key FROM atlas_overrides
      WHERE atlas_id = ${atlasId} AND entity_type = 'event' AND status = 'active'
    `
    const personRows = await sql`
      SELECT id, entity_key FROM atlas_overrides
      WHERE atlas_id = ${atlasId} AND entity_type = 'person' AND status = 'active'
    `

    const diff = diffFamilyGraphs(current, candidate)
    const identity = classifyIdentityTiers(diff, current, candidate)
    const staticAttachments = collectStaticAtlasAttachments()
    const recon = planGedcomReconciliation(diff, {
      current,
      candidate,
      media: [],
      stories: staticAttachments.stories,
      documentary: staticAttachments.documentary,
      placeOverrides: [],
      eventOverrides: (eventRows as Array<{ id: string; entity_key: string }>).map((item) => ({
        kind: 'event_override' as const,
        id: item.id,
        entityKey: item.entity_key,
        sourceSignature: '',
        label: 'event override',
      })),
    })

    const plan = planGedcomActivation({
      atlasId,
      currentRootGedcomId: currentRootId,
      identity,
      plan: recon,
      existing: {
        people: (peopleRows as Array<{
          id: string
          atlas_id: string
          status: 'active' | 'source_removed' | 'needs_review'
          display_name: string | null
          birth_year: number | null
          death_year: number | null
          current_source_person_id: string | null
        }>).map((item) => ({
          id: item.id,
          atlasId: item.atlas_id,
          status: item.status,
          displayName: item.display_name ?? '',
          birthYear: item.birth_year,
          deathYear: item.death_year,
          currentSourcePersonId: item.current_source_person_id ?? '',
        })),
        aliases: (aliasRows as Array<{
          id: string
          atlas_person_id: string
          atlas_id: string
          import_id: string
          source_person_id: string
          match_kind: string
        }>).map((item) => ({
          id: item.id,
          atlasPersonId: item.atlas_person_id,
          atlasId: item.atlas_id,
          importId: item.import_id,
          sourceType: 'gedcom' as const,
          sourcePersonId: item.source_person_id,
          matchKind:
            item.match_kind === 'exact' || item.match_kind === 'strong_match'
              ? item.match_kind
              : 'seeded',
        })),
      },
      candidate,
      snapshot: candidateSnapshot,
      eventOverrides: (eventRows as Array<{ id: string; entity_key: string }>).map((item) => ({
        id: item.id,
        entityKey: item.entity_key,
      })),
      personOverrides: (personRows as Array<{ id: string; entity_key: string }>).map((item) => ({
        id: item.id,
        entityKey: item.entity_key,
      })),
      createId: () => randomUUID(),
    })

    if (plan.blocked) {
      res.status(409).json({ error: 'Activation blocked', blockers: plan.blockers })
      return
    }

    const rewritten = rewriteSnapshotToAtlasIds(
      candidateSnapshot,
      new Map(Object.entries(plan.gedcomToAtlas)),
    )
    const paths = gedcomImportPathnames(atlasId, importId)
    await putPrivateMedia(
      paths.activatedSnapshotPath,
      Buffer.from(JSON.stringify(rewritten), 'utf8'),
      'application/json',
    )

    const payload = {
      ops: plan.ops.map((op) => ({
        action: op.action,
        atlasPersonId: op.atlasPersonId,
        candidateGedcomId: op.candidateGedcomId,
        displayName: op.displayName,
        birthYear: op.birthYear,
        deathYear: op.deathYear,
        matchKind: op.matchKind,
      })),
      eventRewrites: plan.eventRewrites.map((item) => ({
        id: item.id,
        fromKey: item.fromKey,
        toKey: item.toKey,
        keep: item.keep,
      })),
      personRewrites: plan.personRewrites.map((item) => ({
        id: item.id,
        fromKey: item.fromKey,
        toKey: item.toKey,
        keep: item.keep,
      })),
      activatedSnapshotPath: paths.activatedSnapshotPath,
      rootAtlasPersonId: plan.rootAtlasPersonId,
    }

    await sql`SELECT apply_gedcom_activation(${atlasId}, ${importId}, ${JSON.stringify(payload)}::jsonb)`
    res.status(200).json({
      ok: true,
      importId,
      previousImportId,
      rootAtlasPersonId: plan.rootAtlasPersonId,
    })
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : 'Activation failed')
  }
}
