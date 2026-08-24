/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { familyDatabase } from '../../data/familyDatabase'
import { currentFamilyGraph } from '../../gedcom/graphFromCurrent'
import { processCandidateGedcom } from '../../gedcom/import/processCandidate'
import { toInspectableImport } from '../../gedcom/import/inspectImport'
import { familySnapshotFromGraph } from '../../gedcom/import/snapshotFromGraph'
import { generationCountFromPeople } from '../../gedcom/assignGenerations'
import { customerPreviewFromInspect } from '../customerPreview'
import { buildFamilyTreeLayout } from '../../utils/buildFamilyTree'

const CANDIDATE_PATH = '/Users/santaruizfamily/Desktop/Ruiz Family Tree - Aug 21 2026.ged'

describe('Aug 21 candidate through customer preview', () => {
  it('maps the real candidate analysis into the family-editor summary', () => {
    const bytes = new Uint8Array(readFileSync(CANDIDATE_PATH))
    const result = processCandidateGedcom({
      bytes,
      current: currentFamilyGraph(),
      currentRootId: familyDatabase.root,
    })
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return

    const inspect = toInspectableImport({
      id: 'imp-aug21',
      atlasId: 'atlas-a',
      originalFilename: 'Ruiz Family Tree - Aug 21 2026.ged',
      checksum: 'local-analysis',
      byteSize: bytes.byteLength,
      status: 'ready',
      personCount: result.personCount,
      familyCount: result.familyCount,
      createdAt: '2026-08-22T00:00:00.000Z',
      processedAt: '2026-08-22T00:00:01.000Z',
      errorCode: null,
      errorMessage: null,
      diffSummary: result.diff.summary,
      reconciliationSummary: result.reconciliationSummary,
      blockers: result.blockers,
      identity: result.compactReconciliation.identity,
      diffDetails: result.compactDiff,
      gedcomPath: 'atlases/atlas-a/gedcom-imports/imp-aug21/source.ged',
      snapshotPath: 'atlases/atlas-a/gedcom-imports/imp-aug21/snapshot.json',
    })
    const preview = customerPreviewFromInspect(inspect, familyDatabase.people.length)
    const snapshot = familySnapshotFromGraph(result.graph, familyDatabase.root)
    const peopleById = Object.fromEntries(snapshot.people.map((person) => [person.id, person]))
    const layout = buildFamilyTreeLayout(peopleById, new Set(), snapshot.root)

    expect(result.blockers).toEqual([])
    expect(preview.canUpdate).toBe(true)
    expect(preview.needsHelp).toBe(0)
    expect(preview.currentPeople).toBe(familyDatabase.people.length)
    expect(preview.candidatePeople).toBe(result.personCount)
    expect(preview.added).toBe(result.diff.summary.addedPeople)
    expect(preview.noLongerInFile).toBe(result.diff.summary.removedPeople)
    expect(preview.exactMatches).toBe(result.reconciliationSummary.identity.exact)
    expect(preview.storiesKept).toBe(
      result.reconciliationSummary.stories.preserved + result.reconciliationSummary.stories.rebound,
    )
    expect(preview.filmKept).toBe(
      result.reconciliationSummary.documentary.preserved + result.reconciliationSummary.documentary.rebound,
    )
    expect(preview.photosKept).toBe(
      result.reconciliationSummary.media.preserved + result.reconciliationSummary.media.rebound,
    )
    expect(generationCountFromPeople(snapshot.people)).toBeGreaterThan(1)
    expect(generationCountFromPeople(snapshot.people)).toBe(generationCountFromPeople(familyDatabase.people))
    expect(layout.nodes.length).toBeLessThan(snapshot.people.length)

    expect(preview.currentPeople).toBe(327)
    expect(preview.candidatePeople).toBe(357)
    expect(preview.added).toBe(32)
    expect(preview.noLongerInFile).toBe(2)
    expect(preview.exactMatches).toBe(325)
    expect(result.reconciliationSummary.stories.needsReview).toBe(0)
    expect(result.reconciliationSummary.stories.orphaned).toBe(0)
    expect(result.reconciliationSummary.documentary.needsReview).toBe(0)
    expect(result.reconciliationSummary.documentary.orphaned).toBe(0)
    expect(result.reconciliationSummary.stories.preserved + result.reconciliationSummary.stories.rebound).toBeGreaterThan(0)
    expect(result.reconciliationSummary.documentary.preserved + result.reconciliationSummary.documentary.rebound).toBeGreaterThan(0)
  })
})
