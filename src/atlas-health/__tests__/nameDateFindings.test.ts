import { describe, expect, it } from 'vitest'
import { familyDatabase } from '../../data/familyDatabase'
import { familyMarriages } from '../../data/familyMarriages'
import committedGedcom from '../../../data/Ruiz Family Tree.ged?raw'
import { parseGedcom } from '../../gedcom/parseGedcom'
import { familySnapshotFromGraph } from '../../gedcom/import/snapshotFromGraph'
import { buildGedcom } from '../../gedcom/__tests__/gedcomFixture'
import { collectNameDateFindings, summarizeNameDateFindings } from '../nameDateFindings'
import type { Person } from '../../types'

function peopleFromGedcom(text: string, rootId = 'I1'): Person[] {
  const graph = parseGedcom(text)
  return familySnapshotFromGraph(graph, rootId).people
}

describe('name/date Health detectors', () => {
  it('preserves GIVN/SURN/NSFX and extra NAME records without changing display name', () => {
    const text = buildGedcom(
      [
        {
          id: 'I1',
          name: 'Alfred Ruiz',
          given: 'Alfred',
          surname: 'Ruiz',
          suffix: 'Jr',
          aliases: ['Alfred Victor Ruiz'],
          birthDate: '14 Aug 1943',
        },
      ],
      [],
    )
    const [alfred] = peopleFromGedcom(text)
    expect(alfred.name).toBe('Alfred Victor Ruiz')
    expect(alfred.nameSource?.given).toBe('Alfred')
    expect(alfred.nameSource?.surname).toBe('Ruiz')
    expect(alfred.nameSource?.suffix).toBe('Jr')
    expect(alfred.nameSource?.aliases).toContain('Alfred Ruiz')
    const findings = collectNameDateFindings({ people: [alfred], marriages: [] })
    expect(findings.some((row) => row.code === 'name_alias_conflict')).toBe(false)
  })

  it('flags import garbage in a name and not unusual spellings', () => {
    const people = peopleFromGedcom(
      buildGedcom(
        [
          { id: 'I1', name: 'Salvador* Pinon Vernal', birthDate: '1657' },
          { id: 'I2', name: 'Catherina Stubbs', birthDate: '1701' },
        ],
        [],
      ),
    )
    const findings = collectNameDateFindings({ people, marriages: [] })
    expect(findings.some((row) => row.personName.includes('Salvador') && row.code === 'name_import_garbage')).toBe(
      true,
    )
    expect(findings.some((row) => row.personName === 'Catherina Stubbs')).toBe(false)
  })

  it('detects death before birth, child/parent contradictions, and marriage before birth', () => {
    const people = peopleFromGedcom(
      buildGedcom(
        [
          { id: 'I1', name: 'Parent', sex: 'F', birthDate: '1 Jan 1900', deathDate: '1 Jan 1920', fams: ['F1'] },
          { id: 'I2', name: 'Early Child', sex: 'M', birthDate: '1 Jan 1890', famc: ['F1'] },
          { id: 'I3', name: 'Late Child', sex: 'F', birthDate: '1 Jan 1925', famc: ['F1'] },
          { id: 'I4', name: 'Inverted', sex: 'M', birthDate: '1 Jan 1980', deathDate: '1 Jan 1970' },
          { id: 'I5', name: 'Young Bride', sex: 'F', birthDate: '1 Jan 1950', fams: ['F2'] },
        ],
        [
          { id: 'F1', wifeId: 'I1', children: ['I2', 'I3'] },
          { id: 'F2', wifeId: 'I5', husbandId: 'I4', marriageDate: '1 Jan 1940' },
        ],
      ),
    )
    const graph = parseGedcom(
      buildGedcom(
        [
          { id: 'I1', name: 'Parent', sex: 'F', birthDate: '1 Jan 1900', deathDate: '1 Jan 1920', fams: ['F1'] },
          { id: 'I2', name: 'Early Child', sex: 'M', birthDate: '1 Jan 1890', famc: ['F1'] },
          { id: 'I3', name: 'Late Child', sex: 'F', birthDate: '1 Jan 1925', famc: ['F1'] },
          { id: 'I4', name: 'Inverted', sex: 'M', birthDate: '1 Jan 1980', deathDate: '1 Jan 1970' },
          { id: 'I5', name: 'Young Bride', sex: 'F', birthDate: '1 Jan 1950', fams: ['F2'] },
        ],
        [
          { id: 'F1', wifeId: 'I1', children: ['I2', 'I3'] },
          { id: 'F2', wifeId: 'I5', husbandId: 'I4', marriageDate: '1 Jan 1940' },
        ],
      ),
    )
    const findings = collectNameDateFindings({ people, marriages: graph.marriages })
    expect(findings.some((row) => row.code === 'date_death_before_birth' && row.customerCandidate)).toBe(true)
    expect(findings.some((row) => row.code === 'date_child_before_parent_birth' && row.customerCandidate)).toBe(true)
    expect(findings.some((row) => row.code === 'date_child_after_parent_death' && row.customerCandidate)).toBe(true)
    expect(findings.some((row) => row.code === 'date_marriage_before_birth' && row.customerCandidate)).toBe(true)
  })

  it('does not promote ABT / BET / year-only medieval contradictions to customer candidates', () => {
    const people = peopleFromGedcom(
      buildGedcom(
        [
          { id: 'I1', name: 'Medieval Parent', sex: 'M', birthDate: '1493', deathDate: '1599', fams: ['F1'] },
          { id: 'I2', name: 'Medieval Child', sex: 'M', birthDate: 'Abt 1475', famc: ['F1'] },
          { id: 'I3', name: 'Later Child', sex: 'M', birthDate: '1619', famc: ['F1'] },
          { id: 'I4', name: 'Ranged', sex: 'F', birthDate: 'BET 1840 AND 1845', deathDate: '1842' },
        ],
        [{ id: 'F1', husbandId: 'I1', children: ['I2', 'I3'] }],
      ),
    )
    const findings = collectNameDateFindings({ people, marriages: [] })
    expect(findings.some((row) => row.customerCandidate)).toBe(false)
    expect(findings.some((row) => row.code === 'date_death_before_birth' && row.customerCandidate)).toBe(false)
  })

  it('keeps displayed Person.name identical to the live Santa Ruiz database', () => {
    const graph = parseGedcom(committedGedcom)
    const parsedById = new Map(graph.people.map((person) => [person.id, person]))
    for (const live of familyDatabase.people) {
      expect(parsedById.get(live.id)?.name).toBe(live.name)
    }
    const craig = parsedById.get(familyDatabase.root)
    expect(craig?.nameSource?.given).toBe('Craig B')
    expect(craig?.nameSource?.surname).toBe('Ruiz')
  })

  it('flags Nellie Whipple vs Phebe Doll and Salvador* on the real Santa Ruiz GEDCOM', () => {
    const graph = parseGedcom(committedGedcom)
    const snapshot = familySnapshotFromGraph(graph, familyDatabase.root)
    const findings = collectNameDateFindings({
      people: snapshot.people,
      marriages: familyMarriages,
    })
    const counts = summarizeNameDateFindings(findings)
    expect(counts.customerCandidates).toBeGreaterThan(0)
    expect(counts.customerCandidates).toBeLessThan(20)

    const nellie = findings.find(
      (row) =>
        row.code === 'date_child_after_parent_death' &&
        /nellie/i.test(row.personName) &&
        /phebe/i.test(row.relatedPersonName ?? ''),
    )
    expect(nellie?.customerCandidate).toBe(true)
    expect(nellie?.severity).toBe('impossible')
    expect(nellie?.relatedPersonId).toBeTruthy()
    expect(nellie?.relatedFact).toBe('death')

    const salvador = findings.find((row) => /salvador/i.test(row.personName) && row.code === 'name_import_garbage')
    expect(salvador?.customerCandidate).toBe(true)

    const alfred = graph.people.find((person) => person.id === 'I18123023681')
    expect(alfred?.name).toBe('Alfred Victor Ruiz')
    expect(alfred?.nameSource?.aliases.some((alias) => alias === 'Alfred Ruiz')).toBe(true)
    expect(findings.some((row) => row.personId === 'I18123023681' && row.code === 'name_alias_conflict')).toBe(false)

    expect(counts.name + counts.date).toBe(findings.length)
  })
})
