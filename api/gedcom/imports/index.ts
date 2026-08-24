import { randomUUID } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireEditAccess } from '../../_lib/auth.js'
import { putPrivateMedia, deletePrivateMedia } from '../../_lib/blob.js'
import { getSql, requireAtlasId } from '../../_lib/db.js'
import { allowCors, handleOptions, sendError } from '../../_lib/http.js'
import { sha256Hex } from '../../../src/gedcom/import/checksum.js'
import { MAX_GEDCOM_BYTES } from '../../../src/gedcom/import/constants.js'
import { gedcomImportPathnames } from '../../../src/gedcom/import/importPaths.js'
import { toInspectableImport, updatedPersonCountFromDiff } from '../../../src/gedcom/import/inspectImport.js'
import { processCandidateGedcom } from '../../../src/gedcom/import/processCandidate.js'
import { currentFamilyGraph } from '../../../src/gedcom/graphFromCurrent.js'
import { familyDatabase } from '../../../src/data/familyDatabase.js'

type ImportRow = {
  id: string
  atlas_id: string
  original_filename: string
  checksum: string
  byte_size: number
  gedcom_pathname: string
  snapshot_pathname: string | null
  status: 'uploaded' | 'processing' | 'ready' | 'failed'
  person_count: number | null
  family_count: number | null
  error_code: string | null
  error_message: string | null
  diff_summary: unknown
  reconciliation_summary: unknown
  blockers: unknown
  diff_json: unknown
  reconciliation_json: unknown
  created_at: string
  processed_at: string | null
}

function inspectRow(row: ImportRow) {
  const payload = {
    id: row.id,
    atlasId: row.atlas_id,
    originalFilename: row.original_filename,
    checksum: row.checksum,
    byteSize: row.byte_size,
    status: row.status,
    personCount: row.person_count,
    familyCount: row.family_count,
    createdAt: row.created_at,
    processedAt: row.processed_at,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    diffSummary: row.diff_summary,
    reconciliationSummary: row.reconciliation_summary,
    blockers: row.blockers,
    identity: (row.reconciliation_json as { identity?: unknown } | null)?.identity,
    diffDetails: row.diff_json,
    updatedPersonCount: updatedPersonCountFromDiff(row.diff_json),
    gedcomPath: row.gedcom_pathname,
    snapshotPath: row.snapshot_pathname,
  }
  return toInspectableImport(payload)
}

