import type { FamilyEvent, Person } from '../types'
import { placeRegion } from './placeUtils'
import { coordinateDistance, resolvePlaceCoordinate } from '../data/placeCoordinates'

export type PersonSortKey = 'birthYear' | 'surname' | 'lifespan' | 'generation'

export type PeopleFilters = {
  query: string
  branch: string
  place: string
  century: string
  directAncestorsOnly: boolean
}

export const DEFAULT_PEOPLE_FILTERS: PeopleFilters = {
  query: '',
  branch: '',
  place: '',
  century: '',
  directAncestorsOnly: false,
}

export function surnameOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? ''
}

export function relationshipToCraig(person: Person): string | null {
  if (person.generation == null) return null
  if (person.generation === 0) return 'Craig'
  if (person.generation === 1) return 'Parent of Craig'
  if (person.generation === 2) return 'Grandparent of Craig'
  return `${person.generation} generations before Craig`
}

export function lifespanYears(person: Person): number | null {
  if (!person.birthYear) return null
  const end = person.deathYear ?? null
  if (end == null) return null
  return end - person.birthYear
}

export function primaryLocations(person: Person): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of [person.birthPlace, person.deathPlace, ...(person.places ?? [])]) {
    const p = raw?.trim()
    if (!p || seen.has(p)) continue
    seen.add(p)
    out.push(p)
    if (out.length >= 3) break
  }
  return out
}

export function centuryOf(year: number | null | undefined): string {
  if (year == null) return ''
  const c = Math.floor(year / 100) + 1
  const suffix = c % 10 === 1 && c % 100 !== 11 ? 'st' : c % 10 === 2 && c % 100 !== 12 ? 'nd' : c % 10 === 3 && c % 100 !== 13 ? 'rd' : 'th'
  return `${c}${suffix} century`
}

export function eventSummaryForPerson(person: Person, events: FamilyEvent[]): string {
  const mine = events.filter((e) => e.person.id === person.id)
  if (!mine.length) {
    if (person.birthYear) return `Born ${person.birthYear}${person.birthPlace ? ` · ${shortPlace(person.birthPlace)}` : ''}`
    return 'No dated events in the archive'
  }
  const kinds = new Set(mine.map((e) => e.kind))
  const parts: string[] = []
  if (kinds.has('birth')) parts.push('birth recorded')
  if (kinds.has('death')) parts.push('death recorded')
  if (kinds.has('move')) parts.push('migration noted')
  if (kinds.has('service')) parts.push('service event')
  const span =
    mine.length > 1
      ? `${Math.min(...mine.map((e) => e.year))}–${Math.max(...mine.map((e) => e.year))}`
      : String(mine[0].year)
  return `${parts.join(', ')} · ${span}`
}

function shortPlace(place: string): string {
  return place.split(',').slice(0, 2).join(',').trim()
}

