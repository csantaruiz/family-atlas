import type { FamilyEvent, StoryChapter } from '../types'
import { canonicalEventId } from './canonicalEvent'
import type { SemanticZoomMode } from './semanticZoom'
import { chapterDensity, MIN_VIEWPORT_EVENTS, type ChapterDensity } from './semanticZoom'
import {
  effectiveLabelNudge,
  footprintBounds,
  measureDetailedFootprint,
  stemIntersectsBox,
  type LabelAlignment,
} from './labelMeasure'
import { DETAIL_NUDGES } from './detailPlacement'
import {
  getStableLandmarkPlacement,
  landmarkStabilityKey,
  rememberStableLandmarkPlacement,
  type StableLandmarkPlacement,
} from './landmarkSelectionStability'
import { yearX } from './timelineMath'
import {
  chapterCenterX,
  computeEraBraceGeometry,
  estimateCardFrameHeight,
  resolveChapterVerticalLayout,
  visibleTimelineViewport,
} from './chapterCalloutLayout'
import { getCalloutLayoutProfile } from './chapterPresentation'
import {
  LANDMARK_DEBUG,
  reportLandmarkDebug,
  type LandmarkDebugSnapshot,
  type TemporalZone,
} from './landmarkDebug'

export type { TemporalZone }

export type CollisionObstacle = {
  left: number
  right: number
  top: number
  bottom: number
}

export type CalloutObstacles = {
  frame: CollisionObstacle
  connector: CollisionObstacle
  brace?: CollisionObstacle | null
}

export type HybridPlacedEvent = {
  event: FamilyEvent
  x: number
  y: number
  alignment: LabelAlignment
  nudge: number
  compact: boolean
  lane: number
}

const HYBRID_LANE_OFFSETS = [48, 92, 136, 180]
const HYBRID_MAX_LANES = 4
const HYBRID_H_GAP = 22
const HYBRID_V_GAP = 12

const DIVERSITY_KIND_ORDER: FamilyEvent['kind'][] = ['service', 'move', 'birth', 'death']

const ZONE_LEFT_MAX = 0.33
const ZONE_CENTER_MAX = 0.66

/** Temporal bucket counts by semantic zoom mode. */
export function temporalBucketCount(
  mode: SemanticZoomMode,
  span: number,
  eventCount: number,
): number {
  if (mode === 'far') {
    return Math.min(6, Math.max(4, Math.round(span / 90)))
  }
  if (mode === 'medium') {
    return Math.min(8, Math.max(5, Math.round(span / 22)))
  }
  if (mode === 'near') {
    const density = eventCount / Math.max(1, span)
    if (density >= 0.6) return Math.min(10, Math.max(8, Math.round(span / 6)))
    return Math.min(8, Math.max(6, Math.round(span / 10)))
  }
  return Math.max(4, Math.round(span / 4))
}

/** Target visible landmark count for the viewport hybrid layer. */
export function targetVisibleEventCount(
  density: ChapterDensity,
  mode: SemanticZoomMode,
  available: number,
): number {
  const caps: Record<ChapterDensity, { far: number; medium: number; near: number }> = {
    sparse: { far: 4, medium: 6, near: 6 },
    moderate: { far: 4, medium: 7, near: 8 },
    dense: { far: 4, medium: 5, near: 6 },
    very_dense: { far: 4, medium: 4, near: 5 },
  }

  if (mode === 'detail') return available
  const limit = caps[density][mode]
  return Math.min(available, Math.max(MIN_VIEWPORT_EVENTS, limit))
}

export function normalizedViewportPosition(year: number, start: number, end: number): number {
  return (year - start) / Math.max(1, end - start)
}

export function zoneForYear(year: number, start: number, end: number): TemporalZone {
  const p = normalizedViewportPosition(year, start, end)
  if (p < ZONE_LEFT_MAX) return 'left'
  if (p < ZONE_CENTER_MAX) return 'center'
  return 'right'
}

function surnameOf(event: FamilyEvent): string {
  const parts = event.person.name.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : parts[0]?.toLowerCase() ?? ''
}

