import { describe, expect, it } from 'vitest'
import { compareGedcomTexts } from '../compareGedcom'
import { parseGedcom } from '../parseGedcom'
import { buildGedcom } from './gedcomFixture'

const BASE_PEOPLE = [
  {
    id: 'I1',
    name: 'Alice Ruiz',
    sex: 'F',
    birthDate: '1 Jan 1900',
    birthPlace: 'Medord, Oregon, USA',
    fams: ['F1'],
  },
  {
    id: 'I2',
    name: 'Bob Ruiz',
    sex: 'M',
    birthDate: '2 Feb 1898',
    birthPlace: 'Texas',
    fams: ['F1'],
  },
  {
    id: 'I3',
    name: 'Carol Ruiz',
    sex: 'F',
    birthDate: '3 Mar 1922',
    birthPlace: 'California',
    famc: ['F1'],
  },
]

const BASE_FAMILIES = [
  {
    id: 'F1',
    husbandId: 'I2',
    wifeId: 'I1',
    children: ['I3'],
    marriageDate: '4 Apr 1920',
    marriagePlace: 'Texas',
  },
]

function baseGedcom() {
  return buildGedcom([...BASE_PEOPLE], [...BASE_FAMILIES])
}

describe('family GEDCOM diff', () => {
  it('reports no changes for an identical GEDCOM', () => {
    const gedcom = baseGedcom()
    const diff = compareGedcomTexts(gedcom, gedcom)
    expect(diff.summary).toMatchObject({
      unchangedPeople: 3,
      idChangedMatches: 0,
      addedPeople: 0,
      removedPeople: 0,
      nameChanges: 0,
      dateChanges: 0,
      relationshipChanges: 0,
      placeChanges: 0,
      marriageChanges: 0,
      ambiguousMatches: 0,
    })
    expect(diff.matches.every((match) => match.safeToRebindAttachments)).toBe(true)
  })

  it('treats GEDCOM id renumbering as the same people when vitals are unique', () => {
    const current = baseGedcom()
    const candidate = buildGedcom(
      [
        { ...BASE_PEOPLE[0], id: 'I101', fams: ['F9'] },
        { ...BASE_PEOPLE[1], id: 'I102', fams: ['F9'] },
        { ...BASE_PEOPLE[2], id: 'I103', famc: ['F9'] },
      ],
      [
        {
          id: 'F9',
          husbandId: 'I102',
          wifeId: 'I101',
          children: ['I103'],
          marriageDate: '4 Apr 1920',
          marriagePlace: 'Texas',
        },
      ],
    )
    const diff = compareGedcomTexts(current, candidate)
    expect(diff.summary.unchangedPeople).toBe(3)
    expect(diff.summary.idChangedMatches).toBe(3)
    expect(diff.summary.addedPeople).toBe(0)
    expect(diff.summary.removedPeople).toBe(0)
    expect(diff.summary.relationshipChanges).toBe(0)
    expect(diff.idChangedMatches.map((row) => [row.currentId, row.candidateId])).toEqual([
      ['I1', 'I101'],
      ['I2', 'I102'],
      ['I3', 'I103'],
    ])
    expect(diff.matches.every((match) => match.safeToRebindAttachments === false)).toBe(true)
    expect(diff.matches.every((match) => match.method === 'unique-identity-tuple')).toBe(true)
  })

  it('does not silently match two people who share a name and birth year', () => {
    const current = buildGedcom([
      { id: 'I1', name: 'John Smith', sex: 'M', birthDate: '1850' },
      { id: 'I2', name: 'John Smith', sex: 'M', birthDate: '1850' },
    ])
    const candidate = buildGedcom([
      { id: 'I9', name: 'John Smith', sex: 'M', birthDate: '1850' },
      { id: 'I8', name: 'John Smith', sex: 'M', birthDate: '1850' },
    ])
    const diff = compareGedcomTexts(current, candidate)
    expect(diff.summary.idChangedMatches).toBe(0)
    expect(diff.summary.ambiguousMatches).toBeGreaterThan(0)
    expect(diff.matches).toHaveLength(0)
    expect(diff.ambiguousMatches[0]?.reason).toBe('non-unique-identity-tuple')
  })

  it('does not match on name alone when birth year is missing', () => {
    const current = buildGedcom([{ id: 'I1', name: 'Unknown Person', sex: 'F' }])
    const candidate = buildGedcom([{ id: 'I9', name: 'Unknown Person', sex: 'F' }])
    const diff = compareGedcomTexts(current, candidate)
    expect(diff.summary.removedPeople).toBe(1)
    expect(diff.summary.addedPeople).toBe(1)
    expect(diff.summary.idChangedMatches).toBe(0)
  })

  it('records name, date, place, and relationship edits for the same GEDCOM id', () => {
    const current = baseGedcom()
    const candidate = buildGedcom(
      [
        {
          ...BASE_PEOPLE[0],
          name: 'Alice Maria Ruiz',
          birthDate: '1 Jan 1901',
          birthPlace: 'Medford, Oregon, USA',
          fams: ['F1'],
        },
        { ...BASE_PEOPLE[1], fams: ['F1'] },
        { ...BASE_PEOPLE[2], famc: ['F1'] },
        {
          id: 'I4',
          name: 'David Ruiz',
          sex: 'M',
          birthDate: '1925',
          famc: ['F1'],
        },
      ],
      [
        {
          id: 'F1',
          husbandId: 'I2',
          wifeId: 'I1',
          children: ['I3', 'I4'],
          marriageDate: '4 Apr 1920',
          marriagePlace: 'Texas',
        },
      ],
    )
    const diff = compareGedcomTexts(current, candidate)
    expect(diff.nameChanges.some((row) => row.field === 'name' && row.to === 'Alice Maria Ruiz')).toBe(
      true,
    )
    expect(diff.dateChanges.some((row) => row.field === 'birthDate' && row.to === '1 Jan 1901')).toBe(
      true,
    )
    expect(diff.placeChanges.some((row) => row.field === 'birthPlace' && row.to.includes('Medford, Oregon, USA'))).toBe(
      true,
    )
    expect(diff.addedPeople.map((row) => row.id)).toEqual(['I4'])
    const childChange = diff.relationshipChanges.find((row) => row.currentId === 'I1' && row.kind === 'children')
    expect(childChange?.added.map((row) => row.id)).toEqual(['I4'])
  })

  it('treats a recycled GEDCOM id with a different name and year as ambiguous', () => {
    const current = buildGedcom([{ id: 'I1', name: 'Alice Ruiz', sex: 'F', birthDate: '1900' }])
    const candidate = buildGedcom([{ id: 'I1', name: 'Bob Stone', sex: 'M', birthDate: '1850' }])
    const diff = compareGedcomTexts(current, candidate)
    expect(diff.matches).toHaveLength(1)
    expect(diff.matches[0]?.safeToRebindAttachments).toBe(false)
    expect(diff.ambiguousMatches[0]?.reason).toBe('gedcom-id-conflict')
  })

  it('lists added and removed people that have no conservative match', () => {
    const current = buildGedcom([
      { id: 'I1', name: 'Alice Ruiz', sex: 'F', birthDate: '1900' },
      { id: 'I2', name: 'Old Relative', sex: 'M', birthDate: '1870' },
    ])
    const candidate = buildGedcom([
      { id: 'I1', name: 'Alice Ruiz', sex: 'F', birthDate: '1900' },
      { id: 'I9', name: 'New Relative', sex: 'F', birthDate: '2001' },
    ])
    const diff = compareGedcomTexts(current, candidate)
    expect(diff.removedPeople.map((row) => row.id)).toEqual(['I2'])
    expect(diff.addedPeople.map((row) => row.id)).toEqual(['I9'])
  })

  it('detects marriage date and place changes after person ids are remapped', () => {
    const current = baseGedcom()
    const candidate = buildGedcom(
      [
        { ...BASE_PEOPLE[0], id: 'I101', fams: ['F9'] },
        { ...BASE_PEOPLE[1], id: 'I102', fams: ['F9'] },
        { ...BASE_PEOPLE[2], id: 'I103', famc: ['F9'] },
      ],
      [
        {
          id: 'F9',
          husbandId: 'I102',
          wifeId: 'I101',
          children: ['I103'],
          marriageDate: '5 May 1921',
          marriagePlace: 'Oregon',
        },
      ],
    )
    const diff = compareGedcomTexts(current, candidate)
    expect(diff.summary.marriageChanges).toBe(1)
    expect(diff.marriageChanges[0]?.status).toBe('changed')
    expect(diff.marriageChanges[0]?.changes.map((row) => row.field).sort()).toEqual(['date', 'place', 'year'])
  })

  it('round-trips the fixture through the parser before diffing', () => {
    const graph = parseGedcom(baseGedcom())
    expect(graph.people).toHaveLength(3)
    expect(graph.marriages).toHaveLength(1)
  })
})
