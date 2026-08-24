import type { FamilyDatabase, Person } from '../../types'
import type { FamilyGraph, GedcomPerson } from '../types'
import { assignPersonGenerations } from '../assignGenerations'

export type FamilySnapshot = FamilyDatabase & {
  marriages: FamilyGraph['marriages']
}

function surname(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts[parts.length - 1] ?? name
}

function countMap(values: string[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const value of values) {
    const key = value.trim()
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

export function snapshotPerson(person: GedcomPerson, rootId: string): Person {
  return {
    id: person.id,
    name: person.name,
    sex: person.sex || undefined,
    birthDate: person.birthDate,
    birthYear: person.birthYear,
    birthPlace: person.birthPlace,
    deathDate: person.deathDate,
    deathYear: person.deathYear,
    deathPlace: person.deathPlace,
    generation: null,
    focus: person.id === rootId,
    occupation: [],
    places: [...person.places],
    parents: [...person.parents],
    spouses: [...person.spouses],
    children: [...person.children],
    nameSource: person.nameSource,
  }
}

export function chooseSnapshotRoot(candidate: FamilyGraph, currentRootId: string): string {
  if (candidate.people.some((person) => person.id === currentRootId)) return currentRootId
  return candidate.people[0]?.id ?? currentRootId
}

export function familySnapshotFromGraph(candidate: FamilyGraph, currentRootId: string): FamilySnapshot {
  const root = chooseSnapshotRoot(candidate, currentRootId)
  const people = assignPersonGenerations(
    candidate.people.map((person) => snapshotPerson(person, root)),
    root,
  )
  const years = people
    .map((person) => person.birthYear)
    .filter((year): year is number => typeof year === 'number')
  const earliestYear = years.length ? Math.min(...years) : 0
  const latestYear = years.length ? Math.max(...years) : 0
  const earliest = people.find((person) => person.birthYear === earliestYear)

  const placeTokens: string[] = []
  for (const person of people) {
    for (const place of [person.birthPlace, person.deathPlace, ...(person.places ?? [])]) {
      if (!place) continue
      const last = place.split(',').map((part) => part.trim()).filter(Boolean).pop()
      if (last) placeTokens.push(last)
    }
  }

  return {
    people,
    root,
    stats: {
      people: people.length,
      families: candidate.families.length,
      earliestYear,
      latestYear,
      earliestName: earliest?.name ?? '',
      places: countMap(placeTokens).slice(0, 12),
      surnames: countMap(people.map((person) => surname(person.name))).slice(0, 12),
    },
    marriages: candidate.marriages,
  }
}