export function filterPeople(people: Person[], filters: PeopleFilters): Person[] {
  const q = filters.query.trim().toLowerCase()
  return people.filter((p) => {
    if (filters.directAncestorsOnly && p.generation == null) return false
    if (filters.branch && surnameOf(p.name) !== filters.branch) return false
    if (filters.place) {
      const regions = primaryLocations(p).map((pl) => placeRegion(pl) || pl)
      const match =
        regions.some((r) => r === filters.place) ||
        primaryLocations(p).some((pl) => pl.includes(filters.place))
      if (!match) return false
    }
    if (filters.century && p.birthYear != null) {
      const c = Math.floor(p.birthYear / 100) + 1
      if (String(c) !== filters.century) return false
    }
    if (q) {
      const hay = [
        p.name,
        p.birthPlace,
        p.deathPlace,
        p.birthYear,
        p.deathYear,
        surnameOf(p.name),
        ...(p.occupation ?? []),
        ...(p.places ?? []),
      ]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export function sortPeople(people: Person[], key: PersonSortKey): Person[] {
  const arr = [...people]
  arr.sort((a, b) => {
    switch (key) {
      case 'surname':
        return surnameOf(a.name).localeCompare(surnameOf(b.name)) || (a.birthYear ?? 9999) - (b.birthYear ?? 9999)
      case 'lifespan': {
        const la = lifespanYears(a) ?? -1
        const lb = lifespanYears(b) ?? -1
        return lb - la || (a.birthYear ?? 9999) - (b.birthYear ?? 9999)
      }
      case 'generation': {
        const ga = a.generation ?? 999
        const gb = b.generation ?? 999
        return ga - gb || (a.birthYear ?? 9999) - (b.birthYear ?? 9999)
      }
      case 'birthYear':
      default:
        return (a.birthYear ?? 9999) - (b.birthYear ?? 9999)
    }
  })
  return arr
}

export type NotableLife = {
  id: string
  label: string
  person: Person
  detail: string
}

export function computeNotableLives(people: Person[], events: FamilyEvent[]): NotableLife[] {
  const notable: NotableLife[] = []

  const withLifespan = people.filter((p) => lifespanYears(p) != null) as Person[]
  if (withLifespan.length) {
    const longest = withLifespan.reduce((best, p) =>
      (lifespanYears(p) ?? 0) > (lifespanYears(best) ?? 0) ? p : best,
    )
    notable.push({
      id: 'longest',
      label: 'Longest documented lifespan',
      person: longest,
      detail: `${lifespanYears(longest)} years (${longest.birthYear}–${longest.deathYear})`,
    })
  }

  const withBirth = people.filter((p) => p.birthYear != null)
  if (withBirth.length) {
    const earliest = withBirth.reduce((best, p) => ((p.birthYear ?? 9999) < (best.birthYear ?? 9999) ? p : best))
    notable.push({
      id: 'earliest',
      label: 'Earliest documented person',
      person: earliest,
      detail: `Birth recorded ${earliest.birthYear}${earliest.birthPlace ? ` · ${shortPlace(earliest.birthPlace)}` : ''}`,
    })
  }

  let bestMigration: { person: Person; distance: number; from: string; to: string } | null = null
  for (const p of people) {
    const places = (p.places ?? []).filter(Boolean)
    if (places.length < 2) continue
    const fromCoord = resolvePlaceCoordinate(places[0])
    const toCoord = resolvePlaceCoordinate(places[places.length - 1])
    if (!fromCoord.resolved || !toCoord.resolved) continue
    const dist = coordinateDistance(fromCoord, toCoord)
    if (!bestMigration || dist > bestMigration.distance) {
      bestMigration = { person: p, distance: dist, from: places[0], to: places[places.length - 1] }
    }
  }
  if (bestMigration) {
    notable.push({
      id: 'migration',
      label: 'Largest documented move',
      person: bestMigration.person,
      detail: `${shortPlace(bestMigration.from)} → ${shortPlace(bestMigration.to)}`,
    })
  }

  const serviceEvents = events.filter((e) => e.kind === 'service')
  for (const e of serviceEvents.slice(0, 2)) {
    notable.push({
      id: `service-${e.person.id}`,
      label: 'Military or service record',
      person: e.person,
      detail: `${e.year} · ${e.title}`,
    })
  }

  const withOccupation = people.filter((p) => (p.occupation?.length ?? 0) > 0)
  if (withOccupation.length) {
    const occ = withOccupation[0]
    notable.push({
      id: 'occupation',
      label: 'Notable occupation on record',
      person: occ,
      detail: occ.occupation!.join(', '),
    })
  }

  return notable
}

/** Plain-language intro for the Notable lives callout on the People page. */
export function notableLivesIntro(notable: NotableLife[]): string {
  const reasons: string[] = []

  if (notable.some((entry) => entry.id === 'longest')) {
    reasons.push('the longest verified lifespan')
  }
  if (notable.some((entry) => entry.id === 'earliest')) {
    reasons.push('the earliest documented birth')
  }
  if (notable.some((entry) => entry.id === 'migration')) {
    reasons.push('the farthest move between recorded places')
  }
  if (notable.some((entry) => entry.id.startsWith('service'))) {
    reasons.push('military or service events preserved in the GEDCOM')
  }
  if (notable.some((entry) => entry.id === 'occupation')) {
    reasons.push('occupations written into the source records')
  }

  if (!reasons.length) return ''

  const joined =
    reasons.length === 1
      ? reasons[0]
      : `${reasons.slice(0, -1).join(', ')}, and ${reasons[reasons.length - 1]}`

  return `These names are chosen automatically from the archive—not hand-picked. Each card marks one person who holds ${joined}. The label on the card states the distinction; open it to read that life in full.`
}

export function branchOptions(surnames: [string, number][]): string[] {
  return surnames.map(([s]) => s)
}

export function placeFilterOptions(statsPlaces: [string, number][]): string[] {
  return statsPlaces.map(([p]) => p)
}

export function centuryOptions(people: Person[]): { value: string; label: string }[] {
  const centuries = new Set<number>()
  people.forEach((p) => {
    if (p.birthYear != null) centuries.add(Math.floor(p.birthYear / 100) + 1)
  })
  return [...centuries]
    .sort((a, b) => a - b)
    .map((c) => ({ value: String(c), label: centuryOf((c - 1) * 100 + 50) }))
}
