import { describe, expect, it } from 'vitest'
import { familyDatabase } from '../../data/familyDatabase'
import { familyMarriages } from '../../data/familyMarriages'
import { familyGraphFromDatabase } from '../graphFromCurrent'
import { familySnapshotFromGraph } from '../import/snapshotFromGraph'
import { generationCountFromPeople } from '../assignGenerations'
import { parseGedcom } from '../parseGedcom'
import { buildGedcom } from './gedcomFixture'
import { processCandidateGedcom } from '../import/processCandidate'

const encoder = new TextEncoder()

describe('snapshot generations', () => {
  it('matches the seed importer: root 0, ancestors +, descendants −, root spouse 0', () => {
    const gedcom = buildGedcom(
      [
        { id: 'I1', name: 'Craig Ruiz', sex: 'M', birthDate: '1975', famc: ['F1'], fams: ['F2'] },
        { id: 'I2', name: 'Parent', sex: 'M', birthDate: '1950', fams: ['F1'] },
        { id: 'I3', name: 'Parent two', sex: 'F', birthDate: '1952', fams: ['F1'] },
        { id: 'I4', name: 'Child', sex: 'F', birthDate: '2001', famc: ['F2'] },
        { id: 'I5', name: 'Spouse', sex: 'F', birthDate: '1976', fams: ['F2'] },
        { id: 'I9', name: 'Unconnected', sex: 'M', birthDate: '1800' },
      ],
      [
        { id: 'F1', husbandId: 'I2', wifeId: 'I3', children: ['I1'] },
        { id: 'F2', husbandId: 'I1', wifeId: 'I5', children: ['I4'] },
      ],
    )
    const snapshot = familySnapshotFromGraph(parseGedcom(gedcom), 'I1')
    const byId = Object.fromEntries(snapshot.people.map((person) => [person.id, person]))
    expect(byId.I1?.generation).toBe(0)
    expect(byId.I2?.generation).toBe(1)
    expect(byId.I3?.generation).toBe(1)
    expect(byId.I4?.generation).toBe(-1)
    expect(byId.I5?.generation).toBe(0)
    expect(byId.I9?.generation).toBeNull()
    expect(generationCountFromPeople(snapshot.people)).toBe(2)
  })

  it('matches seed familyDatabase generation-count semantics', () => {
    const seedCount = generationCountFromPeople(familyDatabase.people)
    const snapshot = familySnapshotFromGraph(
      familyGraphFromDatabase(familyDatabase, familyMarriages),
      familyDatabase.root,
    )
    expect(generationCountFromPeople(snapshot.people)).toBe(seedCount)
    expect(seedCount).toBeGreaterThan(1)

    for (const seedPerson of familyDatabase.people) {
      const snap = snapshot.people.find((person) => person.id === seedPerson.id)
      expect(snap?.generation ?? null).toBe(seedPerson.generation ?? null)
    }
  })

  it('numbers generations on a processed candidate snapshot', () => {
    const current = familyGraphFromDatabase(familyDatabase, familyMarriages)
    const result = processCandidateGedcom({
      bytes: encoder.encode(
        buildGedcom(
          [
            {
              id: familyDatabase.root,
              name: 'Craig B Ruiz',
              sex: 'M',
              birthDate: '4 Jun 1975',
              famc: ['F0'],
              fams: ['F1'],
            },
            { id: 'I-PARENT', name: 'Parent', sex: 'M', birthDate: '1948', fams: ['F0'] },
            { id: 'I-SPOUSE', name: 'Spouse', sex: 'F', birthDate: '1976', fams: ['F1'] },
          ],
          [
            { id: 'F0', husbandId: 'I-PARENT', children: [familyDatabase.root] },
            { id: 'F1', husbandId: familyDatabase.root, wifeId: 'I-SPOUSE' },
          ],
        ),
      ),
      current,
      currentRootId: familyDatabase.root,
    })
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.snapshot.people.find((person) => person.id === familyDatabase.root)?.generation).toBe(0)
    expect(generationCountFromPeople(result.snapshot.people)).toBeGreaterThan(1)
  })
})