function countZones(events: FamilyEvent[], start: number, end: number): Record<TemporalZone, number> {
  const counts: Record<TemporalZone, number> = { left: 0, center: 0, right: 0 }
  for (const e of events) counts[zoneForYear(e.year, start, end)]++
  return counts
}

/** Spread-maximizing bucket visit order — outer buckets first, then interior. */
export function spreadBucketOrder(bucketCount: number): number[] {
  if (bucketCount <= 1) return [0]
  const mid = Math.floor(bucketCount / 2)
  const order: number[] = []
  const used = new Set<number>()
  const push = (i: number) => {
    if (i >= 0 && i < bucketCount && !used.has(i)) {
      used.add(i)
      order.push(i)
    }
  }

  push(0)
  push(bucketCount - 1)
  if (bucketCount >= 4) {
    push(mid - 1)
    push(mid)
  }
  for (let i = 1; i < bucketCount - 1; i++) push(i)
  return order
}

function combinedSelectionScore(
  candidate: FamilyEvent,
  picked: FamilyEvent[],
  scoreOf: (event: FamilyEvent) => number,
  start: number,
  end: number,
  span: number,
  width: number,
): number {
  let score = scoreOf(candidate)

  const kinds = new Set(picked.map((e) => e.kind))
  if (!kinds.has(candidate.kind)) score += 45

  const surnames = new Set(picked.map(surnameOf).filter(Boolean))
  const candSurname = surnameOf(candidate)
  if (candSurname && !surnames.has(candSurname)) score += 25

  const zone = zoneForYear(candidate.year, start, end)
  const zoneCounts = countZones(picked, start, end)
  const minZoneCount = Math.min(zoneCounts.left, zoneCounts.center, zoneCounts.right)
  if (zoneCounts[zone] <= minZoneCount) {
    score += 90 - zoneCounts[zone] * 22
  }

  for (const p of picked) {
    const yearDist = Math.abs(p.year - candidate.year)
    const pxDist = Math.abs(yearX(p.year, start, span, width) - yearX(candidate.year, start, span, width))
    if (yearDist < 8 && pxDist < 90) score -= 70
    else if (yearDist < 14 && pxDist < 130) score -= 35
    else if (yearDist < 22 && pxDist < 180) score -= 15
  }

  return score
}

function minTemporalDistance(candidate: FamilyEvent, picked: FamilyEvent[], start: number, end: number): number {
  if (!picked.length) return 1
  const pos = normalizedViewportPosition(candidate.year, start, end)
  return Math.min(...picked.map((p) => Math.abs(pos - normalizedViewportPosition(p.year, start, end))))
}

function sortByImportance(
  events: FamilyEvent[],
  scoreOf: (event: FamilyEvent) => number,
): FamilyEvent[] {
  return [...events].sort(
    (a, b) => scoreOf(b) - scoreOf(a) || a.year - b.year || a.person.name.localeCompare(b.person.name),
  )
}

function passesTemporalDiversity(
  candidate: FamilyEvent,
  picked: FamilyEvent[],
  start: number,
  span: number,
  width: number,
  density: ChapterDensity,
): boolean {
  if (!picked.length) return true
  const cx = yearX(candidate.year, start, span, width)
  const minPx = density === 'sparse' ? 64 : density === 'moderate' ? 88 : 100
  const minYears = density === 'sparse' ? 5 : density === 'dense' || density === 'very_dense' ? 8 : 6

  for (const p of picked) {
    const px = yearX(p.year, start, span, width)
    if (Math.abs(px - cx) < minPx && Math.abs(p.year - candidate.year) < minYears) {
      if (candidate.kind === p.kind) return false
    }
  }
  return true
}

