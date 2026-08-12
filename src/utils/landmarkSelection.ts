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
  groupByLabelProximity,
  minLaneForGroupIndex,
  staggerAlignmentForIndex,
} from './labelStagger'
import {
  getStableLandmarkPlacement,
  landmarkStabilityKey,
  rememberStableLandmarkPlacement,
  type StableLandmarkPlacement,
} from './landmarkSelectionStability'
import { yearX } from './timelineMath'
import {
  familyLabelFloorY,
  isCompactStage,
  isNarrowStage,
  isTabletStage,
  stageLayoutProfile,
} from './stageBreakpoints'
import { isNearGeneration, generationDistance } from './familyPriority'
import { familyLabelCeilingY } from './eventConnector'
import {
  chapterCenterX,
  computeEraBraceGeometry,
  estimateCardFrameHeight,
  type MeasuredPlaqueAnchor,
  resolveChapterVerticalLayout,
  timelineAxisY,
  visibleTimelineViewport,
  estimateEditorialSidenoteObstacles,
  type EditorialObstacle,
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

const HYBRID_LANE_OFFSETS_DESKTOP = [52, 110, 168, 226, 284, 342, 400]
const HYBRID_LANE_OFFSETS_NARROW = [44, 92, 140, 188]
const HYBRID_H_GAP = 44
const HYBRID_V_GAP = 28
const PLACEMENT_PROBE_GAP = 32

/** Century views: keep plaque card clearance without reserving half the timeline. */
function softenCalloutObstaclesForWideAtlas(
  obstacles: CalloutObstacles | CollisionObstacle | null | undefined,
  wideAtlas: boolean,
  width: number,
): CalloutObstacles | CollisionObstacle | null | undefined {
  if (!wideAtlas || !obstacles || !('frame' in obstacles)) return obstacles

  const frameHalf = Math.min((obstacles.frame.right - obstacles.frame.left) / 2, width * 0.16)
  const cx = (obstacles.frame.left + obstacles.frame.right) / 2
  return {
    frame: {
      ...obstacles.frame,
      left: cx - frameHalf,
      right: cx + frameHalf,
    },
    connector: obstacles.connector,
    brace: null,
  }
}

function hybridLaneOffsets(viewportWidth: number): number[] {
  if (isNarrowStage(viewportWidth)) return HYBRID_LANE_OFFSETS_NARROW
  if (isTabletStage(viewportWidth)) {
    return [70, 148, 226, 304, 382]
  }
  return HYBRID_LANE_OFFSETS_DESKTOP
}

function hybridMaxLanes(viewportWidth: number): number {
  return stageLayoutProfile(viewportWidth, 800).maxHybridLanes
}

/** Vertical stem offsets for family labels — mirrors history-event lane staggering. */
function familyLaneOffsets(span: number, viewportWidth = 1200): number[] {
  if (isNarrowStage(viewportWidth)) {
    if (span > 320) return [64, 132, 200, 268]
    if (span > 180) return [58, 120, 182, 244]
    if (span > 90) return [52, 110, 168, 226]
    return [48, 100, 152, 204]
  }
  if (isTabletStage(viewportWidth)) {
    // Larger steps than desktop-at-tablet-width so Georgia labels clear each other.
    if (span > 320) return [86, 176, 266, 356]
    if (span > 180) return [80, 168, 256, 344]
    if (span > 90) return [76, 160, 244, 328]
    return [72, 154, 236, 318, 400]
  }
  // Keep steps ≥ ~72px so stacked Georgia labels clear each other.
  if (span > 320) return [78, 160, 242, 324, 400]
  if (span > 180) return [72, 152, 232, 312, 392]
  if (span > 90) return [68, 144, 220, 296, 372]
  return [64, 138, 212, 286, 360, 434]
}

/** Padding between label boxes on the same lane. */
function familyLanePad(span: number): number {
  if (span > 320) return 28
  if (span > 180) return 26
  if (span > 90) return 28
  return 24
}

function familyEventStaggerScore(event: FamilyEvent): number {
  const kindBoost =
    event.kind === 'move' || event.kind === 'service'
      ? 40
      : event.kind === 'marriage'
        ? 36
        : event.kind === 'birth'
          ? 20
          : event.kind === 'death'
            ? 10
            : 0
  const genBoost =
    event.person.generation != null ? Math.max(0, 50 - Math.abs(event.person.generation) * 12) : 0
  return (
    (event.importance ?? 0) * 12 +
    kindBoost +
    genBoost +
    (event.person.focus ? 30 : 0) +
    (isNearGeneration(event.person) ? 40 : 0)
  )
}

/** Hard cap on how many family labels may appear in one viewport. */
export function maxFamilyEventsForSpan(span: number, viewportWidth = 1200): number {
  const pxPerYear = viewportWidth / Math.max(1, span)
  let cap = 9
  if (span > 320) cap = 8
  else if (span > 180) cap = 9
  else if (span > 90) cap = 11
  else if (span > 40) cap = 13
  else cap = 14

  // Fill empty axis when years are wide on screen.
  if (pxPerYear >= 12) cap += 1
  if (pxPerYear >= 18) cap += 2
  if (pxPerYear >= 28) cap += 2
  if (pxPerYear >= 40) cap += 2

  // Wide century views still have horizontal room for more landmarks.
  if (span > 180 && viewportWidth > 1180) {
    const farBudget = Math.floor(Math.max(400, viewportWidth - 280) / 110)
    cap = Math.max(cap, Math.min(farBudget, 12))
  }

  // Roughly one readable staggered label per ~100px of usable width.
  const spaceBudget = Math.floor(Math.max(360, viewportWidth - 220) / (isCompactStage(viewportWidth) ? 120 : 100))
  cap = Math.max(cap, Math.min(spaceBudget, isCompactStage(viewportWidth) ? 10 : 16))
  cap = Math.min(cap, isTabletStage(viewportWidth) ? 9 : isNarrowStage(viewportWidth) ? 7 : 16)

  return stageLayoutProfile(viewportWidth, 800).familyEventCap(cap)
}

/**
 * Keep markers that were already on-screen, then fill remaining slots by score.
 * Enforces a hard concurrent visible limit so pan-persistence cannot overcrowd.
 */
export function admitPersistentMarkers<T>(
  candidates: T[],
  previousIds: readonly string[],
  getId: (item: T) => string,
  scoreOf: (item: T) => number,
  limit: number,
): T[] {
  if (limit <= 0 || candidates.length === 0) return []

  const byId = new Map(candidates.map((item) => [getId(item), item] as const))
  const selected: T[] = []
  const selectedIds = new Set<string>()

  for (const id of previousIds) {
    if (selected.length >= limit) break
    const item = byId.get(id)
    if (!item || selectedIds.has(id)) continue
    selected.push(item)
    selectedIds.add(id)
  }

  const ranked = [...candidates].sort(
    (a, b) => scoreOf(b) - scoreOf(a) || getId(a).localeCompare(getId(b)),
  )
  for (const item of ranked) {
    if (selected.length >= limit) break
    const id = getId(item)
    if (selectedIds.has(id)) continue
    selected.push(item)
    selectedIds.add(id)
  }

  return selected
}

/**
 * Greedy vertical lane assignment by year-X (same idea as WorldHistoryLayer).
 * Uses label half-widths so boxes cannot overlap; extras are dropped.
 *
 * `mustKeepIds` get first claim on lanes (so sticky markers are not swapped out
 * for higher-scoring newcomers). The caller must already enforce the quantity cap.
 */
export function staggerFamilyEventLanes<
  T extends {
    event: FamilyEvent
    x: number
    y: number
    alignment?: LabelAlignment
    nudge?: number
    compact?: boolean
    lane?: number
  },
>(
  placed: T[],
  height: number,
  span: number,
  viewportWidth = 1200,
  mustKeepIds?: ReadonlySet<string>,
): T[] {
  if (placed.length <= 1) return placed

  const offsets = familyLaneOffsets(span, viewportWidth)
  const pad = familyLanePad(span)
  const maxKeep = maxFamilyEventsForSpan(span, viewportWidth)
  const compact = span > 90 || isNarrowStage(viewportWidth)
  const axisY = timelineAxisY(height, viewportWidth)
  const floorY = familyLabelFloorY(viewportWidth, height)
  // Century views: render-time clamps clear sidenotes; packing should fill the axis.
  const editorialPanels =
    span >= 40 ? [] : estimateEditorialSidenoteObstacles(viewportWidth)
  const wideAtlas = span >= 40

  const assigned = new Map<string, T>()
  // Interval occupancy per lane — must not assume left-to-right insertion order.
  const laneIntervals: Array<Array<{ left: number; right: number }>> = offsets.map(() => [])

  const fitsLane = (laneIndex: number, left: number, right: number): boolean => {
    for (const iv of laneIntervals[laneIndex]) {
      if (!(right + pad < iv.left || left > iv.right + pad)) return false
    }
    return true
  }

  const placeEntry = (entry: T, force: boolean): boolean => {
    const id = canonicalEventId(entry.event)
    if (assigned.has(id)) return true
    if (!force && assigned.size >= maxKeep) return false

    const footprint = measureDetailedFootprint(entry.event, viewportWidth, compact)
    const half = footprint.width / 2
    const left = entry.x - half
    const right = entry.x + half

    let laneIndex = -1
    for (let i = 0; i < offsets.length; i++) {
      if (fitsLane(i, left, right)) {
        laneIndex = i
        break
      }
    }

    // Never force-overlap: sticky keep cannot violate zero-overlap.
    if (laneIndex < 0) return false

    let y = Math.max(floorY, axisY - offsets[laneIndex])
    const ceiling = familyLabelCeilingY(axisY)
    for (const panel of editorialPanels) {
      const bounds = footprintBounds(entry.x, y, footprint, 'center', 0, viewportWidth)
      const overlapsHorizontally = !(
        bounds.right + 10 < panel.left || bounds.left - 10 > panel.right
      )
      if (!overlapsHorizontally) continue
      const minTop = panel.bottom + 14
      if (bounds.top < minTop) y += minTop - bounds.top
    }
    // Family labels belong above the timeline — never spill into history space.
    y = Math.min(y, ceiling)

    laneIntervals[laneIndex].push({ left, right })
    assigned.set(id, {
      ...entry,
      lane: laneIndex,
      y,
      nudge: 0,
      compact,
    })
    return true
  }

  // Wide atlas: prefer temporal spread over near-gen score so eras keep seats.
  const ranked = [...placed].sort((a, b) => {
    if (wideAtlas) {
      const spreadA = Math.min(
        ...placed.map((other) =>
          other === a ? Infinity : Math.abs(other.event.year - a.event.year),
        ),
      )
      const spreadB = Math.min(
        ...placed.map((other) =>
          other === b ? Infinity : Math.abs(other.event.year - b.event.year),
        ),
      )
      // Prefer markers that are farther from their nearest neighbor (era anchors).
      if (spreadB !== spreadA) return spreadB - spreadA
      return a.x - b.x || familyEventStaggerScore(b.event) - familyEventStaggerScore(a.event)
    }
    return (
      familyEventStaggerScore(b.event) - familyEventStaggerScore(a.event) ||
      a.x - b.x ||
      a.event.year - b.event.year
    )
  })

  if (mustKeepIds?.size) {
    for (const entry of ranked) {
      if (!mustKeepIds.has(canonicalEventId(entry.event))) continue
      if (assigned.size >= maxKeep) break
      placeEntry(entry, true)
    }
  }

  for (const entry of ranked) {
    if (assigned.size >= maxKeep) break
    placeEntry(entry, false)
  }

  return [...assigned.values()].sort((a, b) => a.x - b.x || a.event.year - b.event.year)
}

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
  viewportWidth = 1200,
  span = 100,
): number {
  const caps: Record<ChapterDensity, { far: number; medium: number; near: number }> = {
    sparse: { far: 8, medium: 9, near: 10 },
    moderate: { far: 7, medium: 9, near: 10 },
    dense: { far: 7, medium: 8, near: 9 },
    very_dense: { far: 6, medium: 7, near: 8 },
  }

  let limit = mode === 'detail' ? Math.min(available, 12) : Math.min(available, caps[density][mode])

  // When the axis has room, fill gaps instead of leaving sparse landmarks.
  const pxPerYear = viewportWidth / Math.max(1, span)
  if (pxPerYear >= 12 && (density === 'sparse' || density === 'moderate')) {
    limit += 2
  } else if (pxPerYear >= 16) {
    limit += 2
  }
  if (pxPerYear >= 22 && mode !== 'far') {
    limit += 2
  }
  if (pxPerYear >= 32 && mode !== 'far') {
    limit += 2
  }

  // Far/generation+ views: budget by horizontal room (far has tiny px/year;
  // mid zooms still have empty axis to fill).
  if (mode === 'far' || span >= 40) {
    const roomBudget = Math.floor(Math.max(400, viewportWidth - 280) / 105)
    limit = Math.max(limit, Math.min(available, roomBudget))
  }

  const spaceBudget = Math.floor(Math.max(360, viewportWidth - 220) / 105)
  const modeCap = mode === 'far' ? 12 : mode === 'detail' ? 14 : 13
  limit = Math.max(limit, Math.min(available, spaceBudget))
  limit = Math.min(available, limit, modeCap)

  if (isNarrowStage(viewportWidth)) {
    limit = Math.min(available, Math.max(2, Math.round(limit * 0.75)))
  } else if (isTabletStage(viewportWidth)) {
    limit = Math.min(available, Math.max(3, Math.round(limit * 0.82)))
  }
  return Math.min(available, limit)
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

  // Near-generation events outrank temporal-spread preferences when both compete.
  if (isNearGeneration(candidate.person, 1)) score += 120
  else if (isNearGeneration(candidate.person, 2)) score += 70

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

  // Default zoom often under-represents colonial/industrial and modern family arcs.
  if (candidate.year >= 1550 && candidate.year <= 1850) score += 55
  if (candidate.year >= 1900) score += 70

  for (const p of picked) {
    const yearDist = Math.abs(p.year - candidate.year)
    const pxDist = Math.abs(yearX(p.year, start, span, width) - yearX(candidate.year, start, span, width))
    // Near-generation pairs (e.g. both parents' births) tolerate closer years when spaced on screen.
    const nearPair = isNearGeneration(candidate.person) && isNearGeneration(p.person)
    const yearSoft = nearPair ? 5 : 8
    const pxSoft = nearPair ? 70 : 90
    if (yearDist < yearSoft && pxDist < pxSoft) score -= nearPair ? 35 : 70
    else if (yearDist < 14 && pxDist < 130) score -= nearPair ? 12 : 35
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
  const near = isNearGeneration(candidate.person)
  const minPx = near
    ? density === 'sparse'
      ? 56
      : 64
    : density === 'sparse'
      ? 72
      : density === 'moderate'
        ? 88
        : density === 'dense' || density === 'very_dense'
          ? 84
          : 80
  const minYears = near
    ? 3
    : density === 'sparse'
      ? 5
      : density === 'dense' || density === 'very_dense'
        ? 6
        : 7

  for (const p of picked) {
    const px = yearX(p.year, start, span, width)
    if (Math.abs(px - cx) < minPx && Math.abs(p.year - candidate.year) < minYears) {
      // Two near-generation births (both parents) may share a decade if labels clear.
      if (near && isNearGeneration(p.person) && candidate.kind === 'birth' && p.kind === 'birth') {
        if (Math.abs(px - cx) >= 48) continue
      }
      if (candidate.kind === p.kind) return false
    }
  }
  return true
}

function passesTypeDiversity(
  candidate: FamilyEvent,
  picked: FamilyEvent[],
  density: ChapterDensity,
  start: number,
  end: number,
): boolean {
  if (!picked.length) return true
  const kinds = new Set(picked.map((e) => e.kind))
  const birthCount = picked.filter((e) => e.kind === 'birth').length
  const deathCount = picked.filter((e) => e.kind === 'death').length
  const nearBirthCount = picked.filter(
    (e) => e.kind === 'birth' && isNearGeneration(e.person),
  ).length
  const span = Math.max(1, end - start)
  // Generation / roomy-axis windows need births across the range.
  const roomyView = span >= 40

  if (candidate.kind === 'birth' && birthCount >= 1) {
    // Parents/self/children: allow several births when the viewport still has room.
    if (isNearGeneration(candidate.person)) {
      // Keep room for both parents on generation+ views; still cap household stacks.
      if (roomyView && nearBirthCount >= 3) return false
      if (density === 'very_dense' && nearBirthCount >= 3) return false
      if (nearBirthCount >= 4) return false
      return true
    }

    if (roomyView) {
      const zone = zoneForYear(candidate.year, start, end)
      const birthZones = new Set(
        picked.filter((e) => e.kind === 'birth').map((e) => zoneForYear(e.year, start, end)),
      )
      // Prefer spreading births across zones; allow several when eras have room.
      if (birthZones.has(zone) && birthCount >= Math.max(2, Math.round(span / 45))) return false
      if (birthCount >= Math.max(5, Math.round(span / 55))) return false
      return true
    }

    if (density === 'very_dense' || density === 'dense') {
      const zone = zoneForYear(candidate.year, start, end)
      const birthZones = new Set(
        picked.filter((e) => e.kind === 'birth').map((e) => zoneForYear(e.year, start, end)),
      )
      if (birthZones.has(zone)) return false
      if (birthCount >= 3) return false
      return true
    }
    if (density === 'moderate' && birthCount >= 3) return false
    if (density === 'sparse' && birthCount >= 3 && !kinds.has('move') && !kinds.has('service')) {
      return false
    }
    if (
      !kinds.has('death') &&
      !kinds.has('move') &&
      !kinds.has('service') &&
      birthCount >= 2 &&
      density !== 'sparse'
    ) {
      return false
    }
  }

  if (candidate.kind === 'death' && deathCount >= 1 && density === 'very_dense' && !roomyView) {
    return false
  }
  if (candidate.kind === 'death' && deathCount >= 3 && roomyView) return false
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
  end: number,
  span: number,
  width: number,
  density: ChapterDensity,
): boolean {
  if (picked.length >= limit) return false
  const id = canonicalEventId(candidate)
  if (pickedIds.has(id)) return false
  if (!passesTemporalDiversity(candidate, picked, start, span, width, density)) return false
  if (!passesTypeDiversity(candidate, picked, density, start, end)) return false
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
  span: number,
  width: number,
  calloutObstacle?: CollisionObstacle | CalloutObstacles | null,
): FamilyEvent | null {
  const inZone = events.filter((e) => zoneForYear(e.year, start, end) === zone)
  if (!inZone.length) return null

  return [...inZone].sort(
    (a, b) =>
      selectionPlacabilityScore(b, pickedProbeContext(start, span, width, calloutObstacle), scoreOf) -
        selectionPlacabilityScore(a, pickedProbeContext(start, span, width, calloutObstacle), scoreOf) ||
      scoreOf(b) - scoreOf(a) ||
      a.year - b.year,
  )[0]
}

type PlacementProbeContext = {
  start: number
  span: number
  width: number
  reservedBand: { left: number; right: number } | null
}

function pickedProbeContext(
  start: number,
  span: number,
  width: number,
  calloutObstacle?: CollisionObstacle | CalloutObstacles | null,
): PlacementProbeContext {
  let reservedBand: { left: number; right: number } | null = null
  if (calloutObstacle && 'frame' in calloutObstacle) {
    reservedBand = {
      left: calloutObstacle.frame.left - PLACEMENT_PROBE_GAP,
      right: calloutObstacle.frame.right + PLACEMENT_PROBE_GAP,
    }
  } else if (calloutObstacle) {
    reservedBand = {
      left: calloutObstacle.left - PLACEMENT_PROBE_GAP,
      right: calloutObstacle.right + PLACEMENT_PROBE_GAP,
    }
  }

  return { start, span, width, reservedBand }
}

function markerXForEvent(event: FamilyEvent, context: PlacementProbeContext): number {
  return yearX(event.year, context.start, context.span, context.width)
}

function markerInReservedBand(markerX: number, band: { left: number; right: number } | null): boolean {
  if (!band) return false
  return markerX >= band.left && markerX <= band.right
}

function markerUnderCallout(
  markerX: number,
  obstacles: CalloutObstacles | CollisionObstacle | null | undefined,
): boolean {
  if (!obstacles || !('frame' in obstacles)) return false
  const gap = PLACEMENT_PROBE_GAP
  return (
    markerX >= Math.min(obstacles.frame.left, obstacles.connector.left) - gap &&
    markerX <= Math.max(obstacles.frame.right, obstacles.connector.right) + gap
  )
}

function selectionPlacabilityScore(
  event: FamilyEvent,
  context: PlacementProbeContext,
  scoreOf: (event: FamilyEvent) => number,
): number {
  let score = scoreOf(event)
  if (!context.reservedBand) return score

  const markerX = markerXForEvent(event, context)
  if (markerInReservedBand(markerX, context.reservedBand)) {
    score -= 35
  } else if (
    markerX >= context.reservedBand.left - 72 &&
    markerX <= context.reservedBand.right + 72
  ) {
    score -= 12
  } else {
    score += 24
  }

  return score
}

function bestInYearRange(
  events: FamilyEvent[],
  rangeStart: number,
  rangeEnd: number,
  scoreOf: (event: FamilyEvent) => number,
): FamilyEvent | null {
  const inRange = events.filter((e) => e.year >= rangeStart && e.year <= rangeEnd)
  return sortByImportance(inRange, scoreOf)[0] ?? null
}

function pickEraQuotas(
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
  eraCount = 5,
): void {
  const eras = Math.min(eraCount, Math.max(4, Math.round(span / 100)))
  for (let i = 0; i < eras; i++) {
    if (picked.length >= limit) break
    const eraStart = start + (span * i) / eras
    const eraEnd = i === eras - 1 ? end : start + (span * (i + 1)) / eras - 1
    const ranked = sortByImportance(
      events.filter((e) => e.year >= eraStart && e.year <= eraEnd),
      scoreOf,
    )
    for (const candidate of ranked) {
      if (tryAddCandidate(candidate, picked, pickedIds, limit, start, end, span, width, density)) {
        break
      }
    }
  }
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
  calloutObstacle?: CollisionObstacle | CalloutObstacles | null,
): void {
  const zones: TemporalZone[] = ['left', 'center', 'right']
  const hasZone = (z: TemporalZone) => events.some((e) => zoneForYear(e.year, start, end) === z)

  if (limit >= 3 && hasZone('left') && hasZone('center') && hasZone('right')) {
    for (const zone of zones) {
      if (picked.length >= limit) break
      const best = bestInZone(events, zone, start, end, scoreOf, span, width, calloutObstacle)
      if (best) tryAddCandidate(best, picked, pickedIds, limit, start, end, span, width, density)
    }

    if (calloutObstacle && picked.length < limit) {
      const centerStart = start + (span * ZONE_LEFT_MAX)
      const centerEnd = start + (span * ZONE_CENTER_MAX)
      const centerBest = bestInYearRange(events, centerStart, centerEnd, scoreOf)
      if (centerBest && !pickedIds.has(canonicalEventId(centerBest))) {
        tryAddCandidate(centerBest, picked, pickedIds, limit, start, end, span, width, density)
      }
    }
    return
  }

  if (limit === 2 && hasZone('left') && hasZone('right')) {
    const leftBest = bestInZone(events, 'left', start, end, scoreOf, span, width, calloutObstacle)
    const rightBest = bestInZone(events, 'right', start, end, scoreOf, span, width, calloutObstacle)
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

function tryAddNearGenerationCandidate(
  candidate: FamilyEvent,
  picked: FamilyEvent[],
  pickedIds: Set<string>,
  limit: number,
  start: number,
  span: number,
  width: number,
): boolean {
  if (picked.length >= limit) return false
  if (!isNearGeneration(candidate.person, 2)) return false
  const id = canonicalEventId(candidate)
  if (pickedIds.has(id)) return false

  const cx = yearX(candidate.year, start, span, width)
  for (const p of picked) {
    const px = yearX(p.year, start, span, width)
    const yearGap = Math.abs(p.year - candidate.year)
    const pxGap = Math.abs(px - cx)
    // Close household births may share a decade, but still need room for
    // staggered labels — otherwise stacks collide at the same visual height.
    const bothNear = isNearGeneration(p.person, 1) && isNearGeneration(candidate.person, 1)
    if (bothNear) {
      // Root household (spouse/children) gets a slightly looser seat so modern
      // family clusters stay visible; other near-gen pairs need more room.
      const householdCore =
        Math.abs(p.person.generation ?? 99) <= 0 ||
        Math.abs(candidate.person.generation ?? 99) <= 0
      const minPx = householdCore
        ? yearGap < 2
          ? 48
          : yearGap < 6
            ? 36
            : 28
        : yearGap < 2
          ? 64
          : yearGap < 6
            ? 48
            : 36
      if (pxGap < minPx) return false
      continue
    }
    if (pxGap < 52 && yearGap < 3) return false
  }

  pickedIds.add(id)
  picked.push(candidate)
  return true
}

/**
 * Guarantee seats for root/parents/grandparents when they fall in-view and the
 * axis has room — generation proximity outranks pure temporal spread.
 * On century+ views, keep near-gen to a cameo so eras can fill the axis.
 */
function pickNearGenerationSeats(
  events: FamilyEvent[],
  picked: FamilyEvent[],
  pickedIds: Set<string>,
  limit: number,
  start: number,
  end: number,
  span: number,
  width: number,
  scoreOf: (event: FamilyEvent) => number,
): void {
  const inView = events.filter(
    (e) => e.year >= start && e.year <= end && isNearGeneration(e.person, 2),
  )
  if (!inView.length) return

  const pxPerYear = width / Math.max(1, span)
  const roomy = pxPerYear >= 12
  const wideView = span >= 40
  const target = Math.min(
    inView.length,
    wideView
      ? Math.min(span > 180 ? 2 : 4, Math.max(2, Math.ceil(limit * 0.35)))
      : roomy
        ? Math.max(4, Math.min(6, Math.ceil(limit * 0.65)))
        : Math.min(3, limit),
  )

  const ranked = [...inView].sort((a, b) => {
    const ga = generationDistance(a.person)
    const gb = generationDistance(b.person)
    if (ga !== gb) return ga - gb
    const kindRank = (k: FamilyEvent['kind']) =>
      k === 'birth' ? 0 : k === 'move' ? 1 : k === 'death' ? 2 : 3
    if (kindRank(a.kind) !== kindRank(b.kind)) return kindRank(a.kind) - kindRank(b.kind)
    return scoreOf(b) - scoreOf(a) || a.year - b.year
  })

  let nearCount = picked.filter((e) => isNearGeneration(e.person, 2)).length
  for (const candidate of ranked) {
    if (picked.length >= limit) break
    if (nearCount >= target) break
    if (tryAddNearGenerationCandidate(candidate, picked, pickedIds, limit, start, span, width)) {
      nearCount++
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
  calloutObstacle?: CollisionObstacle | CalloutObstacles | null,
): FamilyEvent[] {
  if (!events.length || mode === 'detail') return events

  const density = chapterDensity(events, start, end)
  const limit = targetVisibleEventCount(density, mode, events.length, width, span)
  if (limit <= 0) return []

  const bucketCount = temporalBucketCount(mode, span, events.length)
  const buckets = assignTemporalBuckets(events, start, end, bucketCount)
  const picked: FamilyEvent[] = []
  const pickedIds = new Set<string>()
  const probeContext = pickedProbeContext(start, span, width, calloutObstacle)

  // Near-generation first so parents are not crowded out by temporal-spread quotas.
  // Far/century views: fill eras first so the present cannot monopolize the atlas.
  // Generation-scale mid zooms: keep a near-gen cameo, then spread across the axis.
  if (mode === 'far' || span > 180) {
    pickEraQuotas(events, picked, pickedIds, limit, start, end, span, width, density, scoreOf)
    pickNearGenerationSeats(events, picked, pickedIds, limit, start, end, span, width, scoreOf)
  } else if (span >= 40) {
    pickNearGenerationSeats(events, picked, pickedIds, limit, start, end, span, width, scoreOf)
    pickZoneQuotas(
      events,
      picked,
      pickedIds,
      limit,
      start,
      end,
      span,
      width,
      density,
      scoreOf,
      calloutObstacle,
    )
    pickEraQuotas(events, picked, pickedIds, limit, start, end, span, width, density, scoreOf, 6)
  } else {
    pickNearGenerationSeats(events, picked, pickedIds, limit, start, end, span, width, scoreOf)
    pickZoneQuotas(
      events,
      picked,
      pickedIds,
      limit,
      start,
      end,
      span,
      width,
      density,
      scoreOf,
      calloutObstacle,
    )
  }

  // Second pass after zone fill — claim any remaining near-gen seats.
  pickNearGenerationSeats(events, picked, pickedIds, limit, start, end, span, width, scoreOf)

  const visitOrder = spreadBucketOrder(bucketCount)
  for (const bucketIdx of visitOrder) {
    if (picked.length >= limit) break
    const bucketEvents = buckets[bucketIdx]
    if (!bucketEvents.length) continue

    const ranked = [...bucketEvents].sort(
      (a, b) =>
        selectionPlacabilityScore(b, probeContext, scoreOf) -
          selectionPlacabilityScore(a, probeContext, scoreOf) ||
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
        score:
          selectionPlacabilityScore(e, probeContext, scoreOf) +
          combinedSelectionScore(e, picked, scoreOf, start, end, span, width),
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

function laneY(height: number, lane: number, viewportWidth = 1200): number {
  const offsets = hybridLaneOffsets(viewportWidth)
  const offset = offsets[Math.min(lane, offsets.length - 1)]
  const axis = timelineAxisY(height, viewportWidth)
  return Math.min(
    familyLabelCeilingY(axis),
    Math.max(familyLabelFloorY(viewportWidth, height), axis - offset),
  )
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
  _markerX: number,
  obstacles?: CalloutObstacles | CollisionObstacle | null,
  editorialObstacles: EditorialObstacle[] = [],
): boolean {
  if (obstacles && 'frame' in obstacles) {
    if (rectsCollide(bounds, obstacles.frame)) return true

    const overlapsConnectorHorizontally = !(
      bounds.right + HYBRID_H_GAP < obstacles.connector.left ||
      bounds.left - HYBRID_H_GAP > obstacles.connector.right
    )
    if (overlapsConnectorHorizontally && rectsCollide(bounds, obstacles.connector)) {
      return true
    }

    if (obstacles.brace && rectsCollide(bounds, obstacles.brace)) return true
  } else if (obstacles && rectsCollide(bounds, obstacles)) {
    return true
  }

  for (const panel of editorialObstacles) {
    if (rectsCollide(bounds, panel)) return true
  }

  return false
}

function hybridAlignmentOrder(
  markerX: number,
  viewportWidth: number,
  editorialObstacles: EditorialObstacle[] = [],
): LabelAlignment[] {
  const rightPanel = editorialObstacles[1]
  const leftPanel = editorialObstacles[0]

  if (rightPanel && markerX > rightPanel.left - 140) {
    return ['right', 'center', 'left']
  }
  if (leftPanel && markerX < leftPanel.right + 140) {
    return ['left', 'center', 'right']
  }

  const centerX = viewportWidth / 2
  if (Math.abs(markerX - centerX) < 150) return ['left', 'right']
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
  editorialObstacles: EditorialObstacle[] = [],
  vGap = HYBRID_V_GAP,
): PlacedRect | null {
  let anchorY = laneY(height, lane, width)
  const footprint = measureDetailedFootprint(event, width, compact)
  if (obstacles && 'frame' in obstacles) {
    const frame = obstacles.frame
    const boundsProbe = footprintBounds(markerX, anchorY, footprint, alignment, nudge, width)
    const overlapsHorizontally = !(
      boundsProbe.right + HYBRID_H_GAP < frame.left ||
      boundsProbe.left - HYBRID_H_GAP > frame.right
    )
    if (overlapsHorizontally && boundsProbe.top < frame.bottom) {
      anchorY += frame.bottom - boundsProbe.top
    }
  }
  for (const panel of editorialObstacles) {
    const boundsProbe = footprintBounds(markerX, anchorY, footprint, alignment, nudge, width)
    const overlapsHorizontally = !(
      boundsProbe.right + HYBRID_H_GAP < panel.left ||
      boundsProbe.left - HYBRID_H_GAP > panel.right
    )
    if (overlapsHorizontally && boundsProbe.top < panel.bottom) {
      anchorY += panel.bottom - boundsProbe.top + 8
    }
  }
  const ceiling = familyLabelCeilingY(timelineAxisY(height, width))
  if (anchorY > ceiling) anchorY = ceiling

  const bounds = footprintBounds(markerX, anchorY, footprint, alignment, nudge, width)
  const rect: PlacedRect = {
    left: bounds.left,
    right: bounds.right,
    top: bounds.top,
    bottom: bounds.bottom,
    markerX,
    anchorY,
  }

  if (collidesWithObstacles(rect, markerX, obstacles, editorialObstacles)) return null

  // Near-family pairs may stack closer than distant labels, but not on top of each other.
  const gap = isNearGeneration(event.person) ? Math.min(vGap, 20) : vGap

  for (const other of placed) {
    const hClear =
      rect.right + HYBRID_H_GAP < other.left || other.right + HYBRID_H_GAP < rect.left
    const vClear = rect.bottom + gap < other.top || other.bottom + gap < rect.top
    if (!hClear && !vClear) return null
    if (stemIntersectsBox(markerX, anchorY, footprint.stemHeight, other)) return null
    if (stemIntersectsBox(other.markerX, other.anchorY, footprint.stemHeight, rect)) return null
  }

  return rect
}

function plaqueFlankNudges(
  obstacles: CalloutObstacles,
  markerX: number,
): Array<{ alignment: LabelAlignment; nudge: number }> {
  const gap = PLACEMENT_PROBE_GAP
  const reservedLeft = Math.min(obstacles.frame.left, obstacles.connector.left) - gap
  const reservedRight = Math.max(obstacles.frame.right, obstacles.connector.right) + gap
  // Drop extreme flanks — they read as date misalignment; prefer a higher lane instead.
  const maxFlank = 72

  return [
    { alignment: 'right' as const, nudge: reservedLeft - markerX },
    { alignment: 'left' as const, nudge: reservedRight - markerX },
  ].filter(({ nudge }) => Math.abs(nudge) <= maxFlank)
}

function tryPlaqueFlankPlacement(
  event: FamilyEvent,
  markerX: number,
  width: number,
  height: number,
  placed: PlacedRect[],
  obstacles: CalloutObstacles | CollisionObstacle | null | undefined,
  editorialObstacles: EditorialObstacle[],
  minLane: number,
  compact: boolean,
): { rect: PlacedRect; alignment: LabelAlignment; nudge: number; lane: number; compact: boolean } | null {
  if (!obstacles || !('frame' in obstacles)) return null

  const maxLanes = hybridMaxLanes(width)
  for (let lane = minLane; lane < maxLanes; lane++) {
    for (const { alignment, nudge } of plaqueFlankNudges(obstacles, markerX)) {
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
        compact,
        editorialObstacles,
      )
      if (rect) return { rect, alignment, nudge, lane, compact }
    }
  }

  return null
}

function placeOneHybridEvent(
  event: FamilyEvent,
  markerX: number,
  width: number,
  height: number,
  placed: PlacedRect[],
  obstacles: CalloutObstacles | CollisionObstacle | null | undefined,
  editorialObstacles: EditorialObstacle[],
  minLane = 0,
  forceAlignment?: LabelAlignment,
  preferCompact = false,
): HybridPlacedEvent | null {
  if (markerUnderCallout(markerX, obstacles)) {
    const flank = tryPlaqueFlankPlacement(
      event,
      markerX,
      width,
      height,
      placed,
      obstacles,
      editorialObstacles,
      minLane,
      preferCompact || false,
    )
    if (flank) {
      placed.push(flank.rect)
      const footprint = measureDetailedFootprint(event, width, flank.compact)
      const adjustedNudge = effectiveLabelNudge(
        markerX,
        flank.rect.anchorY,
        footprint,
        flank.alignment,
        flank.nudge,
        width,
      )
      return {
        event,
        x: markerX,
        y: flank.rect.anchorY,
        alignment: flank.alignment,
        nudge: adjustedNudge,
        compact: flank.compact,
        lane: flank.lane,
      }
    }
  }

  const alignments =
    forceAlignment != null
      ? [
          forceAlignment,
          ...hybridAlignmentOrder(markerX, width, editorialObstacles).filter((a) => a !== forceAlignment),
        ]
      : hybridAlignmentOrder(markerX, width, editorialObstacles)

  const maxLanes = hybridMaxLanes(width)
  const compactPasses = isCompactStage(width) || preferCompact ? [true] : [false, true]

  for (const compact of compactPasses) {
    for (let lane = minLane; lane < maxLanes; lane++) {
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
            compact,
            editorialObstacles,
          )
          if (rect) {
            placed.push(rect)
            const footprint = measureDetailedFootprint(event, width, compact)
            const adjustedNudge = effectiveLabelNudge(
              markerX,
              rect.anchorY,
              footprint,
              alignment,
              nudge,
              width,
            )
            return { event, x: markerX, y: rect.anchorY, alignment, nudge: adjustedNudge, compact, lane }
          }
        }
      }
    }
  }

  const flank = tryPlaqueFlankPlacement(
    event,
    markerX,
    width,
    height,
    placed,
    obstacles,
    editorialObstacles,
    minLane,
    true,
  )
  if (flank) {
    placed.push(flank.rect)
    const footprint = measureDetailedFootprint(event, width, flank.compact)
    const adjustedNudge = effectiveLabelNudge(
      markerX,
      flank.rect.anchorY,
      footprint,
      flank.alignment,
      flank.nudge,
      width,
    )
    return {
      event,
      x: markerX,
      y: flank.rect.anchorY,
      alignment: flank.alignment,
      nudge: adjustedNudge,
      compact: flank.compact,
      lane: flank.lane,
    }
  }

  // Last resort: ignore callout obstacles only — still refuse label/label overlap.
  for (let lane = Math.max(minLane, maxLanes - 3); lane < maxLanes; lane++) {
    for (const alignment of alignments) {
      const rect = tryHybridPlacement(
        event,
        markerX,
        width,
        height,
        placed,
        null,
        lane,
        alignment,
        0,
        true,
        editorialObstacles,
      )
      if (rect) {
        placed.push(rect)
        const footprint = measureDetailedFootprint(event, width, true)
        const adjustedNudge = effectiveLabelNudge(
          markerX,
          rect.anchorY,
          footprint,
          alignment,
          0,
          width,
        )
        return {
          event,
          x: markerX,
          y: rect.anchorY,
          alignment,
          nudge: adjustedNudge,
          compact: true,
          lane,
        }
      }
    }
  }

  // Prefer residual clustering over stacked labels (TIMELINE_RULES: zero overlap).
  return null
}

function applyCachedHybridPlacement(
  event: FamilyEvent,
  profile: StableLandmarkPlacement,
  markerX: number,
  width: number,
  height: number,
  placedRects: PlacedRect[],
  obstacles: CalloutObstacles | CollisionObstacle | null | undefined,
  editorialObstacles: EditorialObstacle[],
): HybridPlacedEvent | null {
  const rect = tryHybridPlacement(
    event,
    markerX,
    width,
    height,
    placedRects,
    obstacles,
    profile.lane,
    profile.alignment,
    profile.nudge,
    profile.compact,
    editorialObstacles,
  )
  if (!rect) return null

  placedRects.push(rect)
  return {
    event,
    x: markerX,
    y: rect.anchorY,
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
  const wideAtlas = mode === 'far' || span >= 40
  // Century views: keep the plaque card reserved, but do not let sidenotes + brace
  // consume the whole axis — render-time clamps still clear Featured Story / Thinking.
  const editorialObstacles = wideAtlas ? [] : estimateEditorialSidenoteObstacles(width)
  const activeObstacles = softenCalloutObstaclesForWideAtlas(obstacles, wideAtlas, width)

  const debugRejected: LandmarkDebugSnapshot['rejected'] = []
  const debugReplacements: LandmarkDebugSnapshot['replacements'] = []

  const markerEntries = candidates.map((event) => ({
    event,
    markerX: yearX(event.year, start, span, width),
    labelWidth: measureDetailedFootprint(event, width, false).width,
  }))

  const groups = groupByLabelProximity(
    markerEntries.map((entry) => ({
      item: entry,
      markerX: entry.markerX,
      labelWidth: entry.labelWidth,
    })),
    HYBRID_H_GAP,
  )

  const placementPlan: Array<{
    event: FamilyEvent
    markerX: number
    minLane: number
    forceAlignment?: LabelAlignment
  }> = []

  for (const group of groups) {
    const ordered = [...group]
      .map((entry) => entry.item)
      .sort(
        (a, b) =>
          generationDistance(a.event.person) - generationDistance(b.event.person) ||
          _scoreOf(b.event) - _scoreOf(a.event) ||
          a.event.year - b.event.year ||
          a.event.person.name.localeCompare(b.event.person.name),
      )

    ordered.forEach((entry, groupIndex) => {
      placementPlan.push({
        event: entry.event,
        markerX: entry.markerX,
        minLane: minLaneForGroupIndex(groupIndex, hybridMaxLanes(width), ordered.length),
        forceAlignment: ordered.length > 1 ? staggerAlignmentForIndex(groupIndex) : undefined,
      })
    })
  }

  placementPlan.sort((a, b) => {
    // On generation+ views, favor temporal spread over near-gen first-claim.
    if (span >= 40 || mode === 'far') {
      return (
        a.event.year - b.event.year ||
        _scoreOf(b.event) - _scoreOf(a.event) ||
        a.event.person.name.localeCompare(b.event.person.name)
      )
    }
    const ga = generationDistance(a.event.person)
    const gb = generationDistance(b.event.person)
    if (ga !== gb) return ga - gb
    const nearA = isNearGeneration(a.event.person) ? 0 : 1
    const nearB = isNearGeneration(b.event.person) ? 0 : 1
    if (nearA !== nearB) return nearA - nearB
    return (
      _scoreOf(b.event) - _scoreOf(a.event) ||
      a.event.year - b.event.year ||
      a.event.person.name.localeCompare(b.event.person.name)
    )
  })

  for (const plan of placementPlan) {
    const { event, markerX, minLane, forceAlignment } = plan
    const failedZone = zoneForYear(event.year, start, end)
    const eventId = canonicalEventId(event)
    const cached = getStableLandmarkPlacement(stabilityKey, eventId)

    if (cached) {
      const cachedResult = applyCachedHybridPlacement(
        event,
        cached,
        markerX,
        width,
        height,
        placedRects,
        activeObstacles,
        editorialObstacles,
      )
      if (cachedResult) {
        placed.push(cachedResult)
        placedIds.add(eventId)
        continue
      }
    }

    let result = placeOneHybridEvent(
      event,
      markerX,
      width,
      height,
      placedRects,
      activeObstacles,
      editorialObstacles,
      minLane,
      forceAlignment,
      wideAtlas)
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

  const probeContext = pickedProbeContext(start, span, width, activeObstacles)

  // Recover near-generation landmarks that lost a lane — displace a farther relative first.
  for (const failed of [...unplaced]) {
    if (!isNearGeneration(failed.person, 1)) continue
    const failedGen = generationDistance(failed.person)

    const victims = placed
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => generationDistance(entry.event.person) > failedGen)
      .sort(
        (a, b) =>
          generationDistance(b.entry.event.person) - generationDistance(a.entry.event.person) ||
          _scoreOf(a.entry.event) - _scoreOf(b.entry.event),
      )

    for (const { entry: victim, index: victimIndex } of victims) {
      const victimId = canonicalEventId(victim.event)
      const removedRects = placedRects.splice(victimIndex, 1)
      const removedPlaced = placed.splice(victimIndex, 1)
      placedIds.delete(victimId)

      const markerX = yearX(failed.year, start, span, width)
      const result = placeOneHybridEvent(
        failed,
        markerX,
        width,
        height,
        placedRects,
        activeObstacles,
        editorialObstacles,
        0,
        undefined,
        wideAtlas)

      if (result) {
        rememberStableLandmarkPlacement(stabilityKey, canonicalEventId(failed), {
          lane: result.lane,
          alignment: result.alignment,
          nudge: result.nudge,
          compact: result.compact,
        })
        placed.push(result)
        placedIds.add(canonicalEventId(failed))
        const failedIndex = unplaced.findIndex(
          (event) => canonicalEventId(event) === canonicalEventId(failed),
        )
        if (failedIndex >= 0) unplaced.splice(failedIndex, 1)
        unplaced.push(victim.event)
        break
      }

      // Restore victim if the swap did not free a lane for the nearer person.
      if (removedRects[0]) placedRects.splice(victimIndex, 0, removedRects[0])
      if (removedPlaced[0]) placed.splice(victimIndex, 0, removedPlaced[0])
      placedIds.add(victimId)
    }
  }

  for (const failed of [...unplaced]) {
    const zone = zoneForYear(failed.year, start, end)
    const failedGen = generationDistance(failed.person)
    const replacements = alternates
      .filter(
        (event) =>
          zoneForYear(event.year, start, end) === zone &&
          !placedIds.has(canonicalEventId(event)) &&
          canonicalEventId(event) !== canonicalEventId(failed) &&
          // Never replace a nearer person with a more distant relative.
          !(isNearGeneration(failed.person, 1) && generationDistance(event.person) > failedGen),
      )
      .sort(
        (a, b) =>
          generationDistance(a.person) - generationDistance(b.person) ||
          selectionPlacabilityScore(b, probeContext, _scoreOf) -
            selectionPlacabilityScore(a, probeContext, _scoreOf) ||
          _scoreOf(b) - _scoreOf(a),
      )

    for (const replacement of replacements) {
      const markerX = yearX(replacement.year, start, span, width)
      const result = placeOneHybridEvent(
        replacement,
        markerX,
        width,
        height,
        placedRects,
        activeObstacles,
        editorialObstacles,
        0,
        undefined,
        wideAtlas)
      if (!result) continue
      rememberStableLandmarkPlacement(stabilityKey, canonicalEventId(replacement), {
        lane: result.lane,
        alignment: result.alignment,
        nudge: result.nudge,
        compact: result.compact,
      })
      placed.push(result)
      placedIds.add(canonicalEventId(replacement))
      const failedIndex = unplaced.findIndex((event) => canonicalEventId(event) === canonicalEventId(failed))
      if (failedIndex >= 0) unplaced.splice(failedIndex, 1)
      break
    }
  }

  // Final near-generation rescue: prefer parents over more distant markers when lanes collide.
  // Skip on century+ views — temporal spread matters more than household completeness.
  const unresolvedNear = unplaced.filter((event) => isNearGeneration(event.person, 1))
  if (unresolvedNear.length && mode !== 'far' && span < 40) {
    const nearPlaced: HybridPlacedEvent[] = []
    const nearRects: PlacedRect[] = []
    const otherPlaced: HybridPlacedEvent[] = []
    placed.forEach((entry, index) => {
      if (isNearGeneration(entry.event.person, 1)) {
        nearPlaced.push(entry)
        nearRects.push(placedRects[index])
      } else {
        otherPlaced.push(entry)
      }
    })

    placed.length = 0
    placedRects.length = 0
    placedIds.clear()
    for (let i = 0; i < nearPlaced.length; i++) {
      placed.push(nearPlaced[i])
      placedRects.push(nearRects[i])
      placedIds.add(canonicalEventId(nearPlaced[i].event))
    }

    for (const failed of unresolvedNear) {
      if (placedIds.has(canonicalEventId(failed))) continue
      const markerX = yearX(failed.year, start, span, width)
      const result = placeOneHybridEvent(
        failed,
        markerX,
        width,
        height,
        placedRects,
        null,
        [],
        0,
        undefined,
        wideAtlas)
      if (!result) continue
      rememberStableLandmarkPlacement(stabilityKey, canonicalEventId(failed), {
        lane: result.lane,
        alignment: result.alignment,
        nudge: result.nudge,
        compact: result.compact,
      })
      placed.push(result)
      placedIds.add(canonicalEventId(failed))
      const failedIndex = unplaced.findIndex(
        (event) => canonicalEventId(event) === canonicalEventId(failed),
      )
      if (failedIndex >= 0) unplaced.splice(failedIndex, 1)
    }

    for (const entry of otherPlaced) {
      const markerX = yearX(entry.event.year, start, span, width)
      const result = placeOneHybridEvent(
        entry.event,
        markerX,
        width,
        height,
        placedRects,
        activeObstacles,
        editorialObstacles,
        0,
        undefined,
        wideAtlas)
      if (!result) {
        unplaced.push(entry.event)
        continue
      }
      placed.push(result)
      placedIds.add(canonicalEventId(entry.event))
    }
  }

  for (const zone of ['left', 'center', 'right'] as const) {
    const hasPlacedInZone = placed.some(
      (entry) => zoneForYear(entry.event.year, start, end) === zone,
    )
    if (hasPlacedInZone) continue

    const candidates = alternates
      .filter(
        (event) =>
          zoneForYear(event.year, start, end) === zone &&
          !placedIds.has(canonicalEventId(event)),
      )
      .sort(
        (a, b) =>
          _scoreOf(b) - _scoreOf(a) ||
          selectionPlacabilityScore(b, probeContext, _scoreOf) -
            selectionPlacabilityScore(a, probeContext, _scoreOf),
      )

    for (const event of candidates) {
      const markerX = yearX(event.year, start, span, width)
      const result = placeOneHybridEvent(
        event,
        markerX,
        width,
        height,
        placedRects,
        activeObstacles,
        editorialObstacles,
        0,
        undefined,
        wideAtlas)
      if (!result) continue
      rememberStableLandmarkPlacement(stabilityKey, canonicalEventId(event), {
        lane: result.lane,
        alignment: result.alignment,
        nudge: result.nudge,
        compact: result.compact,
      })
      placed.push(result)
      placedIds.add(canonicalEventId(event))
      break
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
      const result = placeOneHybridEvent(
        event,
        markerX,
        width,
        height,
        placedRects,
        activeObstacles,
        editorialObstacles,
        0,
        undefined,
        wideAtlas)
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

  // All zoom levels: history-style vertical stagger; drop what cannot fit cleanly.
  const staggered = staggerFamilyEventLanes(placed, height, span, width)
  for (const entry of staggered) {
    rememberStableLandmarkPlacement(stabilityKey, canonicalEventId(entry.event), {
      lane: entry.lane,
      alignment: entry.alignment,
      nudge: entry.nudge,
      compact: entry.compact,
    })
  }
  const staggeredIds = new Set(staggered.map((entry) => canonicalEventId(entry.event)))
  for (const entry of placed) {
    const id = canonicalEventId(entry.event)
    if (!staggeredIds.has(id)) unplaced.push(entry.event)
  }
  return { placed: staggered, unplaced }
}

export function estimateCalloutObstacle(
  chapters: StoryChapter[],
  start: number,
  span: number,
  width: number,
  axisY = 0,
  _zoomMode: SemanticZoomMode = 'medium',
  viewportHeight = 720,
): CalloutObstacles | null {
  if (!chapters.length || width <= 0) return null

  // Plaque position/style are zoom-invariant — always reserve the far layout box.
  const zoomMode: SemanticZoomMode = 'far'
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
      ? (() => {
          const rawLeft = brace.left
          const rawRight = brace.right
          const rawWidth = rawRight - rawLeft
          // Cap brace collision so a multi-century chapter does not reserve half the axis.
          const maxBraceCollision = Math.min(width * 0.42, Math.max(halfW * 2 + 48, 320))
          if (rawWidth <= maxBraceCollision) {
            return {
              left: rawLeft,
              right: rawRight,
              top: brace.bracketY - brace.capDrop - 2,
              bottom: brace.bracketY + brace.capDrop + 4,
            }
          }
          const mid = (rawLeft + rawRight) / 2
          return {
            left: mid - maxBraceCollision / 2,
            right: mid + maxBraceCollision / 2,
            top: brace.bracketY - brace.capDrop - 2,
            bottom: brace.bracketY + brace.capDrop + 4,
          }
        })()
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

const PLAQUE_EVENT_CLEARANCE_PX = 36

/** Merge estimated callout geometry with a measured plaque anchor from the DOM. */
export function resolveCalloutObstacle(
  chapters: StoryChapter[],
  start: number,
  span: number,
  width: number,
  axisY = 0,
  zoomMode: SemanticZoomMode = 'medium',
  viewportHeight = 720,
  measuredPlaque?: MeasuredPlaqueAnchor | null,
): CalloutObstacles | null {
  const estimated = estimateCalloutObstacle(chapters, start, span, width, axisY, zoomMode, viewportHeight)
  if (!measuredPlaque) return estimated

  const gap = PLAQUE_EVENT_CLEARANCE_PX
  const measuredHalfW = measuredPlaque.width / 2 + 28
  const measuredBottom = measuredPlaque.bottomY + gap

  if (!estimated) {
    return {
      frame: {
        left: measuredPlaque.centerX - measuredHalfW,
        right: measuredPlaque.centerX + measuredHalfW,
        top: 0,
        bottom: measuredBottom,
      },
      connector: {
        left: measuredPlaque.centerX - 16,
        right: measuredPlaque.centerX + 16,
        top: measuredPlaque.bottomY,
        bottom: measuredPlaque.bottomY + 140,
      },
      brace: null,
    }
  }

  const frameHalfW = Math.max(measuredHalfW, (estimated.frame.right - estimated.frame.left) / 2)

  return {
    ...estimated,
    frame: {
      left: measuredPlaque.centerX - frameHalfW,
      right: measuredPlaque.centerX + frameHalfW,
      top: Math.min(estimated.frame.top, 0),
      bottom: Math.max(estimated.frame.bottom, measuredBottom),
    },
    connector: {
      ...estimated.connector,
      left: Math.min(estimated.connector.left, measuredPlaque.centerX - 16),
      right: Math.max(estimated.connector.right, measuredPlaque.centerX + 16),
      top: Math.min(estimated.connector.top, measuredPlaque.bottomY),
    },
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
