import type { AtlasThinking, AtlasThinkingConfidence, FamilyDatabase, FamilyEvent, Person } from '../types'
import { placeRegion } from './placeUtils'
import { zoomMode } from './timelineMath'

type BuildAtlasThinkingInput = {
  people: Person[]
  events: FamilyEvent[]
  start: number
  end: number
  span: number
  center: number
  presentYear: number
  stats: FamilyDatabase['stats']
}

function confidenceFor(count: number): AtlasThinkingConfidence {
  if (count >= 10) return 'High'
  if (count >= 4) return 'Medium'
  return 'Low'
}

function surnameOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? name
}

function peopleOverlappingWindow(people: Person[], start: number, end: number): Person[] {
  return people.filter((person) => {
    if (!person.birthYear) return false
    const lifeEnd = person.deathYear ?? person.birthYear + 88
    return person.birthYear <= end && lifeEnd >= start
  })
}

function eventsInWindow(events: FamilyEvent[], start: number, end: number): FamilyEvent[] {
  return events.filter((event) => event.year >= start && event.year <= end)
}

function relatedIds(people: Person[], limit = 8): string[] {
  return people.slice(0, limit).map((person) => person.id)
}

function pushUnique(observations: AtlasThinking[], candidate: AtlasThinking | null): void {
  if (!candidate) return
  if (observations.some((item) => item.id === candidate.id)) return
  observations.push(candidate)
}

function longestEventGap(events: FamilyEvent[]): number {
  if (events.length < 2) return 0
  const sorted = [...events].sort((a, b) => a.year - b.year)
  let longest = 0
  for (let i = 1; i < sorted.length; i++) {
    longest = Math.max(longest, sorted[i].year - sorted[i - 1].year)
  }
  return longest
}