function passesTypeDiversity(
  candidate: FamilyEvent,
  picked: FamilyEvent[],
  density: ChapterDensity,
): boolean {
  if (!picked.length) return true
  const kinds = new Set(picked.map((e) => e.kind))
  const birthCount = picked.filter((e) => e.kind === 'birth').length
  const deathCount = picked.filter((e) => e.kind === 'death').length

  if (candidate.kind === 'birth' && birthCount >= 1) {
    if (density === 'very_dense' || density === 'dense') return false
    if (density === 'moderate' && birthCount >= 2) return false
    if (density === 'sparse' && birthCount >= 2 && !kinds.has('move') && !kinds.has('service')) {
      return false
    }
    if (
      !kinds.has('death') &&
      !kinds.has('move') &&
      !kinds.has('service') &&
      birthCount >= 1 &&
      density !== 'sparse'
    ) {
      return false
    }
  }

  if (candidate.kind === 'death' && deathCount >= 1 && density === 'very_dense') return false
  return true
}

function assignTemporalBuckets(
  events: FamilyEvent[],
  start: number,
  end: number,
  bucketCount: number,
): FamilyEvent[][] {
  const buckets: FamilyEvent[][] = Array.from({ length: bucketCount }, () => [])
  const span = Math.max(1, end - start)

  for (const event of events) {
    const t = (event.year - start) / span
    const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor(t * bucketCount)))
    buckets[idx].push(event)
  }
  return buckets
}

function tryAddCandidate(
  candidate: FamilyEvent,
  picked: FamilyEvent[],
  pickedIds: Set<string>,
  limit: number,
  start: number,
  _end: number,
  span: number,
  width: number,
  density: ChapterDensity,
): boolean {
  if (picked.length >= limit) return false
  const id = canonicalEventId(candidate)
  if (pickedIds.has(id)) return false
  if (!passesTemporalDiversity(candidate, picked, start, span, width, density)) return false
  if (!passesTypeDiversity(candidate, picked, density)) return false
  pickedIds.add(id)
  picked.push(candidate)
  return true
}

function bestInZone(
  events: FamilyEvent[],
  zone: TemporalZone,
  start: number,
  end: number,
  scoreOf: (event: FamilyEvent) => number,
): FamilyEvent | null {
  const inZone = events.filter((e) => zoneForYear(e.year, start, end) === zone)
  return sortByImportance(inZone, scoreOf)[0] ?? null
}

function pickZoneQuotas(
  events: FamilyEvent[],
  picked: FamilyEvent[],
  pickedIds: Set<string>,
  limit: number,
  start: number,
  end: number,
  span: number,
  width: number,
  density: ChapterDensity,
  scoreOf: (event: FamilyEvent) => number,
): void {
  const zones: TemporalZone[] = ['left', 'center', 'right']
  const hasZone = (z: TemporalZone) => events.some((e) => zoneForYear(e.year, start, end) === z)

  if (limit >= 3 && hasZone('left') && hasZone('center') && hasZone('right')) {
    for (const zone of zones) {
      if (picked.length >= limit) break
      const best = bestInZone(events, zone, start, end, scoreOf)
      if (best) tryAddCandidate(best, picked, pickedIds, limit, start, end, span, width, density)
    }
    return
  }

  if (limit === 2 && hasZone('left') && hasZone('right')) {
    const leftBest = bestInZone(events, 'left', start, end, scoreOf)
    const rightBest = bestInZone(events, 'right', start, end, scoreOf)
    if (leftBest) tryAddCandidate(leftBest, picked, pickedIds, limit, start, end, span, width, density)
    if (rightBest) tryAddCandidate(rightBest, picked, pickedIds, limit, start, end, span, width, density)
    return
  }

  if (limit === 2) {
    const sorted = sortByImportance(events, scoreOf)
    if (sorted.length >= 2) {
      let first = sorted[0]
      tryAddCandidate(first, picked, pickedIds, limit, start, end, span, width, density)
      let farthest: FamilyEvent | null = null
      let farthestDist = -1
      for (const e of sorted.slice(1)) {
        const d = minTemporalDistance(e, [first], start, end)
        if (d > farthestDist) {
          farthestDist = d
          farthest = e
        }
      }
      if (farthest) tryAddCandidate(farthest, picked, pickedIds, limit, start, end, span, width, density)
    } else if (sorted[0]) {
      tryAddCandidate(sorted[0], picked, pickedIds, limit, start, end, span, width, density)
    }
  }
}

