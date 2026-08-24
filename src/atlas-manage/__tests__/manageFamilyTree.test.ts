import { describe, expect, it } from 'vitest'
import { familyDatabase } from '../../data/familyDatabase'
import { familyMarriages } from '../../data/familyMarriages'
import { familyGraphFromDatabase } from '../../gedcom/graphFromCurrent'
import { familySnapshotFromGraph } from '../../gedcom/import/snapshotFromGraph'
import { generationCountFromPeople } from '../../gedcom/assignGenerations'
import { toInspectableImport } from '../../gedcom/import/inspectImport'
import type { InspectableGedcomImport } from '../../gedcom/import/inspectImport'
import { HIDDEN_TECHNICAL_TERMS } from '../forbiddenTerms'
import { canShowEditorSignIn, canShowManageEntry, manageCopy } from '../customerCopy'
import { customerPreviewFromInspect } from '../customerPreview'
import { activateGedcomImport, discardGedcomImport, uploadGedcomFile } from '../gedcomManageApi'

function inspect(partial: Partial<InspectableGedcomImport> = {}): InspectableGedcomImport {
  return {
    id: 'imp-1',
    filename: 'tree.ged',
    checksum: 'abc',
    byteSize: 12,
    status: 'ready',
    personCount: 357,
    familyCount: 89,
    createdAt: '2026-08-22T00:00:00.000Z',
    processedAt: '2026-08-22T00:00:01.000Z',
    errorCode: null,
    errorMessage: null,
    diffSummary: {
      currentPeople: 327,
      candidatePeople: 357,
      addedPeople: 32,
      removedPeople: 2,
    },
    reconciliationSummary: {
      identity: { exact: 325, strong_match: 0, ambiguous: 0, unmatched: 2 },
      media: { preserved: 10, rebound: 0, needsReview: 0, orphaned: 0 },
      stories: { preserved: 10, rebound: 0, needsReview: 0, orphaned: 0 },
      documentary: { preserved: 8, rebound: 0, needsReview: 0, orphaned: 0 },
      placeOverrides: { preserved: 16, rebound: 0, needsReview: 0, orphaned: 0 },
    },
    blockers: [],
    storage: {
      gedcomPath: 'atlases/atlas-a/gedcom-imports/imp-1/source.ged',
      snapshotPath: 'atlases/atlas-a/gedcom-imports/imp-1/snapshot.json',
    },
    ...partial,
  }
}

