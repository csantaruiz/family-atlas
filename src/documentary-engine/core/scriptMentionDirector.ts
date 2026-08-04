import transcript from '../data/documentary-transcript.json'
import {
  allCanonicalPlaces,
  getCanonicalPlace,
} from '../data/canonicalPlaceRegistry'
import { CLOSING_STAGE_START_MS } from './finaleCameraPolicy'

type TranscriptSegment = {
  start: number
  end: number
  text: string
}

type PlaceAlias = {
  placeId: string
  text: string
}

const TRANSCRIPT_SEGMENTS: TranscriptSegment[] = transcript.segments ?? []

const PLACE_ALIASES: PlaceAlias[] = (() => {
  const aliasToPlace = new Map<string, string>()

  const registerAlias = (text: string, placeId: string) => {
    const key = text.trim().toLowerCase()
    if (key.length < 3) return

    const place = getCanonicalPlace(placeId)
    if (!place) return

    const existingId = aliasToPlace.get(key)
    if (!existingId) {
      aliasToPlace.set(key, placeId)
      return
    }

    const existing = getCanonicalPlace(existingId)
    if (place.canonicalName.toLowerCase() === key) {
      aliasToPlace.set(key, placeId)
    } else if (existing?.canonicalName.toLowerCase() === key) {
      return
    }
  }

  for (const place of allCanonicalPlaces()) {
    registerAlias(place.canonicalName, place.id)
  }

  for (const place of allCanonicalPlaces()) {
    if (place.locality) registerAlias(place.locality, place.id)
    if (place.gedcomString) {
      for (const part of place.gedcomString.split(',')) {
        registerAlias(part, place.id)
      }
    }
  }

  return [...aliasToPlace.entries()]
    .map(([text, placeId]) => ({ text, placeId }))
    .sort((a, b) => b.text.length - a.text.length)
})()

function segmentStartMs(segment: TranscriptSegment): number {
  return Math.round(segment.start * 1000)
}

function isBoundary(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text[start - 1]! : ' '
  const after = end < text.length ? text[end]! : ' '
  return !/[a-z0-9]/i.test(before) && !/[a-z0-9]/i.test(after)
}

/** Match place names from the canonical registry against narration text. */
export function extractPlaceIdsFromText(text: string): string[] {
  const normalized = text.toLowerCase()
  const occupied = new Array(normalized.length).fill(false)
  const found: string[] = []

  for (const alias of PLACE_ALIASES) {
    const needle = alias.text.toLowerCase()
    let index = normalized.indexOf(needle)

    while (index !== -1) {
      const end = index + needle.length
      if (
        isBoundary(normalized, index, end) &&
        !occupied.slice(index, end).some(Boolean)
      ) {
        found.push(alias.placeId)
        for (let i = index; i < end; i += 1) occupied[i] = true
      }
      index = normalized.indexOf(needle, index + 1)
    }
  }

  return [...new Set(found)]
}

export function resolveLateScriptStartMs(_durationMs: number): number {
  return CLOSING_STAGE_START_MS
}

function segmentsUpTo(timeMs: number): TranscriptSegment[] {
  return TRANSCRIPT_SEGMENTS.filter((segment) => segmentStartMs(segment) <= timeMs)
}

function segmentAt(timeMs: number): TranscriptSegment | null {
  let active: TranscriptSegment | null = null
  for (const segment of TRANSCRIPT_SEGMENTS) {
    if (segmentStartMs(segment) <= timeMs) active = segment
    else break
  }
  return active
}

let cachedFirstMentions: Map<string, number> | null = null

/** First narration time each registry place appears in the script. */
export function resolveFirstMentionTimes(): Map<string, number> {
  if (cachedFirstMentions) return cachedFirstMentions

  const first = new Map<string, number>()
  for (const segment of TRANSCRIPT_SEGMENTS) {
    const timeMs = segmentStartMs(segment)
    for (const placeId of extractPlaceIdsFromText(segment.text)) {
      if (!first.has(placeId)) first.set(placeId, timeMs)
    }
  }

  cachedFirstMentions = first
  return first
}

/** Places whose first script mention falls in the late act and have already been spoken. */
export function resolveLateAddedPlaceIds(timeMs: number, durationMs: number): string[] {
  const lateStartMs = resolveLateScriptStartMs(durationMs)
  const firstMentions = resolveFirstMentionTimes()

  return [...firstMentions.entries()]
    .filter(([_, firstMs]) => firstMs >= lateStartMs && firstMs <= timeMs)
    .sort((a, b) => a[1] - b[1])
    .map(([placeId]) => placeId)
}

/** Places named in the narration line currently being spoken. */
export function resolvePlaceIdsInActiveSegment(timeMs: number): string[] {
  const segment = segmentAt(timeMs)
  if (!segment) return []
  return extractPlaceIdsFromText(segment.text)
}

/** Every place named anywhere in the script — for wide-map framing. */
export function resolveAllScriptPlaceIds(): string[] {
  return [...resolveFirstMentionTimes().keys()].filter((id) => Boolean(getCanonicalPlace(id)))
}

/** @internal */
export function clearScriptMentionCacheForTests(): void {
  cachedFirstMentions = null
}

export { segmentsUpTo }