/** Balanced temporal landmark selection across the full visible range. */
export function selectDistributedLandmarks(
  events: FamilyEvent[],
  start: number,
  end: number,
  span: number,
  width: number,
  mode: SemanticZoomMode,
  scoreOf: (event: FamilyEvent) => number,
  _calloutObstacle?: CollisionObstacle | CalloutObstacles | null,
): FamilyEvent[] {
  if (!events.length || mode === 'detail') return events

  const density = chapterDensity(events, start, end)
  const limit = targetVisibleEventCount(density, mode, events.length)
  if (limit <= 0) return []

  const bucketCount = temporalBucketCount(mode, span, events.length)
  const buckets = assignTemporalBuckets(events, start, end, bucketCount)
  const picked: FamilyEvent[] = []
  const pickedIds = new Set<string>()

  pickZoneQuotas(events, picked, pickedIds, limit, start, end, span, width, density, scoreOf)

  const visitOrder = spreadBucketOrder(bucketCount)
  for (const bucketIdx of visitOrder) {
    if (picked.length >= limit) break
    const bucketEvents = buckets[bucketIdx]
    if (!bucketEvents.length) continue

    const ranked = [...bucketEvents].sort(
      (a, b) =>
        combinedSelectionScore(b, picked, scoreOf, start, end, span, width) -
          combinedSelectionScore(a, picked, scoreOf, start, end, span, width) ||
        scoreOf(b) - scoreOf(a),
    )

    for (const candidate of ranked) {
      if (tryAddCandidate(candidate, picked, pickedIds, limit, start, end, span, width, density)) {
        break
      }
    }
  }

  while (picked.length < limit) {
    const remaining = events.filter((e) => !pickedIds.has(canonicalEventId(e)))
    if (!remaining.length) break

    const ranked = remaining
      .map((e) => ({
        event: e,
        spread: minTemporalDistance(e, picked, start, end),
        score: combinedSelectionScore(e, picked, scoreOf, start, end, span, width),
      }))
      .sort(
        (a, b) =>
          b.spread - a.spread ||
          b.score - a.score ||
          scoreOf(b.event) - scoreOf(a.event),
      )

    let added = false
    for (const { event } of ranked) {
      if (tryAddCandidate(event, picked, pickedIds, limit, start, end, span, width, density)) {
        added = true
        break
      }
    }
    if (!added) break
  }

  for (const kind of DIVERSITY_KIND_ORDER) {
    if (picked.length >= limit) break
    const ranked = sortByImportance(
      events.filter((e) => e.kind === kind && !pickedIds.has(canonicalEventId(e))),
      scoreOf,
    )
    for (const candidate of ranked) {
      if (
        combinedSelectionScore(candidate, picked, scoreOf, start, end, span, width) <
        scoreOf(candidate) * 0.55
      ) {
        continue
      }
      if (tryAddCandidate(candidate, picked, pickedIds, limit, start, end, span, width, density)) break
    }
  }

  if (LANDMARK_DEBUG) {
    const snapshot: LandmarkDebugSnapshot = {
      visibleStart: start,
      visibleEnd: end,
      qualifyingByZone: countZones(events, start, end),
      selectedByZone: countZones(picked, start, end),
      rejected: [],
      replacements: [],
    }
    reportLandmarkDebug(snapshot)
  }

  const minimum = Math.min(events.length, MIN_VIEWPORT_EVENTS)
  if (picked.length < minimum) {
    for (const event of sortByImportance(events, scoreOf)) {
      if (picked.length >= minimum) break
      const id = canonicalEventId(event)
      if (pickedIds.has(id)) continue
      pickedIds.add(id)
      picked.push(event)
    }
  }

  return picked
}

type PlacedRect = {
  left: number
  right: number
  top: number
  bottom: number
  markerX: number
  anchorY: number
}

