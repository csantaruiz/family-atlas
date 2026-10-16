import type { MapSelection } from '../../context/MapExplorationContext'
import type { AtlasThinking, FamilyEvent, HistoryEvent, Person } from '../../types'
import type { LifeJourneyBeat } from '../../types/lifeJourney'
import { canonicalEventId } from '../../utils/canonicalEvent'
import type { SoundtrackFocus } from '../context/resolveSoundtrackContext'

const MAX_PLACES = 24

function personPlaces(person: Person): string[] {
  return [person.birthPlace, ...(person.places ?? []), person.deathPlace].filter(
    (place): place is string => Boolean(place?.trim()),
  )
}

export function ancestorFocus(person: Person): SoundtrackFocus {
  return {
    kind: 'ancestor',
    id: `person:${person.id}`,
    year: person.birthYear ?? person.deathYear ?? null,
    yearEnd: person.deathYear ?? null,
    places: personPlaces(person),
  }
}

export function familyEventFocus(event: FamilyEvent): SoundtrackFocus {
  return {
    kind: event.kind === 'move' ? 'migration' : 'family_event',
    id: `event:${canonicalEventId(event)}`,
    year: event.year,
    places: personPlaces(event.person),
    eventKind: event.kind,
    text: event.title,
  }
}

export function historyFocus(event: HistoryEvent): SoundtrackFocus {
  return {
    kind: 'historical_event',
    id: `history:${event.year}:${event.title}`,
    year: event.year,
    places: [event.country],
    text: event.title,
  }
}

export function insightFocus(thinking: AtlasThinking, peopleById: Record<string, Person>): SoundtrackFocus {
  return {
    kind: 'insight',
    id: `insight:${thinking.id}`,
    year: thinking.yearStart,
    yearEnd: thinking.yearEnd,
    places: thinking.relatedPersonIds
      .flatMap((id) => (peopleById[id] ? personPlaces(peopleById[id]) : []))
      .slice(0, MAX_PLACES),
  }
}

export function journeyBeatFocus(personId: string, beat: LifeJourneyBeat): SoundtrackFocus {
  return {
    kind: beat.type === 'move' ? 'migration' : 'family_event',
    id: `beat:${personId}:${beat.id}`,
    year: beat.year,
    places: beat.locationLabel ? [beat.locationLabel] : [],
    eventKind: beat.type,
    text: beat.title,
  }
}

export function mapSelectionFocus(selection: MapSelection): SoundtrackFocus | null {
  if (!selection) return null
  switch (selection.type) {
    case 'region':
    case 'subregion': {
      const area = selection.type === 'region' ? selection.region : selection.subregion
      return {
        kind: 'region',
        id: `${selection.type}:${area.id}`,
        year: area.yearMin,
        yearEnd: area.yearMax,
        places: area.places.slice(0, MAX_PLACES).map((place) => place.name),
      }
    }
    case 'place':
      return {
        kind: 'region',
        id: `place:${selection.place.id}`,
        year: selection.place.yearMin,
        yearEnd: selection.place.yearMax,
        places: [selection.place.name],
      }
    case 'route':
    case 'subroute':
      return {
        kind: 'migration',
        id: `${selection.type}:${selection.route.id}`,
        year: selection.route.yearMin,
        yearEnd: selection.route.yearMax,
        places: selection.route.segments
          .flatMap((segment) => [segment.from, segment.to])
          .slice(0, MAX_PLACES),
      }
  }
}

/** Relocation share and representative places for family events inside a year window. */
export function summariseWindow(
  events: readonly FamilyEvent[],
  start: number,
  end: number,
): { migrationShare: number | null; places: string[] } {
  let total = 0
  let moves = 0
  const places: string[] = []
  for (const event of events) {
    if (event.year < start || event.year > end) continue
    total += 1
    if (event.kind === 'move') moves += 1
    if (places.length < MAX_PLACES * 2) {
      const place = event.kind === 'death' ? event.person.deathPlace : event.person.birthPlace
      if (place) places.push(place)
    }
  }
  return { migrationShare: total >= 4 ? moves / total : null, places }
}
