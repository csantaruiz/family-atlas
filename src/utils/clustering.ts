import type {
  BirthCluster,
  FamilyEvent,
  FamilyEventGroup,
  FamilyEventKind,
  Person,
  PlacedPerson,
  StoryChapter,
  ZoomMode,
} from '../types'
import {
  assignEventsToChapters,
  buildStoryChaptersForViewport,
  eventRecordId,
} from '../data/buildStoryChapters'
import {
  placeHybridLandmarks,
  resolveCalloutObstacle,
  selectDistributedLandmarks,
  staggerFamilyEventLanes,
  targetVisibleEventCount,
} from './landmarkSelection'
import { stabilizeLandmarkSelection } from './landmarkSelectionStability'
import {
  footprintBounds,
  measureChapterLabelHalfWidth,
  measureDetailedFootprint,
  measureEventLabelBox,
} from './labelMeasure'
import { placeDetailEvents } from './detailPlacement'
import { timelineAxisY, type MeasuredPlaqueAnchor } from './chapterCalloutLayout'
import { familyLabelFloorY } from './stageBreakpoints'
import type { LabelAlignment } from './labelMeasure'
import { canonicalEventId, assertNoDuplicateEvents, dedupeFamilyEvents } from './canonicalEvent'
import { generationProximityScore, isNearGeneration } from './familyPriority'
import {
  chapterDensity,
  disclosureProgress,
  semanticZoomMode,
  ZOOM_THRESHOLDS,
  type ChapterDensity,
  type DensityGateInput,
  type SemanticZoomMode,
} from './semanticZoom'
import { yearX } from './timelineMath'

export type ClusteringLevel = 'full' | 'partial' | 'readable'

export type PlacedFamilyEvent = {
  event: FamilyEvent
  x: number
  y: number
  alignment?: LabelAlignment
  nudge?: number
  compact?: boolean
  lane?: number
}

export type PlacedSpanCluster = {
  chapterId: string
  title: string
  subtitle: string
  from: number
  to: number
  summary: string
  hiddenCount: number
  totalCount: number
  leftX: number
  rightX: number
  x: number
  y: number
  dissolve: number
}

type LaneSlot = {
  left: number
  right: number
  y: number
  lane: number
}

const LANE_OFFSETS = [48, 92, 136, 180]
const CHAPTER_LANE_OFFSET = 224

export { disclosureProgress, semanticZoomMode, ZOOM_THRESHOLDS, chapterDensity }
export type { SemanticZoomMode, ChapterDensity, DensityGateInput }

export function eventKindPriority(kind: FamilyEventKind): number {
  switch (kind) {
    case 'birth':
      return 8
    case 'death':
      return 7
    case 'move':
      return 6
    case 'service':
      return 5
    default:
      return 1
  }
}

function isDirectAncestor(person: Person): boolean {
  return person.generation != null && person.generation <= 5
}

function isCollateral(person: Person): boolean {
  return person.generation != null && person.generation > 5 && !person.focus
}

export { generationProximityScore, isNearGeneration } from './familyPriority'

function marriageJoinsBranches(event: FamilyEvent): boolean {
  const spouses = event.person.spouses ?? []
  if (spouses.length < 1) return false
  const surname = event.person.name.split(/\s+/).pop()?.toLowerCase() ?? ''
  return spouses.some((s) => {
    const spSurname = s.split(/\s+/).pop()?.toLowerCase() ?? ''
    return spSurname && surname && spSurname !== surname
  })
}