function laneY(height: number, lane: number): number {
  const offset = HYBRID_LANE_OFFSETS[Math.min(lane, HYBRID_MAX_LANES - 1)]
  return Math.max(168, height * 0.54 - offset)
}

function rectsCollide(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
): boolean {
  return !(
    a.right + HYBRID_H_GAP < b.left ||
    b.right + HYBRID_H_GAP < a.left ||
    a.bottom + HYBRID_V_GAP < b.top ||
    b.bottom + HYBRID_V_GAP < a.top
  )
}

function collidesWithObstacles(
  bounds: { left: number; right: number; top: number; bottom: number },
  markerX: number,
  obstacles?: CalloutObstacles | CollisionObstacle | null,
): boolean {
  if (!obstacles) return false

  if ('frame' in obstacles) {
    if (rectsCollide(bounds, obstacles.frame)) return true
    const nearStem = Math.abs(markerX - (obstacles.connector.left + obstacles.connector.right) / 2) < 48
    if (nearStem && rectsCollide(bounds, obstacles.connector)) return true
    if (obstacles.brace && rectsCollide(bounds, obstacles.brace)) return true
    return false
  }

  return rectsCollide(bounds, obstacles)
}

function hybridAlignmentOrder(markerX: number, viewportWidth: number): LabelAlignment[] {
  const centerX = viewportWidth / 2
  if (Math.abs(markerX - centerX) < 130) return ['left', 'right', 'center']
  if (markerX < 110) return ['left', 'center', 'right']
  if (markerX > viewportWidth - 150) return ['right', 'center', 'left']
  return ['left', 'right', 'center']
}

function tryHybridPlacement(
  event: FamilyEvent,
  markerX: number,
  width: number,
  height: number,
  placed: PlacedRect[],
  obstacles: CalloutObstacles | CollisionObstacle | null | undefined,
  lane: number,
  alignment: LabelAlignment,
  nudge: number,
  compact: boolean,
): PlacedRect | null {
  const anchorY = laneY(height, lane)
  const footprint = measureDetailedFootprint(event, width, compact)
  const bounds = footprintBounds(markerX, anchorY, footprint, alignment, nudge, width)
  const rect: PlacedRect = {
    left: bounds.left,
    right: bounds.right,
    top: bounds.top,
    bottom: bounds.bottom,
    markerX,
    anchorY,
  }

  if (collidesWithObstacles(rect, markerX, obstacles)) return null

  for (const other of placed) {
    if (rectsCollide(rect, other)) return null
    if (stemIntersectsBox(markerX, anchorY, footprint.stemHeight, other)) return null
    if (stemIntersectsBox(other.markerX, other.anchorY, footprint.stemHeight, rect)) return null
  }

  return rect
}

function placeOneHybridEvent(
  event: FamilyEvent,
  markerX: number,
  width: number,
  height: number,
  placed: PlacedRect[],
  obstacles: CalloutObstacles | CollisionObstacle | null | undefined,
): HybridPlacedEvent | null {
  const alignments = hybridAlignmentOrder(markerX, width)

  for (let lane = 0; lane < HYBRID_MAX_LANES; lane++) {
    for (const alignment of alignments) {
      for (const nudge of DETAIL_NUDGES) {
        const rect = tryHybridPlacement(
          event,
          markerX,
          width,
          height,
          placed,
          obstacles,
          lane,
          alignment,
          nudge,
          false,
        )
        if (rect) {
          placed.push(rect)
          const footprint = measureDetailedFootprint(event, width, false)
          const adjustedNudge = effectiveLabelNudge(
            markerX,
            rect.anchorY,
            footprint,
            alignment,
            nudge,
            width,
          )
          return { event, x: markerX, y: rect.anchorY, alignment, nudge: adjustedNudge, compact: false, lane }
        }
      }
    }
  }

  for (let lane = 0; lane < HYBRID_MAX_LANES; lane++) {
    for (const alignment of alignments) {
      for (const nudge of DETAIL_NUDGES) {
        const rect = tryHybridPlacement(
          event,
          markerX,
          width,
          height,
          placed,
          obstacles,
          lane,
          alignment,
          nudge,
          true,
        )
        if (rect) {
          placed.push(rect)
          const footprint = measureDetailedFootprint(event, width, true)
          const adjustedNudge = effectiveLabelNudge(
            markerX,
            rect.anchorY,
            footprint,
            alignment,
            nudge,
            width,
          )
          return { event, x: markerX, y: rect.anchorY, alignment, nudge: adjustedNudge, compact: true, lane }
        }
      }
    }
  }

  return null
}

