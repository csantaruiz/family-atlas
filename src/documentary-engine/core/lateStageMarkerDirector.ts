import { getCanonicalPlace } from '../data/canonicalPlaceRegistry'
import type { DocumentaryFrame, ResolvedMarker } from '../types/choreography'
import { AUDIO_CAMERA_CUES } from './audioSyncDirector'
import { CLOSING_STAGE_START_MS } from './finaleCameraPolicy'
import {
  resolveFirstMentionTimes,
  resolveLateAddedPlaceIds,
  resolveLateScriptStartMs,
  resolvePlaceIdsInActiveSegment,
} from './scriptMentionDirector'

const LATE_DOT_RAMP_MS = 900
const CONTEXT_MARKER_OPACITY = 0.72

/** Places named in earlier documentary beats — stay visible on the wide closing map. */
const ARC_CONTEXT_PLACE_IDS = [
  ...new Set(
    AUDIO_CAMERA_CUES.map((cue) => cue.placeId).filter((id): id is string => Boolean(id)),
  ),
]

export function isLateDocumentaryStage(timeMs: number, chapter: string): boolean {
  if (chapter === 'Migration' || chapter === 'Convergence' || chapter === 'Enter the Atlas') {
    return true
  }
  return timeMs >= CLOSING_STAGE_START_MS
}

export function shouldShowClosingStoryMarkers(
  timeMs: number,
  chapter: string,
  geographicScale: DocumentaryFrame['geographicScale'],
): boolean {
  if (timeMs >= CLOSING_STAGE_START_MS) return true
  if (!isLateDocumentaryStage(timeMs, chapter)) return false
  return geographicScale === 'world' || geographicScale === 'continental'
}

export function isClosingStoryMap(frame: DocumentaryFrame): boolean {
  if (frame.chapter === 'Convergence' || frame.chapter === 'Enter the Atlas') {
    return true
  }
  return frame.geographicScale === 'world' || frame.geographicScale === 'continental'
}

function opacityForLateDot(firstMentionMs: number, timeMs: number): number {
  const elapsed = timeMs - firstMentionMs
  if (elapsed <= 0) return 0
  if (elapsed >= LATE_DOT_RAMP_MS) return CONTEXT_MARKER_OPACITY
  return (elapsed / LATE_DOT_RAMP_MS) * CONTEXT_MARKER_OPACITY
}

/** Contextual dots for places established before the late act. */
export function resolveArcContextMarkers(activePlaceId?: string): ResolvedMarker[] {
  const lateStartMs = CLOSING_STAGE_START_MS
  const firstMentions = resolveFirstMentionTimes()

  return ARC_CONTEXT_PLACE_IDS.flatMap((placeId) => {
    const firstMs = firstMentions.get(placeId)
    if (firstMs !== undefined && firstMs >= lateStartMs) return []

    const place = getCanonicalPlace(placeId)
    if (!place || place.confidence === 'unresolved') return []

    const active = placeId === activePlaceId
    return [
      {
        id: `arc-${placeId}`,
        placeId,
        x: place.x,
        y: place.y,
        active,
        contextual: !active,
        branch: place.branch,
        opacity: CONTEXT_MARKER_OPACITY,
      },
    ]
  })
}

/** Merge arc dots with late additions — late entries win on duplicate place IDs. */
export function mergeClosingStoryMarkers(
  arcMarkers: ResolvedMarker[],
  lateMarkers: ResolvedMarker[],
): ResolvedMarker[] {
  const byPlace = new Map<string, ResolvedMarker>()
  for (const marker of arcMarkers) byPlace.set(marker.placeId, marker)
  for (const marker of lateMarkers) byPlace.set(marker.placeId, marker)
  return [...byPlace.values()]
}

/** Add one dot per place first named in the late script — accumulates, never replaces arc dots. */
export function resolveLateAddedScriptMarkers(
  timeMs: number,
  durationMs: number,
): ResolvedMarker[] {
  const lateStartMs = resolveLateScriptStartMs(durationMs)
  const activeSegmentPlaces = new Set(resolvePlaceIdsInActiveSegment(timeMs))

  return resolveLateAddedPlaceIds(timeMs, durationMs).flatMap((placeId) => {
    const place = getCanonicalPlace(placeId)
    if (!place || place.confidence === 'unresolved') return []

    const firstMentionMs = resolveFirstMentionTimes().get(placeId) ?? lateStartMs
    const opacity = opacityForLateDot(firstMentionMs, timeMs)
    if (opacity <= 0) return []

    return [
      {
        id: `late-${placeId}`,
        placeId,
        x: place.x,
        y: place.y,
        active: activeSegmentPlaces.has(placeId),
        contextual: !activeSegmentPlaces.has(placeId),
        lateScript: true,
        branch: place.branch,
        opacity,
      },
    ]
  })
}