/** Importance score — higher = more likely to be a visible landmark. */
export function eventImportanceScore(
  event: FamilyEvent,
  chapters: StoryChapter[],
  earliestYear: number,
  rootPersonId: string,
): number {
  const linkedChapter = chapters.find((c) => c.relatedEventIds.includes(eventRecordId(event)))
  if (linkedChapter && linkedChapter.importance >= 80) {
    return 1000 + linkedChapter.importance + generationProximityScore(event.person)
  }

  // Root life events always lead.
  if (event.person.id === rootPersonId) {
    return 940 + (event.kind === 'birth' ? 20 : event.kind === 'death' ? 10 : 0)
  }

  // Near-generation floor so parents (gen 1) beat distant migrations/cousins when in view.
  if (isNearGeneration(event.person, 2)) {
    const gen = event.person.generation ?? 2
    let score = 900 - gen * 70
    if (event.kind === 'birth') score += 35
    else if (event.kind === 'death') score += 15
    else if (event.kind === 'move') score += 45
    else if (event.kind === 'service') score += 30
    if (event.person.focus) score += 25
    return score
  }

  if (event.kind === 'birth' && event.year <= earliestYear + 8) return 820

  if (event.kind === 'move') {
    let score = 700 + generationProximityScore(event.person)
    if (/chihuahua|california|texas|mexico|england/i.test(`${event.detail} ${event.person.birthPlace}`)) {
      score += 40
    }
    if (event.year >= 1900) score += 45
    else if (event.year >= 1600 && event.year <= 1899) score += 35
    return score
  }

  if (marriageJoinsBranches(event)) return 680 + generationProximityScore(event.person)

  if (event.kind === 'service') return 640 + generationProximityScore(event.person)

  if (event.kind === 'birth' && event.importance >= 10) {
    if (event.importance >= 12 || event.title.length > 20) {
      return 560 + generationProximityScore(event.person)
    }
  }

  if (event.kind === 'birth' && isDirectAncestor(event.person)) {
    return 480 + generationProximityScore(event.person)
  }
  if (event.kind === 'death' && isDirectAncestor(event.person)) {
    return 440 + generationProximityScore(event.person)
  }

  if (event.year >= 1900 && (event.kind === 'birth' || event.kind === 'death')) {
    return 400 + generationProximityScore(event.person)
  }
  if (event.year >= 1600 && event.year <= 1899 && (event.kind === 'birth' || event.kind === 'death')) {
    return 380 + generationProximityScore(event.person)
  }

  if (event.kind === 'birth' && event.person.focus) return 360 + generationProximityScore(event.person)
  if (event.kind === 'death' && event.person.focus) return 340 + generationProximityScore(event.person)

  if (event.kind === 'birth' && isCollateral(event.person)) return 180
  if (event.kind === 'death' && isCollateral(event.person)) return 160

  return 100 + eventKindPriority(event.kind) * 8 + (event.importance ?? 0) * 2 + generationProximityScore(event.person)
}

/** @deprecated Use eventImportanceScore */
export function eventSignificanceScore(
  event: FamilyEvent,
  chapters: StoryChapter[],
  earliestYear: number,
  rootPersonId: string,
): number {
  return eventImportanceScore(event, chapters, earliestYear, rootPersonId)
}

export function estimatedLabelHalfWidth(event: FamilyEvent): number {
  return measureEventLabelBox(event).halfWidth
}

function laneY(height: number, lane: number, width = 1200): number {
  return Math.max(
    familyLabelFloorY(width, height),
    timelineAxisY(height, width) - LANE_OFFSETS[lane],
  )
}

function chapterLaneY(height: number, width = 1200): number {
  return Math.max(
    familyLabelFloorY(width, height),
    timelineAxisY(height, width) - CHAPTER_LANE_OFFSET,
  )
}

function boundsCollide(
  a: { left: number; right: number },
  b: { left: number; right: number },
  gap = ZOOM_THRESHOLDS.MIN_LABEL_GAP_PX,
): boolean {
  return !(a.right + gap < b.left || b.right + gap < a.left)
}

