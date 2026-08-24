import { describe, expect, it } from 'vitest'
import { familyDatabase } from '../../data/familyDatabase'
import liveGedcom from '../../../data/Ruiz Family Tree.ged?raw'
import { buildGedcom } from './gedcomFixture'
import { findDuplicateOpenImport } from '../import/duplicates'
import { gedcomImportPathnames, isPrivateImportPath } from '../import/importPaths'
import { toInspectableImport } from '../import/inspectImport'
import { processCandidateGedcom } from '../import/processCandidate'
import { familySnapshotFromGraph } from '../import/snapshotFromGraph'
import { parseGedcom } from '../parseGedcom'
import { currentFamilyGraph } from '../graphFromCurrent'

const encoder = new TextEncoder()

describe('2D.3B candidate GEDCOM processing', () => {
  it('accepts a valid candidate and builds a FamilyDatabase-shaped snapshot', () => {
    const gedcom = buildGedcom(
      [
        { id: 'I1', name: 'Alice Ruiz', sex: 'F', birthDate: '1 Jan 1900', birthPlace: 'Oregon' },
        { id: 'I2', name: 'Bob Ruiz', sex: 'M', birthDate: '1898', birthPlace: 'Texas' },
      ],
      [{ id: 'F1', husbandId: 'I2', wifeId: 'I1', marriageDate: '1920', marriagePlace: 'Texas' }],
    )
    const current = parseGedcom(gedcom)
    const result = processCandidateGedcom({
      bytes: encoder.encode(gedcom),
      current,
      currentRootId: 'I1',
    })
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.personCount).toBe(2)
    expect(result.familyCount).toBe(1)
    expect(result.snapshot.root).toBe('I1')
    expect(result.snapshot.people).toHaveLength(2)
    expect(result.snapshot.stats.people).toBe(2)
    expect(result.snapshot.stats.families).toBe(1)
    expect(result.diff.summary.unchangedPeople).toBe(2)
  })

  it('detects a duplicate checksum for the same atlas only', () => {
    const duplicate = findDuplicateOpenImport(
      [
        { atlasId: 'A', checksum: 'abc', status: 'ready', id: 'imp-1' },
        { atlasId: 'B', checksum: 'abc', status: 'ready', id: 'imp-2' },
      ],
      'A',
      'abc',
    )
    expect(duplicate?.id).toBe('imp-1')
    expect(
      findDuplicateOpenImport(
        [{ atlasId: 'A', checksum: 'abc', status: 'failed', id: 'imp-3' }],
        'A',
        'abc',
      ),
    ).toBeNull()
    expect(
      findDuplicateOpenImport(
        [{ atlasId: 'B', checksum: 'abc', status: 'ready', id: 'imp-2' }],
        'A',
        'abc',
      ),
    ).toBeNull()
  })

  it('fails a malformed file', () => {
    const result = processCandidateGedcom({
      bytes: encoder.encode('this is not a genealogy file'),
      current: currentFamilyGraph(),
      currentRootId: familyDatabase.root,
    })
    expect(result.status).toBe('failed')
    if (result.status !== 'failed') return
    expect(result.errorCode).toBe('malformed')
  })

  it('fails an empty file', () => {
    const result = processCandidateGedcom({
      bytes: encoder.encode(''),
      current: currentFamilyGraph(),
      currentRootId: familyDatabase.root,
    })
    expect(result.status).toBe('failed')
    if (result.status !== 'failed') return
    expect(result.errorCode).toBe('empty')
  })

  it('fails a GEDCOM header with no people', () => {
    const result = processCandidateGedcom({
      bytes: encoder.encode('0 HEAD\n1 CHAR UTF-8\n0 TRLR\n'),
      current: currentFamilyGraph(),
      currentRootId: familyDatabase.root,
    })
    expect(result.status).toBe('failed')
    if (result.status !== 'failed') return
    expect(result.errorCode).toBe('parse_failed')
  })

  it('generates a snapshot that keeps the current root when that person is still present', () => {
    const graph = parseGedcom(
      buildGedcom([
        { id: familyDatabase.root, name: 'Craig B Ruiz', sex: 'M', birthDate: '4 Jun 1975' },
        { id: 'I-NEW', name: 'New Relative', sex: 'F', birthDate: '2001' },
      ]),
    )
    const snapshot = familySnapshotFromGraph(graph, familyDatabase.root)
    expect(snapshot.root).toBe(familyDatabase.root)
    expect(snapshot.people.find((person) => person.id === familyDatabase.root)?.focus).toBe(true)
  })

  it('keeps private atlas-scoped storage paths and never exposes public URLs', () => {
    const paths = gedcomImportPathnames('atlas-a', 'imp-1')
    expect(isPrivateImportPath(paths.gedcomPath, 'atlas-a')).toBe(true)
    expect(paths.gedcomPath.startsWith('http')).toBe(false)
    expect(paths.snapshotPath.startsWith('atlases/atlas-a/')).toBe(true)
    const inspect = toInspectableImport({
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
      gedcomPath: paths.gedcomPath,
      snapshotPath: paths.snapshotPath,
    })
    expect(JSON.stringify(inspect)).not.toMatch(/https?:\/\//i)
  })

  it('does not change the live family dataset while processing a candidate', () => {
    const beforeCount = familyDatabase.people.length
    const beforeRoot = familyDatabase.root
    const result = processCandidateGedcom({
      bytes: encoder.encode(liveGedcom),
      current: currentFamilyGraph(),
      currentRootId: familyDatabase.root,
    })
    expect(result.status).toBe('ready')
    expect(familyDatabase.people.length).toBe(beforeCount)
    expect(familyDatabase.root).toBe(beforeRoot)
    expect(familyDatabase.people[0]?.id).toBe(beforeRoot)
  })
})
