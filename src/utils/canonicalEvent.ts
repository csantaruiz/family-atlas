import type { FamilyEvent } from '../types'
import { placeRegion } from './placeUtils'

function normalizedPlace(event: FamilyEvent): string {
  const raw =
    event.kind === 'death'
      ? event.person.deathPlace || event.detail
      : event.kind === 'birth'
        ? event.person.birthPlace || event.detail
        : event.detail || event.person.birthPlace || event.person.deathPlace || ''
  const region = placeRegion(raw)
  return (region || raw || 'unknown')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Stable canonical identity: personId:eventType:year:place */
export function canonicalEventId(event: FamilyEvent): string {
  return `${event.person.id}:${event.kind}:${event.year}:${normalizedPlace(event)}`
}

function eventRichness(event: FamilyEvent): number {
  let score = 0
  if (event.detail && event.detail !== 'Birthplace not recorded' && event.detail !== 'Place not recorded') {
    score += 3
  }
  if (event.person.birthPlace) score += 1
  if (event.person.deathPlace) score += 1
  if (event.title) score += 1
  score += event.importance ?? 0
  if (event.person.focus) score += 2
  return score
}

/** Deduplicate by canonical ID — keep the richest record, preserve deterministic order. */
export function dedupeFamilyEvents(events: FamilyEvent[]): FamilyEvent[] {
  const map = new Map<string, FamilyEvent>()

  for (const event of events) {
    const id = canonicalEventId(event)
    const existing = map.get(id)
    if (!existing || eventRichness(event) > eventRichness(existing)) {
      map.set(id, event)
    }
  }

  return [...map.values()].sort(
    (a, b) => a.year - b.year || canonicalEventId(a).localeCompare(canonicalEventId(b)),
  )
}

export function assertNoDuplicateEvents(
  events: FamilyEvent[],
  source: string,
): void {
  const isDev =
    typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true
  if (!isDev) return

  const counts = new Map<string, number>()
  for (const event of events) {
    const id = canonicalEventId(event)
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  const duplicates = [...counts.entries()].filter(([, count]) => count > 1)
  if (!duplicates.length) return

  for (const [id, count] of duplicates) {
    console.warn(
      `[Atlas] Duplicate canonical event ID (${count}x) in ${source}: ${id}`,
    )
  }
}