function findCollisionFreeLane(
  x: number,
  halfWidth: number,
  slots: LaneSlot[],
  height: number,
  maxLanes: number = ZOOM_THRESHOLDS.MAX_EVENT_LANES,
  width = 1200,
): LaneSlot | null {
  const bounds = { left: x - halfWidth, right: x + halfWidth }

  for (let lane = 0; lane < maxLanes; lane++) {
    const laneSlots = slots.filter((s) => s.lane === lane)
    const collides = laneSlots.some((s) => boundsCollide(bounds, s))
    if (!collides) {
      return { ...bounds, y: laneY(height, lane, width), lane }
    }
  }

  return null
}

function addPlacedEventSlots(
  placed: PlacedFamilyEvent[],
  width: number,
  slots: LaneSlot[],
): void {
  for (const p of placed) {
    const footprint = measureDetailedFootprint(p.event, width, p.compact ?? false)
    const bounds = footprintBounds(
      p.x,
      p.y,
      footprint,
      p.alignment ?? 'center',
      p.nudge ?? 0,
      width,
    )
    slots.push({
      left: bounds.left,
      right: bounds.right,
      y: p.y,
      lane: p.lane ?? 0,
    })
  }
}

function placeChapterCluster(
  chapter: StoryChapter,
  hiddenCount: number,
  totalCount: number,
  start: number,
  span: number,
  width: number,
  height: number,
  slots: LaneSlot[],
  dissolve: number,
): PlacedSpanCluster | null {
  const leftX = yearX(chapter.yearStart, start, span, width)
  const rightX = yearX(chapter.yearEnd, start, span, width)
  const centerX = (leftX + rightX) / 2
  const halfWidth = measureChapterLabelHalfWidth(chapter.title)
  const bounds = { left: centerX - halfWidth, right: centerX + halfWidth }

  let y = chapterLaneY(height, width)
  const chapterSlots = slots.filter((s) => s.lane >= ZOOM_THRESHOLDS.MAX_EVENT_LANES)
  const collides = chapterSlots.some((s) => boundsCollide(bounds, s))
  if (collides) {
    const altLane = findCollisionFreeLane(centerX, halfWidth, slots, height, 5, width)
    if (!altLane) return null
    y = altLane.y
    slots.push({ ...bounds, y, lane: ZOOM_THRESHOLDS.MAX_EVENT_LANES })
  } else {
    slots.push({ ...bounds, y, lane: ZOOM_THRESHOLDS.MAX_EVENT_LANES })
  }

  return {
    chapterId: chapter.id,
    title: chapter.title,
    subtitle: chapter.subtitle,
    from: chapter.yearStart,
    to: chapter.yearEnd,
    summary: chapter.summary,
    hiddenCount,
    totalCount,
    leftX,
    rightX,
    x: centerX,
    y,
    dissolve,
  }
}

