import { describe, expect, it } from 'vitest'
import type { FamilyDatabase, FamilyEvent, HistoryEvent, Person } from '../../types'
import { selectGuidedChapters } from '../selectGuidedChapters'

function person(partial: Partial<Person> & Pick<Person, 'id' | 'name'>): Person {
  return {
    birthYear: null,
    deathYear: null,
    places: [],
    parents: [],
    spouses: [],
    children: [],
    ...partial,
  }
}

function buildDb(people: Person[], root = people[0]?.id ?? 'root'): FamilyDatabase {
  const years = people.map((p) => p.birthYear).filter((y): y is number => typeof y === 'number')
  return {
    people,
    root,
    stats: {
      people: people.length,
      families: 1,
      earliestYear: years.length ? Math.min(...years) : 1800,
      latestYear: years.length ? Math.max(...years) : 2000,
      earliestName: people[0]?.name ?? '',
      places: [],
      surnames: [],
    },
  }
}

describe('selectGuidedChapters', () => {
  it('builds origins and present from sparse dated people without inventing journeys', () => {
    const people = [
      person({
        id: 'a',
        name: 'Ann Early',
        birthYear: 1520,
        birthPlace: 'Sandbach, Cheshire, England',
      }),
      person({
        id: 'b',
        name: 'Bob Late',
        birthYear: 1980,
        birthPlace: 'Los Angeles, California',
      }),
    ]
    const events: FamilyEvent[] = [
      {
        kind: 'birth',
        year: 1520,
        title: 'Birth of Ann',
        detail: 'Ann Early',
        person: people[0],
        importance: 3,
      },
      {
        kind: 'birth',
        year: 1980,
        title: 'Birth of Bob',
        detail: 'Bob Late',
        person: people[1],
        importance: 2,
      },
    ]
    const chapters = selectGuidedChapters({ database: buildDb(people, 'b'), familyEvents: events })
    expect(chapters.some((c) => c.kind === 'origins')).toBe(true)
    expect(chapters.some((c) => c.kind === 'present')).toBe(true)
    expect(chapters.every((c) => c.narration.length > 20)).toBe(true)
    // No fabricated route when migrations are absent — distribution or skip only.
    const journey = chapters.find((c) => c.kind === 'journeys')
    if (journey?.mapIntent?.type === 'route') {
      throw new Error('expected no invented route without migration segments')
    }
  })

  it('selects a world-in-change chapter only when history overlaps family events', () => {
    const people = [
      person({
        id: 'm',
        name: 'Maria',
        birthYear: 1785,
        birthPlace: 'Chihuahua, Mexico',
      }),
    ]
    const events: FamilyEvent[] = [
      {
        kind: 'birth',
        year: 1785,
        title: 'Birth of Maria',
        detail: 'Maria',
        person: people[0],
        importance: 3,
      },
    ]
    const worldHistory: HistoryEvent[] = [
      {
        year: 1810,
        title: 'Mexican War of Independence',
        country: 'Mexico',
        importance: 3,
        summary: 'Independence struggle begins.',
      },
      {
        year: 1066,
        title: 'Norman Conquest',
        country: 'England',
        importance: 3,
        summary: 'Far from this family window.',
      },
    ]
    const chapters = selectGuidedChapters({
      database: buildDb(people),
      familyEvents: events,
      worldHistory,
    })
    const world = chapters.find((c) => c.kind === 'world_in_change')
    expect(world).toBeTruthy()
    expect(world?.focusHistory?.title).toBe('Mexican War of Independence')
    expect(world?.openHistory).toBeNull()
    expect(world?.highlightPersonIds).toContain('m')
    expect(world?.narration.toLowerCase()).toContain('not proof of participation')
  })

  it('does not name an infant as the personal connection to a historical event', () => {
    const toddler = person({
      id: 'v',
      name: 'Victor Manuel Ruiz',
      birthYear: 1915,
      birthPlace: 'California, USA',
    })
    const adult = person({
      id: 'p',
      name: 'Pedro G Luna',
      birthYear: 1880,
      birthPlace: 'Mexico',
    })
    const events: FamilyEvent[] = [
      {
        kind: 'birth',
        year: 1915,
        title: 'Birth of Victor',
        detail: toddler.name,
        person: toddler,
        importance: 3,
      },
      {
        kind: 'birth',
        year: 1880,
        title: 'Birth of Pedro',
        detail: adult.name,
        person: adult,
        importance: 3,
      },
    ]
    const worldHistory: HistoryEvent[] = [
      {
        year: 1917,
        title: 'United States enters World War I',
        country: 'United States',
        importance: 3,
        summary: 'America enters the war.',
      },
    ]
    const chapters = selectGuidedChapters({
      database: buildDb([toddler, adult], 'v'),
      familyEvents: events,
      worldHistory,
    })
    const world = chapters.find((c) => c.kind === 'world_in_change')
    // Toddler must never be the named subject of WWI.
    expect(world?.highlightPersonIds ?? []).not.toContain('v')
    expect(world?.narration ?? '').not.toMatch(/Victor Manuel Ruiz/)
  })

  it('returns empty chapters when no birth years exist', () => {
    const people = [person({ id: 'x', name: 'Unknown' })]
    const chapters = selectGuidedChapters({
      database: buildDb(people),
      familyEvents: [],
    })
    expect(chapters).toEqual([])
  })

  it('represents multiple regions without naming a single origin surname', () => {
    const people = [
      person({
        id: 'e1',
        name: 'Ellen Bridge',
        birthYear: 1760,
        birthPlace: 'London, England',
      }),
      person({
        id: 'm1',
        name: 'Miguel Rivera',
        birthYear: 1840,
        birthPlace: 'Mexico City, Mexico',
      }),
      person({
        id: 'c1',
        name: 'Clara West',
        birthYear: 1920,
        birthPlace: 'San Francisco, California',
      }),
    ]
    const chapters = selectGuidedChapters({
      database: buildDb(people, 'c1'),
      familyEvents: people.map((p) => ({
        kind: 'birth' as const,
        year: p.birthYear as number,
        title: `Birth of ${p.name}`,
        detail: p.name,
        person: p,
        importance: 2,
      })),
    })
    const branches = chapters.find((c) => c.kind === 'branches')
    expect(branches).toBeTruthy()
    expect(branches?.view).toBe('map')
    expect(branches?.mapIntent?.type).toBe('overview')
    expect(branches?.narration.toLowerCase()).not.toContain('ruiz')
    expect(branches?.focusLabel).toBeTruthy()
  })
})
