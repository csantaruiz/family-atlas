import { describe, expect, it } from 'vitest'
import { familyDatabase } from '../../data/familyDatabase'
import committedGedcom from '../../../data/Ruiz Family Tree.ged?raw'
import { compareGedcomToCurrent } from '../compareGedcom'
import { extractGedcomYear, formatGedcomName, parseGedcom } from '../parseGedcom'
import { buildGedcom } from './gedcomFixture'

describe('GEDCOM parser', () => {
  it('formats Ancestry NAME slashes like the Python importer', () => {
    expect(formatGedcomName('Craig B /Ruiz/')).toBe('Craig B Ruiz')
    expect(formatGedcomName('  Sally Ann /Doll/  ')).toBe('Sally Ann Doll')
  })

  it('extracts the last plausible year, matching import-gedcom.py', () => {
    expect(extractGedcomYear('4 Jun 1975')).toBe(1975)
    expect(extractGedcomYear('BET 1850 AND 1852')).toBe(1852)
    expect(extractGedcomYear('Abt 1908')).toBe(1908)
    expect(extractGedcomYear('')).toBeNull()
  })

  it('parses people, residences, and FAM relationships', () => {
    const text = buildGedcom(
      [
        {
          id: 'I1',
          name: 'Craig B Ruiz',
          sex: 'M',
          birthDate: '4 Jun 1975',
          birthPlace: 'Santa Clara, California',
          residences: ['Rescue, CA', 'San Luis Obispo, California, USA'],
          famc: ['F1'],
          fams: ['F2'],
        },
        {
          id: 'I2',
          name: 'Parent One',
          sex: 'M',
          birthDate: '1950',
          fams: ['F1'],
        },
        {
          id: 'I3',
          name: 'Parent Two',
          sex: 'F',
          birthDate: '1952',
          fams: ['F1'],
        },
        {
          id: 'I4',
          name: 'Spouse',
          sex: 'F',
          birthDate: '1976',
          fams: ['F2'],
        },
      ],
      [
        { id: 'F1', husbandId: 'I2', wifeId: 'I3', children: ['I1'] },
        {
          id: 'F2',
          husbandId: 'I1',
          wifeId: 'I4',
          marriageDate: '14 Feb 2000',
          marriagePlace: 'California',
        },
      ],
    )
    const graph = parseGedcom(text)
    const craig = graph.people.find((person) => person.id === 'I1')
    expect(craig?.name).toBe('Craig B Ruiz')
    expect(craig?.birthYear).toBe(1975)
    expect(craig?.places).toEqual([
      'Santa Clara, California',
      'Rescue, CA',
      'San Luis Obispo, California, USA',
    ])
    expect(craig?.parents).toEqual(['I2', 'I3'])
    expect(craig?.spouses).toEqual(['I4'])
    expect(graph.marriages).toEqual([
      {
        id: 'F2',
        year: 2000,
        date: '14 Feb 2000',
        place: 'California',
        husbandId: 'I1',
        wifeId: 'I4',
      },
    ])
  })

  it('matches live FamilyDatabase people when parsing the committed GEDCOM', () => {
    const text = committedGedcom
    const graph = parseGedcom(text)
    expect(graph.people).toHaveLength(familyDatabase.people.length)

    const parsedById = new Map(graph.people.map((person) => [person.id, person]))
    for (const live of familyDatabase.people) {
      const parsed = parsedById.get(live.id)
      expect(parsed, `missing ${live.id} ${live.name}`).toBeTruthy()
      if (!parsed) continue
      expect(parsed.name).toBe(live.name)
      expect(parsed.sex).toBe(live.sex ?? '')
      expect(parsed.birthDate).toBe(live.birthDate ?? '')
      expect(parsed.birthYear).toBe(live.birthYear ?? null)
      expect(parsed.birthPlace).toBe(live.birthPlace ?? '')
      expect(parsed.deathDate).toBe(live.deathDate ?? '')
      expect(parsed.deathYear).toBe(live.deathYear ?? null)
      expect(parsed.deathPlace).toBe(live.deathPlace ?? '')
      expect([...parsed.places]).toEqual([...(live.places ?? [])])
      expect([...parsed.parents].sort()).toEqual([...(live.parents ?? [])].sort())
      expect([...parsed.spouses].sort()).toEqual([...(live.spouses ?? [])].sort())
      expect([...parsed.children].sort()).toEqual([...(live.children ?? [])].sort())
    }
    const craig = parsedById.get(familyDatabase.root)
    expect(craig?.name).toBe(familyDatabase.people.find((person) => person.id === familyDatabase.root)?.name)
    expect(craig?.nameSource?.given).toBeTruthy()
    expect(craig?.nameSource?.surname).toBe('Ruiz')
  })

  it('diffs the committed GEDCOM against the live FamilyDatabase', () => {
    const diff = compareGedcomToCurrent(committedGedcom)
    expect(diff.summary.currentPeople).toBe(familyDatabase.people.length)
    expect(diff.summary.candidatePeople).toBe(familyDatabase.people.length)
    expect(diff.summary.addedPeople).toBe(0)
    expect(diff.summary.removedPeople).toBe(0)
    expect(diff.summary.idChangedMatches).toBe(0)
    expect(diff.summary.ambiguousMatches).toBe(0)
    expect(diff.summary.nameChanges).toBe(0)
    expect(diff.summary.dateChanges).toBe(0)
    expect(diff.summary.relationshipChanges).toBe(0)
    expect(diff.summary.placeChanges).toBe(0)
  })
})