function layoutLocalChapters(
  visible: FamilyEvent[],
  start: number,
  end: number,
  span: number,
  width: number,
  height: number,
  fullSpan: number,
  earliestYear: number,
  presentYear: number,
  rootPersonId: string,
  plaqueAnchor: MeasuredPlaqueAnchor | null = null,
): { events: PlacedFamilyEvent[]; clusters: PlacedSpanCluster[] } {
  const maxChapters = Math.max(ZOOM_THRESHOLDS.FAR_MAX_CHAPTERS, 12)

  const chapters = buildStoryChaptersForViewport(
    visible,
    start,
    end,
    span,
    earliestYear,
    presentYear,
    maxChapters,
    fullSpan,
  )
  const chapterMap = assignEventsToChapters(visible, chapters)

  const gate: DensityGateInput = {
    visible,
    start,
    span,
    width,
    chapters,
    chapterMap,
  }
  const mode = semanticZoomMode(span, fullSpan, gate)

  if (mode === 'detail') {
    const scoreOf = (event: FamilyEvent) =>
      eventImportanceScore(event, chapters, earliestYear, rootPersonId)
    const calloutObstacle = resolveCalloutObstacle(
      chapters,
      start,
      span,
      width,
      timelineAxisY(height, width),
      mode,
      height,
      plaqueAnchor,
    )
    const { placed } = placeDetailEvents(
      visible,
      start,
      span,
      width,
      height,
      scoreOf,
      calloutObstacle,
    )
    const uniquePlaced: PlacedFamilyEvent[] = []
    const seen = new Set<string>()
    for (const p of placed) {
      const id = canonicalEventId(p.event)
      if (seen.has(id)) continue
      seen.add(id)
      uniquePlaced.push(p)
    }
    const staggered = staggerFamilyEventLanes(uniquePlaced, height, span, width)
    staggered.sort((a, b) => a.x - b.x)
    assertNoDuplicateEvents(
      staggered.map((p) => p.event),
      'layoutLocalChapters.detail',
    )
    return { events: staggered, clusters: [] }
  }

  const slots: LaneSlot[] = []
  const clusters: PlacedSpanCluster[] = []

  const scoreOf = (event: FamilyEvent) =>
    eventImportanceScore(event, chapters, earliestYear, rootPersonId)

  const axisY = timelineAxisY(height, width)
  const calloutObstacle = resolveCalloutObstacle(
    chapters,
    start,
    span,
    width,
    axisY,
    mode,
    height,
    plaqueAnchor,
  )

  const density = chapterDensity(visible, start, end)
  const limit = targetVisibleEventCount(density, mode, visible.length, width, span)
  const freshLandmarks = selectDistributedLandmarks(
    visible,
    start,
    end,
    span,
    width,
    mode,
    scoreOf,
    calloutObstacle,
  )
  const landmarkCandidates = stabilizeLandmarkSelection(
    visible,
    freshLandmarks,
    start,
    end,
    span,
    mode,
    limit,
  )

  const { placed: hybridPlaced } = placeHybridLandmarks(
    landmarkCandidates,
    visible,
    start,
    span,
    width,
    height,
    calloutObstacle,
    scoreOf,
    mode,
  )

  const allPlaced: PlacedFamilyEvent[] = hybridPlaced.map((p) => ({
    event: p.event,
    x: p.x,
    y: p.y,
    alignment: p.alignment,
    nudge: p.nudge,
    compact: p.compact,
    lane: p.lane,
  }))

  addPlacedEventSlots(allPlaced, width, slots)

  if (calloutObstacle) {
    slots.push({
      left: calloutObstacle.frame.left,
      right: calloutObstacle.frame.right,
      y: (calloutObstacle.frame.top + calloutObstacle.frame.bottom) / 2,
      lane: 0,
    })
  }

  const placedIds = new Set(allPlaced.map((p) => canonicalEventId(p.event)))

  for (const chapter of chapters) {
    const chapterEvents = (chapterMap.get(chapter.id) ?? []).sort((a, b) => a.year - b.year)
    if (!chapterEvents.length) continue

    const chapterPlacedCount = chapterEvents.filter((e) =>
      placedIds.has(canonicalEventId(e)),
    ).length

    const displayHidden = chapterEvents.length - chapterPlacedCount
    if (displayHidden <= 0) continue

    const hiddenRatio = displayHidden / chapterEvents.length
    const dissolve = (() => {
      if (mode === 'far') {
        if (chapterPlacedCount >= 3) return 0.68
        if (chapterPlacedCount >= 2) return 0.76
        if (chapterPlacedCount >= 1) return 0.84
        return 0.9
      }
      const base = Math.min(1, 0.4 + hiddenRatio * 0.36)
      if (chapterPlacedCount >= 3) return base * 0.72
      if (chapterPlacedCount >= 2) return base * 0.82
      return base
    })()

    const cluster = placeChapterCluster(
      chapter,
      displayHidden,
      chapterEvents.length,
      start,
      span,
      width,
      height,
      slots,
      dissolve,
    )
    if (cluster) clusters.push(cluster)
  }

  allPlaced.sort((a, b) => a.x - b.x)
  clusters.sort((a, b) => a.x - b.x)
  assertNoDuplicateEvents(
    allPlaced.map((p) => p.event),
    'layoutLocalChapters.renderList',
  )
  return { events: allPlaced, clusters }
}

