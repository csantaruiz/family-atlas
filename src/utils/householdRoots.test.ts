import { describe, expect, it } from 'vitest'
import type { Person } from '../types'
import { familyDatabase } from '../data/familyDatabase'
import { buildFamilyEvents } from '../data/buildFamilyEvents'
import { processCandidateGedcom } from '../gedcom/import/processCandidate'
import { currentFamilyGraph } from '../gedcom/graphFromCurrent'
import { buildGedcom } from '../gedcom/__tests__/gedcomFixture'
import { assignPersonGenerations } from '../gedcom/assignGenerations'
import { buildFamilyTreeLayout } from './buildFamilyTree'
import { householdCoRootId, primaryRootIds } from './householdRoots'
import { buildLineagePalette } from './lineageColors'
import { buildPlaceIndex } from './placeIndex'

const encoder = new TextEncoder()

function person(partial: Partial<Person> & { id: string; name: string }): Person {
  return {
    sex: 'M',
    birthDate: '',
    birthYear: null,
    birthPlace: '',
    deathDate: '',
    deathYear: null,
    deathPlace: '',
    places: [],
    occupation: [],
    parents: [],
    spouses: [],
    children: [],
    generation: null,
    focus: false,
    ...partial,
  }
}

describe('two-primary-root household', () => {
  it('treats the archive-root spouse with shared children as co-root', () => {
    const people = familyDatabase.people
    const coRoot = householdCoRootId(familyDatabase.root, people)
    expect(coRoot).toBeTruthy()
    expect(primaryRootIds(familyDatabase.root, people)).toEqual([familyDatabase.root, coRoot])
  })

  it('places the co-root parents above the co-root in the tree', () => {
    const peopleById = Object.fromEntries(familyDatabase.people.map((row) => [row.id, row]))
    const coRootId = householdCoRootId(familyDatabase.root, peopleById)!
    const layout = buildFamilyTreeLayout(peopleById, new Set(), familyDatabase.root)
    const byId = Object.fromEntries(layout.nodes.map((node) => [node.person.id, node]))
    const coRoot = byId[coRootId]
    const parents = (peopleById[coRootId]?.parents ?? [])
      .map((id) => byId[id])
      .filter(Boolean)
    expect(parents.length).toBeGreaterThan(0)
    for (const parent of parents) {
      expect(parent, `parent ${parent?.person.name} should appear`).toBeTruthy()
      expect(parent!.y).toBeLessThan(coRoot.y)
      expect(parent!.generation).toBe(1)
    }
  })

  it('does not pull in ancestry of a distant ancestor’s spouse', () => {
    const people = [
      person({ id: 'ROOT', name: 'Root', spouses: ['SPOUSE'], children: ['CHILD'], parents: ['P1'] }),
      person({ id: 'SPOUSE', name: 'Co Root', sex: 'F', spouses: ['ROOT'], children: ['CHILD'] }),
      person({ id: 'CHILD', name: 'Child', parents: ['ROOT', 'SPOUSE'] }),
      person({ id: 'P1', name: 'Root Parent', children: ['ROOT'], spouses: ['INLAW'] }),
      person({
        id: 'INLAW',
        name: 'Distant Spouse',
        sex: 'F',
        spouses: ['P1'],
        parents: ['INLAW-PARENT'],
      }),
      person({ id: 'INLAW-PARENT', name: 'Should Stay Out', children: ['INLAW'] }),
    ]
    const numbered = assignPersonGenerations(people, 'ROOT')
    const byId = Object.fromEntries(numbered.map((row) => [row.id, row]))
    const layout = buildFamilyTreeLayout(byId, new Set(), 'ROOT')
    const ids = new Set(layout.nodes.map((node) => node.person.id))
    expect(ids.has('INLAW')).toBe(true)
    expect(ids.has('INLAW-PARENT')).toBe(false)
    expect(byId['INLAW-PARENT']?.generation).toBeNull()
  })

  it('includes a new co-root grandparent after GEDCOM import without code changes', () => {
    const coRootId = householdCoRootId(familyDatabase.root, familyDatabase.people)!
    const coRoot = familyDatabase.people.find((row) => row.id === coRootId)!
    const parentId = coRoot.parents?.[0]
    expect(parentId).toBeTruthy()
    if (!parentId) return
    const parent = familyDatabase.people.find((row) => row.id === parentId)!
    const gedcom = buildGedcom(
      [
        {
          id: familyDatabase.root,
          name: 'Root Person',
          sex: 'M',
          birthDate: '1975',
          fams: ['F-HOME'],
        },
        {
          id: coRootId,
          name: coRoot.name,
          sex: 'F',
          birthDate: '1977',
          famc: ['F-COROOT'],
          fams: ['F-HOME'],
        },
        {
          id: parentId,
          name: parent.name,
          sex: parent.sex,
          famc: ['F-GP'],
          fams: ['F-COROOT'],
        },
        { id: 'I-GP-NEW', name: 'Imported Grandparent', sex: 'M', birthDate: '1920', fams: ['F-GP'] },
      ],
      [
        { id: 'F-HOME', husbandId: familyDatabase.root, wifeId: coRootId, children: [] },
        { id: 'F-COROOT', husbandId: parentId, children: [coRootId] },
        { id: 'F-GP', husbandId: 'I-GP-NEW', children: [parentId] },
      ],
    )
    const result = processCandidateGedcom({
      bytes: encoder.encode(gedcom),
      current: currentFamilyGraph(),
      currentRootId: familyDatabase.root,
    })
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    const snapshot = result.snapshot
    const numbered = assignPersonGenerations(snapshot.people, snapshot.root)
    const gp = numbered.find((row) => row.id === 'I-GP-NEW')
    expect(gp?.generation).toBe(2)
    const peopleById = Object.fromEntries(numbered.map((row) => [row.id, row]))
    const layout = buildFamilyTreeLayout(peopleById, new Set(), snapshot.root)
    expect(layout.nodes.some((node) => node.person.id === 'I-GP-NEW')).toBe(true)
  })

  it('builds timeline events for dated co-root ancestors and skips undated ones', () => {
    const people = assignPersonGenerations(
      [
        person({ id: 'ROOT', name: 'Root', birthYear: 1975, spouses: ['SPOUSE'], children: ['CHILD'] }),
        person({
          id: 'SPOUSE',
          name: 'Co Root',
          sex: 'F',
          birthYear: 1977,
          spouses: ['ROOT'],
          children: ['CHILD'],
          parents: ['DATED', 'UNDATED'],
        }),
        person({ id: 'CHILD', name: 'Child', birthYear: 2011, parents: ['ROOT', 'SPOUSE'] }),
        person({
          id: 'DATED',
          name: 'Dated Parent',
          birthYear: 1948,
          birthPlace: 'Oakland, California',
          children: ['SPOUSE'],
          places: ['San Francisco, California'],
        }),
        person({ id: 'UNDATED', name: 'Undated Parent', sex: 'F', children: ['SPOUSE'] }),
      ],
      'ROOT',
    )
    const events = buildFamilyEvents(people)
    expect(events.some((event) => event.person.id === 'DATED' && event.kind === 'birth')).toBe(true)
    expect(events.some((event) => event.person.id === 'UNDATED')).toBe(false)
    const places = buildPlaceIndex(people, events)
    expect(places.some((place) => place.people.some((row) => row.id === 'DATED'))).toBe(true)
    expect(places.some((place) => place.people.some((row) => row.id === 'UNDATED'))).toBe(false)
  })

  it('classifies co-root ancestry on its own lineages, not as leftover other', () => {
    const people = assignPersonGenerations(familyDatabase.people, familyDatabase.root)
    const palette = buildLineagePalette(people, familyDatabase.root)
    const coRootId = householdCoRootId(familyDatabase.root, people)!
    const parentId = people.find((row) => row.id === coRootId)?.parents?.[0]
    expect(parentId).toBeTruthy()
    const parentLines = [...palette.lines].filter((line) => line.personIds.has(parentId!))
    expect(parentLines.some((line) => line.household === 'coRoot')).toBe(true)
    expect(parentLines.some((line) => line.id.startsWith('coRoot'))).toBe(true)
  })

  it('keeps Atlas identity for existing people when a co-root grandparent is added', () => {
    const result = processCandidateGedcom({
      bytes: encoder.encode(
        buildGedcom(
          [
            { id: familyDatabase.root, name: 'Root', sex: 'M', fams: ['F1'] },
            { id: 'I-SPOUSE', name: 'Co Root', sex: 'F', famc: ['F2'], fams: ['F1'] },
            { id: 'I-PARENT', name: 'Parent', sex: 'M', famc: ['F3'], fams: ['F2'] },
            { id: 'I-GP', name: 'Grandparent', sex: 'M', birthDate: '1920', fams: ['F3'] },
          ],
          [
            { id: 'F1', husbandId: familyDatabase.root, wifeId: 'I-SPOUSE' },
            { id: 'F2', husbandId: 'I-PARENT', children: ['I-SPOUSE'] },
            { id: 'F3', husbandId: 'I-GP', children: ['I-PARENT'] },
          ],
        ),
      ),
      current: currentFamilyGraph(),
      currentRootId: familyDatabase.root,
    })
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.snapshot.root).toBe(familyDatabase.root)
    expect(result.snapshot.people.find((row) => row.id === familyDatabase.root)).toBeTruthy()
  })
})