function applyCachedHybridPlacement(
  event: FamilyEvent,
  profile: StableLandmarkPlacement,
  markerX: number,
  width: number,
  height: number,
  placedRects: PlacedRect[],
): HybridPlacedEvent {
  const anchorY = laneY(height, profile.lane)
  const footprint = measureDetailedFootprint(event, width, profile.compact)
  const bounds = footprintBounds(markerX, anchorY, footprint, profile.alignment, profile.nudge, width)
  placedRects.push({
    left: bounds.left,
    right: bounds.right,
    top: bounds.top,
    bottom: bounds.bottom,
    markerX,
    anchorY,
  })
  return {
    event,
    x: markerX,
    y: anchorY,
    alignment: profile.alignment,
    nudge: profile.nudge,
    compact: profile.compact,
    lane: profile.lane,
  }
}

export function placeHybridLandmarks(
  candidates: FamilyEvent[],
  alternates: FamilyEvent[],
  start: number,
  span: number,
  width: number,
  height: number,
  obstacles: CalloutObstacles | CollisionObstacle | null | undefined,
  _scoreOf: (event: FamilyEvent) => number,
  mode: SemanticZoomMode,
): { placed: HybridPlacedEvent[]; unplaced: FamilyEvent[] } {
  const placedRects: PlacedRect[] = []
  const placed: HybridPlacedEvent[] = []
  const unplaced: FamilyEvent[] = []
  const placedIds = new Set<string>()
  const end = start + span
  const stabilityKey = landmarkStabilityKey(mode, span)

  const debugRejected: LandmarkDebugSnapshot['rejected'] = []
  const debugReplacements: LandmarkDebugSnapshot['replacements'] = []

  for (const event of candidates) {
    const markerX = yearX(event.year, start, span, width)
    const failedZone = zoneForYear(event.year, start, end)
    const eventId = canonicalEventId(event)
    const cached = getStableLandmarkPlacement(stabilityKey, eventId)

    if (cached) {
      placed.push(applyCachedHybridPlacement(event, cached, markerX, width, height, placedRects))
      placedIds.add(eventId)
      continue
    }

    let result = placeOneHybridEvent(event, markerX, width, height, placedRects, obstacles)
    if (!result) {
      result = placeOneHybridEvent(event, markerX, width, height, placedRects, null)
    }
    if (result) {
      rememberStableLandmarkPlacement(stabilityKey, eventId, {
        lane: result.lane,
        alignment: result.alignment,
        nudge: result.nudge,
        compact: result.compact,
      })
      placed.push(result)
      placedIds.add(eventId)
      continue
    }

    unplaced.push(event)
    if (LANDMARK_DEBUG) {
      debugRejected.push({
        eventId: canonicalEventId(event),
        reason: 'collision',
        zone: failedZone,
      })
    }
  }

  placed.sort((a, b) => a.x - b.x)

  const minimum = Math.min(alternates.length, MIN_VIEWPORT_EVENTS)
  if (placed.length < minimum) {
    const ranked = sortByImportance(
      alternates.filter((event) => !placedIds.has(canonicalEventId(event))),
      _scoreOf,
    )
    for (const event of ranked) {
      if (placed.length >= minimum) break
      const markerX = yearX(event.year, start, span, width)
      const result = placeOneHybridEvent(event, markerX, width, height, placedRects, null)
      if (!result) continue
      rememberStableLandmarkPlacement(stabilityKey, canonicalEventId(event), {
        lane: result.lane,
        alignment: result.alignment,
        nudge: result.nudge,
        compact: result.compact,
      })
      placed.push(result)
      placedIds.add(canonicalEventId(event))
    }
    placed.sort((a, b) => a.x - b.x)
  }

  if (LANDMARK_DEBUG) {
    reportLandmarkDebug({
      visibleStart: start,
      visibleEnd: end,
      qualifyingByZone: countZones(alternates, start, end),
      selectedByZone: countZones(
        placed.map((p) => p.event),
        start,
        end,
      ),
      rejected: debugRejected,
      replacements: debugReplacements,
    })
  }

  return { placed, unplaced }
}

