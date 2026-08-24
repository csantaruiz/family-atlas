import { isNarrowStage } from './stageBreakpoints'
import type { FamilyEvent } from '../types'
import { canonicalEventId } from './canonicalEvent'

const PHONE_FAMILY_LABEL_SLOT_PX = 150
const PHONE_HISTORY_LABEL_SLOT_PX = 188
const PHONE_DEFAULT_SPAN_YEARS = 130
const PHONE_MAX_NUMBERED_CLUSTERS = 2
const PHONE_CLUSTER_MIN_COUNT = 3

/** Phone opens on a readable chapter of time, not the full atlas. Desktop stays full-span. */
export function defaultTimelineSpan(fullSpan: number, width: number): number {
  if (!isNarrowStage(width)) return fullSpan
  return Math.max(100, Math.min(150, PHONE_DEFAULT_SPAN_YEARS, fullSpan))
}

/**
 * How many family text labels the phone can keep readable at once.
 * Uses century coverage and horizontal slot width — not a hardcoded 1–2.
 */
export function phoneFamilyLabelBudget(span: number, width: number): number {
  if (!isNarrowStage(width)) return Number.POSITIVE_INFINITY
  const centuries = Math.max(1, span / 100)
  const byCentury = Math.max(2, Math.round(centuries * 1.2))
  const byWidth = Math.max(2, Math.floor((width - 32) / PHONE_FAMILY_LABEL_SLOT_PX))
  return Math.max(2, Math.min(3, byCentury, byWidth))
}

export function phoneHistoryLabelBudget(span: number, width: number): number {
  if (!isNarrowStage(width)) return Number.POSITIVE_INFINITY
  const byCentury = Math.max(1, Math.round(span / 180))
  const byWidth = Math.max(1, Math.floor((width - 24) / PHONE_HISTORY_LABEL_SLOT_PX))
  return Math.max(1, Math.min(2, byCentury, byWidth))
}

/** 2–3 lanes, reaching up toward the plaque instead of hugging the axis. */
export function phoneFamilyLaneOffsets(span: number): number[] {
  if (span > 160) return [124, 208]
  if (span > 80) return [118, 196, 268]
  return [108, 186, 252]
}

/** Sit clearly below century ticks so world-event copy does not hit the axis. */
export function phoneHistoryLaneOffsets(span: number): number[] {
  if (span > 160) return [112, 176]
  return [104, 168, 228]
}

export type UnlabeledMarkerGroup<T> = {
  items: T[]
  x: number
}

export type PhoneUnlabeledLayout<T> = {
  ticks: UnlabeledMarkerGroup<T>[]
  clusters: UnlabeledMarkerGroup<T>[]
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/** Pack leftover events into ticks or compact count clusters. */
export function groupUnlabeledMarkers<T>(
  items: Array<{ item: T; x: number }>,
  minGapPx = 18,
): UnlabeledMarkerGroup<T>[] {
  if (!items.length) return []
  const column = Math.max(24, minGapPx)
  const buckets = new Map<number, { items: T[]; xs: number[] }>()
  for (const entry of items) {
    const key = Math.round(entry.x / column)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.items.push(entry.item)
      bucket.xs.push(entry.x)
    } else {
      buckets.set(key, { items: [entry.item], xs: [entry.x] })
    }
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, bucket]) => ({
      items: bucket.items,
      x: mean(bucket.xs),
    }))
}

/** Desktop/tablet keep original admission: unlabeled leftovers are not synthesized. */
export function leftoverUnlabeledLayout<T>(
  items: Array<{ item: T; x: number }>,
  width: number,
): PhoneUnlabeledLayout<T> {
  if (!isNarrowStage(width)) return { ticks: [], clusters: [] }
  return aggregatePhoneUnlabeledMarkers(items, width)
}

export function aggregatePhoneUnlabeledMarkers<T>(
  items: Array<{ item: T; x: number }>,
  width: number,
): PhoneUnlabeledLayout<T> {
  const grouped = groupUnlabeledMarkers(items, Math.max(72, Math.round(width * 0.2)))
  const crowded = grouped
    .filter((group) => group.items.length >= PHONE_CLUSTER_MIN_COUNT)
    .sort((a, b) => b.items.length - a.items.length)

  return {
    ticks: [],
    clusters: crowded.slice(0, PHONE_MAX_NUMBERED_CLUSTERS).sort((a, b) => a.x - b.x),
  }
}

/** Keep label boxes inside the stage without moving the event marker. */
export function clampLabelNudge(
  x: number,
  labelWidth: number,
  viewportWidth: number,
  pad = 10,
): number {
  const half = labelWidth / 2
  const left = x - half
  const right = x + half
  if (left < pad) return pad - left
  if (right > viewportWidth - pad) return viewportWidth - pad - right
  return 0
}

export function eventIdsOf(events: FamilyEvent[]): Set<string> {
  return new Set(events.map((event) => canonicalEventId(event)))
}
