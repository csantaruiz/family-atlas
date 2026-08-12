import type { FamilyEvent, Person } from '../types'
import { familyMarriages } from './familyMarriages'
import { featuredNames } from './featuredNames'
import { placeRegion } from '../utils/placeUtils'

const HOUSE_SURNAMES = [
  'Ruiz',
  'Hendry',
  'Santa',
  'Loya',
  'Stubbs',
  'Lowndes',
  'Pinon',
  'Henshaw',
  'Wade',
  'Riley',
]

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

function marriageHouseName(husband: Person, wife: Person): string {
  const tokens = `${husband.name} ${wife.name}`.split(/\s+/)
  const house = HOUSE_SURNAMES.find((surname) =>
    tokens.some((token) => token.toLowerCase() === surname.toLowerCase()),
  )
  return house ?? (lastName(husband.name) || lastName(wife.name) || 'Family')
}

const SPECIAL_EVENTS = [
  {
    name: 'Victor Manuel Ruiz',
    year: 1944,
    title: 'Victor serves in the European air war',
    detail: '388th Bomb Group · wartime service',
  },
  {
    name: 'Edwin Aloysius Hendry',
    year: 1935,
    title: 'Edwin works in industrial America',
    detail: 'Ironwork, rigging and construction',
  },
  {
    name: 'Craig B Ruiz',
    year: 2026,
    title: 'The family archive takes shape',
    detail: 'Research, design and preservation',
  },
] as const

export function buildFamilyEvents(people: Person[]): FamilyEvent[] {
  const events: FamilyEvent[] = []

  people.forEach((p) => {
    if (!p.birthYear) return
    const importance =
      (p.focus ? 5 : 0) +
      (featuredNames.has(p.name) ? 5 : 0) +
      (p.generation != null ? Math.max(0, 4 - Math.min(4, Math.abs(p.generation))) : 0) +
      (p.children?.length ? 1 : 0)

    events.push({
      kind: 'birth',
      year: p.birthYear,
      title: `${p.name} is born`,
      detail: p.birthPlace || 'Birthplace not recorded',
      person: p,
      importance: importance + 1,
    })

    if (p.deathYear) {
      events.push({
        kind: 'death',
        year: p.deathYear,
        title: `The life of ${p.name} closes`,
        detail: p.deathPlace || 'Place not recorded',
        person: p,
        importance,
      })
    }

    const from = placeRegion(p.birthPlace)
    const to = placeRegion(p.deathPlace)
    if (from && to && from !== to && p.deathYear && p.deathYear > p.birthYear + 10) {
      const y = Math.round(p.birthYear + (p.deathYear - p.birthYear) * 0.58)
      events.push({
        kind: 'move',
        year: y,
        title: `${p.name} crosses into ${to}`,
        detail: `From ${from} · approximate placement`,
        person: p,
        importance: importance + 2,
      })
    }
  })

  SPECIAL_EVENTS.forEach(({ name, year, title, detail }) => {
    const person = people.find((x) => x.name === name)
    if (person) {
      events.push({ kind: 'service', year, title, detail, person, importance: 12 })
    }
  })

  const byId = new Map(people.map((person) => [person.id, person]))
  for (const marriage of familyMarriages) {
    const husband = byId.get(marriage.husbandId)
    const wife = byId.get(marriage.wifeId)
    if (!husband || !wife) continue

    const house = marriageHouseName(husband, wife)
    const gen = Math.min(husband.generation ?? 99, wife.generation ?? 99)
    const featured = featuredNames.has(husband.name) || featuredNames.has(wife.name)
    let importance = 4
    if (gen <= 2) importance += 8
    else if (gen <= 4) importance += 5
    else if (gen <= 6) importance += 2
    if (featured) importance += 4
    if (husband.focus || wife.focus) importance += 2

    const place = marriage.place.trim()
    const couple = `${husband.name} · ${wife.name}`
    events.push({
      kind: 'marriage',
      year: marriage.year,
      title: `${house} marriage`,
      detail: place ? `${couple} · ${place}` : couple,
      person: husband,
      spouse: wife,
      importance,
    })
  }

  return events
}
