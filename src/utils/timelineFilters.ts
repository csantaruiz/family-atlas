import type { FamilyEvent, Person } from '../types'
import type { TimelineFilters } from '../types/timelineFilters'

function isMilitaryServiceEvent(event: FamilyEvent): boolean {
  if (event.kind !== 'service') return false
  const text = `${event.title} ${event.detail}`.toLowerCase()
  return /war|bomb|serve|military|wartime|388th/.test(text)
}

function isOccupationServiceEvent(event: FamilyEvent): boolean {
  if (event.kind !== 'service') return false
  const text = `${event.title} ${event.detail}`.toLowerCase()
  return (
    /ironwork|rigging|construction|industrial|occupation|ironworker/.test(text) ||
    (event.person.occupation?.length ?? 0) > 0
  )
}

function isStoryServiceEvent(event: FamilyEvent): boolean {
  if (event.kind !== 'service') return false
  const text = `${event.title} ${event.detail}`.toLowerCase()
  return /archive|research|preservation|story|design/.test(text)
}

/** Classify a family event for timeline filter categories (extensible for new event kinds). */
export function familyEventFilterCategories(event: FamilyEvent): Set<keyof TimelineFilters> {
  const cats = new Set<keyof TimelineFilters>()
  switch (event.kind) {
    case 'birth':
      cats.add('births')
      break
    case 'death':
      cats.add('deaths')
      break
    case 'move':
      cats.add('migrations')
      break
    case 'service':
      if (isMilitaryServiceEvent(event)) cats.add('military')
      else if (isOccupationServiceEvent(event)) cats.add('occupations')
      else if (isStoryServiceEvent(event)) cats.add('stories')
      else cats.add('stories')
      break
    default:
      break
  }
  return cats
}

export function familyEventPassesFilters(event: FamilyEvent, filters: TimelineFilters): boolean {
  switch (event.kind) {
    case 'birth':
      return filters.births
    case 'death':
      return filters.deaths
    case 'move':
      return filters.migrations
    case 'service':
      if (isMilitaryServiceEvent(event)) return filters.military
      if (isOccupationServiceEvent(event)) return filters.occupations
      if (isStoryServiceEvent(event)) return filters.stories
      return filters.stories
    default:
      return true
  }
}

export function applyFamilyEventFilters(events: FamilyEvent[], filters: TimelineFilters): FamilyEvent[] {
  return events.filter((e) => familyEventPassesFilters(e, filters))
}

export function personPassesBirthFilter(_person: Person, filters: TimelineFilters): boolean {
  return filters.births
}

export function showHistoricalEvents(filters: TimelineFilters): boolean {
  return filters.historicalEvents
}

export function showFeaturedStories(filters: TimelineFilters): boolean {
  return filters.stories
}
