import type { FamilyEvent, StoryChapter } from '../types'
import { measureEventLabelBox } from './labelMeasure'
import { yearX } from './timelineMath'

/** Named semantic zoom thresholds — tune here. */
export const ZOOM_THRESHOLDS = {
  /** span above this → FAR mode */
  FAR_MAX_SPAN: 200,
  /** span above this (and below FAR) → MEDIUM hybrid */
  MEDIUM_MAX_SPAN: 85,

  /** Nominal detail only when span is at or below this (years visible) */
  DETAIL_MAX_SPAN: 14,

  /** disclosure progress below this → FAR */
  FAR_MAX_DISCLOSURE: 0.18,
  /** disclosure progress below this → MEDIUM */
  MEDIUM_MAX_DISCLOSURE: 0.42,
  /** disclosure progress below this → stay in NEAR hybrid (block detail) */
  NEAR_MAX_DISCLOSURE: 0.72,

  /** Minimum average pixels per year to allow detail mode */
  MIN_PX_PER_YEAR_DETAIL: 52,
  /** Max visible events before density gate blocks detail */
  DETAIL_MAX_VISIBLE_EVENTS: 22,
  /** Max estimated lanes per local region for detail */
  DETAIL_MAX_LANES_PER_REGION: 3,

  /** Target chapter count on desktop far zoom */
  FAR_MIN_CHAPTERS: 5,
  FAR_MAX_CHAPTERS: 8,

  /** Max individually visible event lanes */
  MAX_EVENT_LANES: 4,

  /** Minimum horizontal gap between event label boxes (px) */
  MIN_LABEL_GAP_PX: 24,
} as const

export type SemanticZoomMode = 'far' | 'medium' | 'near' | 'detail'

export type ChapterDensity = 'sparse' | 'moderate' | 'dense' | 'very_dense'

export type DensityGateInput = {
  visible: FamilyEvent[]
  start: number
  span: number
  width: number
  chapters: StoryChapter[]
  chapterMap: Map<string, FamilyEvent[]>
}

export function disclosureProgress(span: number, fullSpan: number): number {
  const clamped = Math.max(6, Math.min(fullSpan, span))
  const ratio = 1 - clamped / fullSpan
  return Math.pow(Math.max(0, ratio), 0.72)
}

export function chapterDensity(
  events: FamilyEvent[],
  yearStart: number,
  yearEnd: number,
): ChapterDensity {
  const count = events.length
  const yearSpan = Math.max(1, yearEnd - yearStart)
  const eventsPerYear = count / yearSpan

  if (count >= 10 || eventsPerYear >= 0.85) return 'very_dense'
  if (count >= 6 || eventsPerYear >= 0.5) return 'dense'
  if (count >= 4 || eventsPerYear >= 0.25) return 'moderate'
  return 'sparse'
}

/** Per-chapter landmark cap based on local density — not a global viewport budget. */
export function landmarksForChapterDensity(
  density: ChapterDensity,
  mode: SemanticZoomMode,
  events: FamilyEvent[],
): number {
  if (mode === 'detail') return events.length

  const avgNameLen =
    events.reduce((sum, e) => sum + e.person.name.length, 0) / Math.max(1, events.length)
  const longLabels = avgNameLen > 20

  const caps: Record<ChapterDensity, { far: number; medium: number; near: number }> = {
    sparse: { far: 2, medium: 4, near: 5 },
    moderate: { far: 1, medium: 3, near: 4 },
    dense: { far: 1, medium: 2, near: 3 },
    very_dense: { far: 0, medium: 2, near: 2 },
  }

  let limit = caps[density][mode]
  if (longLabels) limit = Math.max(mode === 'far' ? 0 : 1, limit - 1)

  if (events.length <= 1) return events.length

  if (density === 'dense' || density === 'very_dense') {
    return Math.min(limit, Math.max(1, events.length - 1))
  }

  return Math.min(limit, events.length)
}