describe('Manage family tree', () => {
  it('shows the manage entry only after editor unlock', () => {
    expect(canShowManageEntry(false)).toBe(false)
    expect(canShowEditorSignIn(false)).toBe(true)
    expect(canShowManageEntry(true)).toBe(true)
    expect(canShowEditorSignIn(true)).toBe(false)
  })

  it('maps a ready import into customer change counts', () => {
    const preview = customerPreviewFromInspect(inspect({ updatedPersonCount: 14 }), 327)
    expect(preview.currentPeople).toBe(327)
    expect(preview.candidatePeople).toBe(357)
    expect(preview.added).toBe(32)
    expect(preview.noLongerInFile).toBe(2)
    expect(preview.updated).toBe(14)
    expect(preview.photosKept).toBe(10)
    expect(preview.storiesKept).toBe(10)
    expect(preview.filmKept).toBe(8)
    expect(preview.exactMatches).toBe(325)
    expect(preview.placesKept).toBe(true)
    expect(preview.canUpdate).toBe(true)
  })

  it('reads change counts from inspect analysis fields rather than fixed copy', () => {
    const preview = customerPreviewFromInspect(
      inspect({
        personCount: 340,
        diffSummary: {
          currentPeople: 300,
          candidatePeople: 340,
          addedPeople: 12,
          removedPeople: 1,
        },
        reconciliationSummary: {
          identity: { exact: 298, strong_match: 0, ambiguous: 0, unmatched: 2 },
          media: { preserved: 4, rebound: 1, needsReview: 0, orphaned: 0 },
          stories: { preserved: 3, rebound: 0, needsReview: 0, orphaned: 0 },
          documentary: { preserved: 2, rebound: 0, needsReview: 0, orphaned: 0 },
          placeOverrides: { preserved: 0, rebound: 0, needsReview: 0, orphaned: 0 },
        },
      }),
      300,
    )
    expect(preview.currentPeople).toBe(300)
    expect(preview.candidatePeople).toBe(340)
    expect(preview.added).toBe(12)
    expect(preview.noLongerInFile).toBe(1)
    expect(preview.exactMatches).toBe(298)
    expect(preview.photosKept).toBe(5)
    expect(preview.storiesKept).toBe(3)
    expect(preview.filmKept).toBe(2)
    expect(manageCopy.notAppliedYet.toLowerCase()).toContain('nothing has been applied yet')
  })

  it('blocks Update Atlas when identity help is needed', () => {
    const preview = customerPreviewFromInspect(
      inspect({
        blockers: [
          {
            code: 'ambiguous_identity_with_content',
            detail: 'John Smith needs a closer look before photos or stories can stay attached.',
          },
        ],
        identity: [{ tier: 'ambiguous', currentName: 'John Smith', candidateName: 'John Smith' }],
      }),
      327,
    )
    expect(preview.canUpdate).toBe(false)
    expect(preview.needsHelp).toBe(1)
    expect(preview.identityQuestions[0]?.currentName).toBe('John Smith')
  })

  it('calls the existing activate endpoint with the edit cookie', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fetchFn: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init })
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }
    await activateGedcomImport('imp-1', fetchFn)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('/api/gedcom/imports/activate')
    expect(calls[0]?.init?.method).toBe('POST')
    expect(calls[0]?.init?.credentials).toBe('include')
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ importId: 'imp-1' }))
  })

  it('discards a waiting candidate through the existing delete endpoint', async () => {
    const fetchFn: typeof fetch = async (url, init) => {
      expect(String(url)).toContain('/api/gedcom/imports?id=imp-1')
      expect(init?.method).toBe('DELETE')
      expect(init?.credentials).toBe('include')
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }
    expect(await discardGedcomImport('imp-1', fetchFn)).toBe(true)
  })

  it('handles a duplicate GEDCOM without exposing server text', async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(JSON.stringify({ error: 'duplicate checksum xyz', importId: 'imp-9' }), {
        status: 409,
      })
    const file = new File(['0 HEAD\n0 TRLR\n'], 'tree.ged', { type: 'text/plain' })
    const result = await uploadGedcomFile(file, fetchFn)
    expect(result.duplicateImportId).toBe('imp-9')
    expect(result.error).toBe('This family-tree file is already here.')
    expect(result.error).not.toMatch(/checksum|xyz/i)
  })

  it('keeps the current Atlas presented as active when activation fails', async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(JSON.stringify({ error: 'db down' }), { status: 500 })
    const result = await activateGedcomImport('imp-1', fetchFn)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('We couldn’t update your family tree.')
    expect(result.error).not.toMatch(/db down|sql|neon/i)
    expect(generationCountFromPeople(familyDatabase.people)).toBeGreaterThan(1)
  })

  it('uses no customer-facing technical terminology', () => {
    const blob = JSON.stringify(manageCopy).toLowerCase()
    for (const term of HIDDEN_TECHNICAL_TERMS) {
      expect(blob).not.toContain(term)
    }
  })

  it('matches seed generation-count semantics after snapshot numbering', () => {
    const snapshot = familySnapshotFromGraph(
      familyGraphFromDatabase(familyDatabase, familyMarriages),
      familyDatabase.root,
    )
    expect(generationCountFromPeople(snapshot.people)).toBe(generationCountFromPeople(familyDatabase.people))
    expect(generationCountFromPeople(snapshot.people)).toBeGreaterThan(1)
  })

  it('does not treat a live-paused activate as success', async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(JSON.stringify({ error: 'Live Atlas update is paused.', livePaused: true }), {
        status: 409,
      })
    const result = await activateGedcomImport('imp-1', fetchFn)
    expect(result.ok).toBe(false)
    expect(result.livePaused).toBe(true)
    expect(result.error).toBe('We couldn’t update your family tree.')
    expect(JSON.stringify(manageCopy.failLiveBody).toLowerCase()).not.toMatch(/snapshot|uuid|sql|neon/)
  })

  it('keeps inspect payloads free of public URLs', () => {
    const payload = toInspectableImport({
      id: 'imp-1',
      atlasId: 'atlas-a',
      originalFilename: 'tree.ged',
      checksum: 'abc',
      byteSize: 12,
      status: 'ready',
      personCount: 2,
      familyCount: 1,
      createdAt: '2026-08-22T00:00:00.000Z',
      processedAt: '2026-08-22T00:00:01.000Z',
      errorCode: null,
      errorMessage: null,
      diffSummary: { addedPeople: 1 },
      reconciliationSummary: { identity: { exact: 1 } },
      blockers: [],
      gedcomPath: 'atlases/atlas-a/gedcom-imports/imp-1/source.ged',
      snapshotPath: 'atlases/atlas-a/gedcom-imports/imp-1/snapshot.json',
    })
    expect(payload.storage.gedcomPath).not.toMatch(/https?:\/\//i)
    expect(payload.storage.snapshotPath).not.toMatch(/https?:\/\//i)
  })

  it('does not reject inspect when family notes include source URLs', () => {
    const payload = toInspectableImport({
      id: 'imp-1',
      atlasId: 'atlas-a',
      originalFilename: 'tree.ged',
      checksum: 'abc',
      byteSize: 12,
      status: 'ready',
      personCount: 2,
      familyCount: 1,
      createdAt: '2026-08-22T00:00:00.000Z',
      processedAt: '2026-08-22T00:00:01.000Z',
      errorCode: null,
      errorMessage: null,
      diffSummary: { addedPeople: 1 },
      reconciliationSummary: { identity: { exact: 1 } },
      blockers: [],
      identity: [
        {
          tier: 'ambiguous',
          currentName: 'John Smith',
          candidateName: 'John Smith',
          note: 'https://www.ancestry.com/family-tree/person/tree/1/person/2',
        },
      ],
      diffDetails: {
        nameChanges: [{ currentId: 'I1', from: 'John', to: 'John Smith' }],
      },
      gedcomPath: 'atlases/atlas-a/gedcom-imports/imp-1/source.ged',
      snapshotPath: 'atlases/atlas-a/gedcom-imports/imp-1/snapshot.json',
    })
    expect(payload.status).toBe('ready')
    expect(payload.identity).toBeTruthy()
  })
})