export function clusteringLevel(span: number, mode: ZoomMode): ClusteringLevel {
  if (span > 200 || mode === 'centuries' || mode === 'eras') return 'full'
  if (span > 90 || mode === 'generations' || mode === 'decades') return 'partial'
  return 'readable'
}

export function showBirthPeriodClusters(span: number): boolean {
  return span > 180
}

export function chooseFocus(people: Person[], max: number): Person[] {
  const scored = people
    .map((p) => {
      let score = 0
      if (p.focus) score += 100
      if (p.generation != null) score += Math.max(0, 30 - p.generation)
      score += Math.min(15, (p.children?.length ?? 0) * 3)
      if (p.spouses?.length) score += 4
      if (p.birthPlace) score += 2
      return { p, score }
    })
    .sort((a, b) => b.score - a.score || (a.p.birthYear ?? 0) - (b.p.birthYear ?? 0))
  return scored.slice(0, max).map((x) => x.p).sort((a, b) => (a.birthYear ?? 0) - (b.birthYear ?? 0))
}

export function placeLabels(
  people: Person[],
  start: number,
  span: number,
  width: number,
  height: number,
  occupied: LaneSlot[] = [],
): PlacedPerson[] {
  const slots = [...occupied]
  const items: PlacedPerson[] = []
  const labelHalf = span < 30 ? 90 : span < 90 ? 82 : 72

  for (const p of people) {
    if (!p.birthYear) continue
    const x = yearX(p.birthYear, start, span, width)
    const lane = findCollisionFreeLane(x, labelHalf, slots, height, ZOOM_THRESHOLDS.MAX_EVENT_LANES, width)

    if (!lane) {
      items.push({ person: p, x, y: timelineAxisY(height, width), show: false })
      continue
    }

    slots.push(lane)
    items.push({ person: p, x, y: lane.y, show: true })
  }

  return items
}

export function buildBirthClusters(
  birthPeople: Person[],
  start: number,
  end: number,
  span: number,
  width: number,
  height: number,
  presentYear: number,
): BirthCluster[] {
  const bin = span > 430 ? 100 : span > 280 ? 50 : 25
  const groups: { y: number; people: Person[] }[] = []

  for (let y = Math.floor(start / bin) * bin; y <= end; y += bin) {
    const people = birthPeople.filter(
      (p) =>
        p.birthYear &&
        p.birthYear >= Math.max(start, y) &&
        p.birthYear < Math.min(end, y + bin),
    )
    if (people.length) groups.push({ y, people })
  }

  return groups.map((g, i) => {
    const years = g.people.map((p) => p.birthYear!).filter(Boolean)
    const from = Math.min(...years)
    const to = Math.min(Math.max(...years), presentYear)
    const mid = (from + to) / 2
    const x = yearX(mid, start, span, width)
    const leftX = yearX(from, start, span, width)
    const rightX = yearX(to, start, span, width)
    const displayY = Math.max(
      familyLabelFloorY(width, height) + 16,
      timelineAxisY(height, width) - (i % 2 ? 152 : 88),
    )
    return { y: g.y, people: g.people, from, to, x, leftX, rightX, displayY }
  })
}

export function layoutBirthClustersProgressive(
  _clusters: BirthCluster[],
  birthEvents: FamilyEvent[],
  start: number,
  end: number,
  span: number,
  width: number,
  height: number,
  fullSpan: number,
  earliestYear: number,
  rootPersonId: string,
  presentYear: number,
  plaqueAnchor: MeasuredPlaqueAnchor | null = null,
): { events: PlacedFamilyEvent[]; clusters: PlacedSpanCluster[] } {
  const visible = birthEvents.filter((e) => e.year >= start && e.year <= end)
  return layoutLocalChapters(
    dedupeFamilyEvents(visible),
    start,
    end,
    span,
    width,
    height,
    fullSpan,
    earliestYear,
    presentYear,
    rootPersonId,
    plaqueAnchor,
  )
}