/** @deprecated Use landmarksForChapterDensity */
export function landmarksPerChapter(mode: SemanticZoomMode, eventCount: number): number {
  const density: ChapterDensity =
    eventCount >= 10 ? 'very_dense' : eventCount >= 6 ? 'dense' : eventCount >= 4 ? 'moderate' : 'sparse'
  const stub = Array.from({ length: eventCount }, () => ({
    person: { name: 'Sample Name' },
  })) as FamilyEvent[]
  return landmarksForChapterDensity(density, mode, stub)
}

export function estimateRequiredLanes(
  events: FamilyEvent[],
  start: number,
  span: number,
  width: number,
): number {
  const sorted = [...events].sort((a, b) => a.year - b.year)
  const laneEnds: number[] = []

  for (const event of sorted) {
    const x = yearX(event.year, start, span, width)
    const half = measureEventLabelBox(event).halfWidth
    const left = x - half
    const right = x + half
    let placed = false

    for (let lane = 0; lane < ZOOM_THRESHOLDS.MAX_EVENT_LANES; lane++) {
      const end = laneEnds[lane] ?? -Infinity
      if (end + ZOOM_THRESHOLDS.MIN_LABEL_GAP_PX < left) {
        laneEnds[lane] = right
        placed = true
        break
      }
    }

    if (!placed) return ZOOM_THRESHOLDS.MAX_EVENT_LANES + 1
  }

  return laneEnds.length
}

export function passesDetailDensityGate(input: DensityGateInput): boolean {
  const { visible, span, width, chapters, chapterMap, start } = input

  if (span > ZOOM_THRESHOLDS.DETAIL_MAX_SPAN) return false

  const pxPerYear = width / Math.max(1, span)
  if (pxPerYear < ZOOM_THRESHOLDS.MIN_PX_PER_YEAR_DETAIL) return false

  if (visible.length > ZOOM_THRESHOLDS.DETAIL_MAX_VISIBLE_EVENTS) return false

  const totalLabelWidth = visible.reduce(
    (sum, e) => sum + measureEventLabelBox(e).halfWidth * 2,
    0,
  )
  if (totalLabelWidth > width * 0.7) return false

  for (const chapter of chapters) {
    const events = chapterMap.get(chapter.id) ?? []
    if (events.length < 3) continue

    const lanes = estimateRequiredLanes(events, start, span, width)
    if (lanes > ZOOM_THRESHOLDS.DETAIL_MAX_LANES_PER_REGION) return false

    const chapterSpan = Math.max(1, chapter.yearEnd - chapter.yearStart)
    const density = events.length / chapterSpan
    if (density >= 0.75 && span > 8) return false
  }

  return true
}

export function semanticZoomMode(
  span: number,
  fullSpan: number,
  gate?: DensityGateInput,
): SemanticZoomMode {
  const progress = disclosureProgress(span, fullSpan)

  if (span > ZOOM_THRESHOLDS.FAR_MAX_SPAN || progress < ZOOM_THRESHOLDS.FAR_MAX_DISCLOSURE) {
    return 'far'
  }
  if (span > ZOOM_THRESHOLDS.MEDIUM_MAX_SPAN || progress < ZOOM_THRESHOLDS.MEDIUM_MAX_DISCLOSURE) {
    return 'medium'
  }

  if (span > ZOOM_THRESHOLDS.DETAIL_MAX_SPAN || progress < ZOOM_THRESHOLDS.NEAR_MAX_DISCLOSURE) {
    return 'near'
  }

  if (gate && passesDetailDensityGate(gate)) {
    return 'detail'
  }

  return 'near'
}

/** Whether a residual cluster must remain visible for this mode. */
export function requiresResidualCluster(mode: SemanticZoomMode, hiddenCount: number): boolean {
  if (hiddenCount <= 0) return false
  if (mode === 'far') return true
  if (mode === 'medium' || mode === 'near') return true
  return hiddenCount > 0
}