export function estimateCalloutObstacle(
  chapters: StoryChapter[],
  start: number,
  span: number,
  width: number,
  axisY = 0,
  zoomMode: SemanticZoomMode = 'medium',
  viewportHeight = 720,
): CalloutObstacles | null {
  if (!chapters.length || width <= 0) return null

  const cx = chapterCenterX(width)
  const visibleTimeline = visibleTimelineViewport(width)
  const layout = getCalloutLayoutProfile({
    zoomMode,
    totalVisibleEvents: 0,
    placedEventCount: 0,
    viewportWidth: width,
  })
  const verticalLayout = resolveChapterVerticalLayout(zoomMode, width, viewportHeight, layout)
  const cardTop = verticalLayout.cardTop
  const cardHeight = estimateCardFrameHeight(layout)
  const cardBottom = cardTop + cardHeight

  const centerYear = start + span / 2
  const containing = chapters.filter((c) => centerYear >= c.yearStart && centerYear <= c.yearEnd)
  const primary =
    containing.length > 0
      ? containing.sort(
          (a, b) =>
            b.yearEnd - b.yearStart - (a.yearEnd - a.yearStart) ||
            b.importance - a.importance,
        )[0]
      : chapters.reduce((best, c) => {
          const mid = (c.yearStart + c.yearEnd) / 2
          const bestMid = (best.yearStart + best.yearEnd) / 2
          return Math.abs(mid - centerYear) < Math.abs(bestMid - centerYear) ? c : best
        })

  const clusterLeftX = yearX(primary.yearStart, start, span, width)
  const clusterRightX = yearX(primary.yearEnd, start, span, width)
  const brace = computeEraBraceGeometry(
    { leftX: clusterLeftX, rightX: clusterRightX },
    visibleTimeline,
    zoomMode,
    axisY > 0 ? axisY : verticalLayout.timelineAxisY,
    verticalLayout.rangeBracketAxisOffset,
    verticalLayout.braceCapDrop,
  )

  const halfW = Math.min(layout.maxWidthPx / 2, width * 0.22)
  const connectorTop = cardBottom
  const resolvedAxisY = axisY > 0 ? axisY : verticalLayout.timelineAxisY
  const connectorBottom =
    brace && verticalLayout.showEraBrace
      ? brace.bracketY + brace.capDrop + 4
      : resolvedAxisY - verticalLayout.rangeBracketAxisOffset

  const braceBand =
    brace && verticalLayout.showEraBrace
      ? {
          left: brace.left,
          right: brace.right,
          top: brace.bracketY - brace.capDrop - 2,
          bottom: brace.bracketY + brace.capDrop + 4,
        }
      : null

  return {
    frame: {
      left: cx - halfW,
      right: cx + halfW,
      top: cardTop,
      bottom: connectorTop,
    },
    connector: {
      left: cx - 12,
      right: cx + 12,
      top: connectorTop,
      bottom: connectorBottom,
    },
    brace: braceBand,
  }
}

/** @deprecated Use estimateCalloutObstacle — returns frame only for legacy callers. */
export function estimateCalloutFrameObstacle(
  chapters: StoryChapter[],
  start: number,
  span: number,
  width: number,
): CollisionObstacle | null {
  const obs = estimateCalloutObstacle(chapters, start, span, width)
  return obs?.frame ?? null
}