export function clusterThresholdForMode(mode: ZoomMode): number {
  if (mode === 'eras') return 185
  if (mode === 'generations') return 165
  if (mode === 'decades') return 140
  return 95
}

export function eventBudgetForMode(mode: ZoomMode): number {
  if (mode === 'eras') return 5
  if (mode === 'generations') return 7
  if (mode === 'decades') return 9
  return 12
}

export function peopleBudgetForMode(mode: ZoomMode): number {
  if (mode === 'eras') return 3
  if (mode === 'generations') return 4
  if (mode === 'decades') return 4
  return 6
}

export function layoutFamilyEventsProgressive(
  events: FamilyEvent[],
  start: number,
  end: number,
  span: number,
  width: number,
  height: number,
  _mode: ZoomMode,
  fullSpan: number,
  earliestYear: number,
  rootPersonId: string,
  presentYear: number,
  plaqueAnchor: MeasuredPlaqueAnchor | null = null,
): { events: PlacedFamilyEvent[]; clusters: PlacedSpanCluster[] } {
  const visible = dedupeFamilyEvents(
    events.filter((e) => e.year >= start && e.year <= end),
  )
  if (!visible.length) return { events: [], clusters: [] }

  return layoutLocalChapters(
    visible,
    start,
    end,
    span,
    width,
    height,
    fullSpan,
    earliestYear,
    presentYear,
    rootPersonId,
    plaqueAnchor,
  )
}

export function groupFamilyEvents(
  events: FamilyEvent[],
  start: number,
  span: number,
  width: number,
  mode: ZoomMode,
): FamilyEventGroup[] {
  const clusterThreshold = clusterThresholdForMode(mode)
  const sorted = [...events].sort((a, b) => a.year - b.year)
  const groups: FamilyEventGroup[] = []

  for (const e of sorted) {
    const x = yearX(e.year, start, span, width)
    const prev = groups[groups.length - 1]
    if (prev && x - prev.lastX < clusterThreshold) {
      prev.events.push(e)
      prev.lastX = x
      prev.x = prev.events.reduce((s, v) => s + yearX(v.year, start, span, width), 0) / prev.events.length
    } else {
      groups.push({ events: [e], x, lastX: x, importance: 0 })
    }
  }

  groups.forEach(
    (g) =>
      (g.importance =
        Math.max(...g.events.map((e) => e.importance || 0)) + Math.min(4, g.events.length)),
  )

  const eventBudget = eventBudgetForMode(mode)
  if (groups.length <= eventBudget) return groups

  const ranked = [...groups]
    .sort(
      (a, b) =>
        b.importance - a.importance || Math.abs(a.x - width / 2) - Math.abs(b.x - width / 2),
    )
    .slice(0, eventBudget)
  return ranked.sort((a, b) => a.x - b.x)
}

export function assignEventLanes(
  groups: FamilyEventGroup[],
  height: number,
  width = 1200,
): { group: FamilyEventGroup; x: number; y: number }[] {
  const laneLast = LANE_OFFSETS.map(() => -1e9)

  return groups.map((g) => {
    const x = g.x
    let lane = 0
    for (let i = 0; i < LANE_OFFSETS.length; i++) {
      if (x - laneLast[i] > 125) {
        lane = i
        break
      }
    }
    laneLast[lane] = x
    const y = Math.max(
      familyLabelFloorY(width, height) + 8,
      timelineAxisY(height, width) - LANE_OFFSETS[lane],
    )
    return { group: g, x, y }
  })
}

export {
  temporalBucketCount,
  targetVisibleEventCount,
} from './landmarkSelection'
export { eventRecordId }