function stringField(body: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = body[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function decodeUpload(body: Record<string, unknown>): { filename: string; bytes: Uint8Array } | null {
  const filename = stringField(body, 'filename', 'fileName')
  const dataBase64 = stringField(body, 'dataBase64', 'data_base64')
  if (!filename || !dataBase64) return null
  const buffer = Buffer.from(dataBase64, 'base64')
  return { filename: filename.slice(0, 255), bytes: new Uint8Array(buffer) }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  allowCors(res)
  if (handleOptions(req, res)) return
  if (!requireEditAccess(req, res)) return

  try {
    const sql = getSql()
    const atlasId = requireAtlasId()

    if (req.method === 'GET') {
      const id = typeof req.query.id === 'string' ? req.query.id : ''
      if (id) {
        const rows = await sql`
          SELECT * FROM gedcom_imports
          WHERE id = ${id} AND atlas_id = ${atlasId}
          LIMIT 1
        `
        if (!rows.length) {
          sendError(res, 404, 'Import not found')
          return
        }
        res.status(200).json({ import: inspectRow(rows[0] as ImportRow) })
        return
      }
      const rows = await sql`
        SELECT * FROM gedcom_imports
        WHERE atlas_id = ${atlasId}
        ORDER BY created_at DESC
        LIMIT 50
      `
      res.status(200).json({ imports: (rows as ImportRow[]).map(inspectRow) })
      return
    }

    if (req.method === 'DELETE') {
      const id = typeof req.query.id === 'string' ? req.query.id : ''
      if (!id) {
        sendError(res, 400, 'id is required')
        return
      }
      const rows = await sql`
        SELECT gedcom_pathname, snapshot_pathname
        FROM gedcom_imports
        WHERE id = ${id} AND atlas_id = ${atlasId}
        LIMIT 1
      `
      if (!rows.length) {
        sendError(res, 404, 'Import not found')
        return
      }
      const row = rows[0] as { gedcom_pathname: string; snapshot_pathname: string | null }
      try {
        await deletePrivateMedia(row.gedcom_pathname)
      } catch {
        /* candidate is disposable even if blob delete fails */
      }
      if (row.snapshot_pathname) {
        try {
          await deletePrivateMedia(row.snapshot_pathname)
        } catch {
          /* ignore */
        }
      }
      await sql`DELETE FROM gedcom_imports WHERE id = ${id} AND atlas_id = ${atlasId}`
      res.status(200).json({ ok: true })
      return
    }

    if (req.method !== 'POST') {
      sendError(res, 405, 'Method not allowed')
      return
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
    const upload = decodeUpload(body as Record<string, unknown>)
    if (!upload) {
      sendError(res, 400, 'filename and dataBase64 are required')
      return
    }
    if (upload.bytes.byteLength > MAX_GEDCOM_BYTES) {
      sendError(res, 400, 'File is too large.')
      return
    }

    const checksum = await sha256Hex(upload.bytes)
    const duplicates = await sql`
      SELECT id FROM gedcom_imports
      WHERE atlas_id = ${atlasId}
        AND checksum = ${checksum}
        AND status IN ('uploaded', 'processing', 'ready')
      LIMIT 1
    `
    if (duplicates.length) {
      res.status(409).json({
        error: 'This file was already uploaded.',
        importId: (duplicates[0] as { id: string }).id,
      })
      return
    }

    const importId = randomUUID()
    const paths = gedcomImportPathnames(atlasId, importId)
    await sql`
      INSERT INTO gedcom_imports (
        id, atlas_id, original_filename, checksum, byte_size, gedcom_pathname, status
      ) VALUES (
        ${importId}, ${atlasId}, ${upload.filename}, ${checksum}, ${upload.bytes.byteLength},
        ${paths.gedcomPath}, 'uploaded'
      )
    `

    try {
      await putPrivateMedia(paths.gedcomPath, Buffer.from(upload.bytes), 'text/plain; charset=utf-8')
      await sql`
        UPDATE gedcom_imports
        SET status = 'processing'
        WHERE id = ${importId} AND atlas_id = ${atlasId}
      `

      const current = currentFamilyGraph()
      const mediaRows = await sql`
        SELECT id, person_id FROM media_assets WHERE atlas_id = ${atlasId}
      `
      const overrideRows = await sql`
        SELECT id, entity_type, entity_key, source_signature, override_type
        FROM atlas_overrides
        WHERE atlas_id = ${atlasId} AND status = 'active'
      `

      const result = processCandidateGedcom({
        bytes: upload.bytes,
        current,
        currentRootId: familyDatabase.root,
        media: (mediaRows as Array<{ id: string; person_id: string }>).map((row) => ({
          kind: 'media' as const,
          id: row.id,
          personId: row.person_id,
          label: 'Portrait',
        })),
        placeOverrides: (
          overrideRows as Array<{
            id: string
            entity_type: string
            entity_key: string
            source_signature: string | null
            override_type: string
          }>
        )
          .filter((row) => row.entity_type === 'place')
          .map((row) => ({
            kind: 'place_override' as const,
            id: row.id,
            entityKey: row.entity_key,
            sourceSignature: row.source_signature ?? '',
            label: row.override_type,
          })),
        eventOverrides: (
          overrideRows as Array<{
            id: string
            entity_type: string
            entity_key: string
            source_signature: string | null
            override_type: string
          }>
        )
          .filter((row) => row.entity_type === 'event')
          .map((row) => ({
            kind: 'event_override' as const,
            id: row.id,
            entityKey: row.entity_key,
            sourceSignature: row.source_signature ?? '',
            label: row.override_type,
          })),
      })

      if (result.status === 'failed') {
        await sql`
          UPDATE gedcom_imports
          SET status = 'failed',
              error_code = ${result.errorCode},
              error_message = ${result.errorMessage},
              processed_at = now()
          WHERE id = ${importId} AND atlas_id = ${atlasId}
        `
      } else {
        await putPrivateMedia(
          paths.snapshotPath,
          Buffer.from(JSON.stringify(result.snapshot), 'utf8'),
          'application/json',
        )
        await sql`
          UPDATE gedcom_imports
          SET status = 'ready',
              snapshot_pathname = ${paths.snapshotPath},
              person_count = ${result.personCount},
              family_count = ${result.familyCount},
              diff_summary = ${JSON.stringify(result.diff.summary)}::jsonb,
              reconciliation_summary = ${JSON.stringify(result.reconciliationSummary)}::jsonb,
              blockers = ${JSON.stringify(result.blockers)}::jsonb,
              diff_json = ${JSON.stringify(result.compactDiff)}::jsonb,
              reconciliation_json = ${JSON.stringify(result.compactReconciliation)}::jsonb,
              processed_at = now()
          WHERE id = ${importId} AND atlas_id = ${atlasId}
        `
      }
    } catch (error) {
      await sql`
        UPDATE gedcom_imports
        SET status = 'failed',
            error_code = 'process_failed',
            error_message = ${error instanceof Error ? error.message : 'Processing failed'},
            processed_at = now()
        WHERE id = ${importId} AND atlas_id = ${atlasId}
      `
    }

    const saved = await sql`
      SELECT * FROM gedcom_imports WHERE id = ${importId} AND atlas_id = ${atlasId} LIMIT 1
    `
    res.status(200).json({ import: inspectRow(saved[0] as ImportRow) })
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : 'GEDCOM import error')
  }
}