function topPlaceInWindow(people: Person[]): { label: string; count: number } | null {
  const counts = new Map<string, number>()
  for (const person of people) {
    for (const place of [person.birthPlace, person.deathPlace, ...(person.places ?? [])]) {
      if (!place) continue
      const region = placeRegion(place) || place.split(',').pop()?.trim() || place
      if (!region) continue
      counts.set(region, (counts.get(region) ?? 0) + 1)
    }
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
  if (!ranked[0] || ranked[0][1] < 3) return null
  return { label: ranked[0][0], count: ranked[0][1] }
}

function topSurnameInWindow(people: Person[]): { label: string; count: number } | null {
  const counts = new Map<string, number>()
  for (const person of people) {
    const surname = surnameOf(person.name)
    counts.set(surname, (counts.get(surname) ?? 0) + 1)
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
  if (!ranked[0] || ranked[0][1] < 4) return null
  return { label: ranked[0][0], count: ranked[0][1] }
}

function migrationArc(events: FamilyEvent[]): { from: string; to: string; count: number } | null {
  const moves = events.filter((event) => event.kind === 'move')
  if (moves.length < 2) return null

  const arcs = new Map<string, number>()
  for (const move of moves) {
    const from = placeRegion(move.detail.replace(/^From\s+/i, '').split('·')[0]?.trim() ?? '')
    const to = placeRegion(move.person.deathPlace || move.person.places?.at(-1) || '')
    if (!from || !to || from === to) continue
    const key = `${from}|${to}`
    arcs.set(key, (arcs.get(key) ?? 0) + 1)
  }

  const ranked = [...arcs.entries()].sort((a, b) => b[1] - a[1])
  if (!ranked[0] || ranked[0][1] < 2) return null
  const [from, to] = ranked[0][0].split('|')
  return { from, to, count: ranked[0][1] }
}

function countByRegion(people: Person[], region: string): number {
  return people.filter((person) =>
    [person.birthPlace, person.deathPlace, ...(person.places ?? [])].some(
      (place) => placeRegion(place) === region,
    ),
  ).length
}

export function buildAtlasThinkingObservations({
  people,
  events,
  start,
  end,
  span,
  center,
  presentYear,
  stats,
}: BuildAtlasThinkingInput): AtlasThinking[] {
  const mode = zoomMode(span)
  const windowPeople = peopleOverlappingWindow(people, start, end)
  const windowEvents = eventsInWindow(events, start, end)
  const observations: AtlasThinking[] = []

  if (windowPeople.length === 0 && windowEvents.length === 0) return observations

  const births = windowEvents.filter((event) => event.kind === 'birth')
  const deaths = windowEvents.filter((event) => event.kind === 'death')
  const relatedPeople = windowPeople.length ? windowPeople : windowEvents.map((event) => event.person)
  const personIds = relatedIds(relatedPeople, 10)
  const recordCount = Math.max(windowPeople.length, windowEvents.length)

  if (end >= presentYear - 20 && span <= 120) {
    const recent = people.filter(
      (person) => person.birthYear && person.birthYear >= presentYear - 55,
    )
    pushUnique(observations, {
      id: `viewport-living-edge-${Math.round(start)}`,
      observation:
        'The living generation compresses recent memory into a narrow band at the timeline edge.',
      recordCount: Math.max(3, recent.length),
      confidence: recent.length >= 4 ? 'High' : 'Medium',
      relatedPersonIds: relatedIds(recent, 6),
      relatedEventIds: [],
      yearStart: Math.max(start, presentYear - 60),
      yearEnd: end,
      evidenceSummary: `Documented facts: ${recent.length} people in the archive were born since ${presentYear - 55}, anchoring the present end of the family record.`,
    })
  }

  if (start <= stats.earliestYear + 90 && stats.earliestYear <= end) {
    pushUnique(observations, {
      id: `viewport-earliest-thread-${Math.round(start)}`,
      observation: `At the far edge of memory, ${stats.earliestName} opens a trail that still runs through this atlas.`,
      recordCount: Math.max(
        3,
        windowPeople.filter((person) => (person.birthYear ?? 9999) <= stats.earliestYear + 80).length,
      ),
      confidence: 'Medium',
      relatedPersonIds: personIds,
      relatedEventIds: [],
      yearStart: stats.earliestYear,
      yearEnd: Math.min(end, stats.earliestYear + 120),
      evidenceSummary: `Documented facts: ${stats.earliestName} (b. ${stats.earliestYear}) is the earliest dated life in the GEDCOM. ${recordCount} records overlap this opening century in view.`,
    })
  }

  const topPlace = topPlaceInWindow(windowPeople)
  if (topPlace && (mode === 'decades' || mode === 'years' || mode === 'generations')) {
    pushUnique(observations, {
      id: `viewport-place-${topPlace.label.toLowerCase().replace(/\s+/g, '-')}-${Math.round(start)}`,
      observation: `${topPlace.label} anchors this chapter—${topPlace.count} lives touch it within these years.`,
      recordCount: topPlace.count,
      confidence: confidenceFor(topPlace.count),
      relatedPersonIds: personIds,
      relatedEventIds: [],
      yearStart: start,
      yearEnd: end,
      evidenceSummary: `Documented facts: ${topPlace.count} people in the current window list ${topPlace.label} among their birth places, residences, or death places.`,
    })
  }

  const topSurname = topSurnameInWindow(windowPeople)
  if (topSurname) {
    pushUnique(observations, {
      id: `viewport-surname-${topSurname.label.toLowerCase()}-${Math.round(start)}`,
      observation: `The ${topSurname.label} line runs through this period—${topSurname.count} documented lives in view.`,
      recordCount: topSurname.count,
      confidence: confidenceFor(topSurname.count),
      relatedPersonIds: personIds,
      relatedEventIds: [],
      yearStart: start,
      yearEnd: end,
      evidenceSummary: `Documented facts: ${topSurname.count} people sharing the ${topSurname.label} surname overlap the visible ${Math.round(span)}-year window.`,
    })
  }

  const arc = migrationArc(windowEvents)
  if (arc && (mode === 'centuries' || mode === 'eras' || mode === 'generations')) {
    pushUnique(observations, {
      id: `viewport-migration-${arc.from.toLowerCase()}-${arc.to.toLowerCase()}-${Math.round(start)}`,
      observation: `Movement here follows a corridor from ${arc.from} toward ${arc.to}—not isolated jumps, but a repeated direction.`,
      recordCount: Math.max(arc.count + 2, windowEvents.filter((event) => event.kind === 'move').length),
      confidence: confidenceFor(arc.count + 2),
      relatedPersonIds: personIds,
      relatedEventIds: [],
      yearStart: start,
      yearEnd: end,
      evidenceSummary: `Documented facts: ${arc.count} migration records in this window move from ${arc.from} toward ${arc.to}, alongside ${windowEvents.filter((event) => event.kind === 'move').length} total place changes.`,
    })
  }

  const mexicoCount = countByRegion(windowPeople, 'Mexico')
  if (mexicoCount >= 4 && center >= 1750) {
    pushUnique(observations, {
      id: `viewport-mexico-${Math.round(start)}`,
      observation:
        'Northern Mexico becomes a second homeland in this chapter—names that vanish from one map reappear in Chihuahua.',
      recordCount: mexicoCount,
      confidence: confidenceFor(mexicoCount),
      relatedPersonIds: personIds,
      relatedEventIds: [],
      yearStart: Math.max(start, 1740),
      yearEnd: end,
      evidenceSummary: `Documented facts: ${mexicoCount} people in the current window carry Mexican places such as Chihuahua, Santa Isabel, or Rosales in the GEDCOM.`,
    })
  }

  const californiaCount = countByRegion(windowPeople, 'United States')
  if (
    californiaCount >= 5 &&
    center >= 1850 &&
    windowPeople.some((person) =>
      [person.birthPlace, person.deathPlace, ...(person.places ?? [])].some((place) =>
        /california/i.test(place ?? ''),
      ),
    )
  ) {
    const caCount = windowPeople.filter((person) =>
      [person.birthPlace, person.deathPlace, ...(person.places ?? [])].some((place) =>
        /california/i.test(place ?? ''),
      ),
    ).length
    pushUnique(observations, {
      id: `viewport-california-${Math.round(start)}`,
      observation:
        'California enters the family story here—the Pacific coast gathers generations in a single reach of years.',
      recordCount: caCount,
      confidence: confidenceFor(caCount),
      relatedPersonIds: personIds,
      relatedEventIds: [],
      yearStart: Math.max(start, 1865),
      yearEnd: end,
      evidenceSummary: `Documented facts: ${caCount} people in this window list California places, marking the family's arrival and settlement on the Pacific coast.`,
    })
  }

  const gap = longestEventGap(windowEvents)
  if (gap >= 35 && windowEvents.length <= 8 && span >= 40) {
    pushUnique(observations, {
      id: `viewport-gap-${Math.round(start)}`,
      observation: `The archive grows quiet across these decades—only ${windowEvents.length} facts bridge a ${gap}-year hush.`,
      recordCount: windowEvents.length,
      confidence: windowEvents.length >= 4 ? 'Medium' : 'Low',
      relatedPersonIds: personIds,
      relatedEventIds: [],
      yearStart: start,
      yearEnd: end,
      evidenceSummary: `Documented facts: ${windowEvents.length} dated events appear in this ${Math.round(span)}-year window, with the longest gap between them spanning ${gap} years.`,
    })
  }

  if (births.length >= 4 && births.length / Math.max(1, span) > 0.08 && span <= 90) {
    pushUnique(observations, {
      id: `viewport-birth-surge-${Math.round(start)}`,
      observation: `${births.length} births arrive in just ${Math.round(span)} years—a concentrated burst of new life in the record.`,
      recordCount: births.length,
      confidence: confidenceFor(births.length),
      relatedPersonIds: relatedIds(
        births.map((event) => event.person),
        8,
      ),
      relatedEventIds: [],
      yearStart: start,
      yearEnd: end,
      evidenceSummary: `Documented facts: ${births.length} birth events fall within the visible ${Math.round(span)}-year span, a higher density than the surrounding archive.`,
    })
  }

  if (deaths.length >= 3 && deaths.length > births.length * 1.2 && span <= 80) {
    pushUnique(observations, {
      id: `viewport-death-weight-${Math.round(start)}`,
      observation:
        'Deaths outnumber births in this window—the record here remembers endings more than beginnings.',
      recordCount: deaths.length + births.length,
      confidence: confidenceFor(deaths.length + births.length),
      relatedPersonIds: personIds,
      relatedEventIds: [],
      yearStart: start,
      yearEnd: end,
      evidenceSummary: `Documented facts: ${deaths.length} deaths and ${births.length} births appear in this view, suggesting a closing or transitional generation.`,
    })
  }

  const generations = new Set(
    windowPeople.map((person) => person.generation).filter((gen): gen is number => gen != null),
  )
  if (generations.size >= 4 && mode !== 'years') {
    pushUnique(observations, {
      id: `viewport-generations-${Math.round(start)}`,
      observation: `${generations.size} generations overlap in a single glance—a deep stack of kin within one reach of the timeline.`,
      recordCount: windowPeople.length,
      confidence: confidenceFor(windowPeople.length),
      relatedPersonIds: personIds,
      relatedEventIds: [],
      yearStart: start,
      yearEnd: end,
      evidenceSummary: `Documented facts: ${windowPeople.length} people across ${generations.size} numbered generations overlap the current ${Math.round(span)}-year window.`,
    })
  }

  if (mode === 'centuries' || mode === 'eras') {
    const england = countByRegion(windowPeople, 'England')
    const mexico = countByRegion(windowPeople, 'Mexico')
    if (england >= 3 && mexico >= 3) {
      pushUnique(observations, {
        id: `viewport-atlas-span-${Math.round(start)}`,
        observation:
          'England and Mexico still bookend this family—an atlas wide enough for an ocean and a desert between.',
        recordCount: england + mexico,
        confidence: 'High',
        relatedPersonIds: personIds,
        relatedEventIds: [],
        yearStart: start,
        yearEnd: end,
        evidenceSummary: `Documented facts: ${england} people touch England and ${mexico} touch Mexico within this ${Math.round(span)}-year panoramic view.`,
      })
    }
  }

  if (observations.length === 0 && recordCount > 0) {
    observations.push({
      id: `viewport-summary-${Math.round(start)}-${Math.round(end)}`,
      observation: `${recordCount} lives and turning points fall within this ${Math.round(span)}-year window of the archive.`,
      recordCount,
      confidence: confidenceFor(recordCount),
      relatedPersonIds: personIds,
      relatedEventIds: [],
      yearStart: start,
      yearEnd: end,
      evidenceSummary: `Documented facts: ${windowPeople.length} people and ${windowEvents.length} dated events overlap the years ${Math.round(start)}–${Math.round(end)} in the GEDCOM.`,
    })
  }

  return observations
}
