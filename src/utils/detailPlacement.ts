import type { FamilyEvent } from '../types'
import { canonicalEventId } from './canonicalEvent'
import {
  categoryLabel,
  displayName,
  effectiveLabelNudge,
  footprintBounds,
  measureDetailedFootprint,
  stemIntersectsBox,
  type LabelAlignment,
  type MeasuredFootprint,
} from './labelMeasure'
import { movementSummary } from './placeUtils'
import { MIN_VIEWPORT_EVENTS } from './semanticZoom'
import { yearX } from './timelineMath'

export type DetailPlacedEvent = {
  event: FamilyEvent
  x: number
  y: number
  alignment: LabelAlignment
  nudge: number
  compact: boolean
  lane: number
}

export const DETAIL_MAX_LANES = 5
export const DETAIL_LANE_OFFSETS = [44, 88, 132, 176, 220]
export const DETAIL_NUDGES = [0, -36, -24, -12, 12, 24, 36] as const
export const DETAIL_H_GAP = 22
export const DETAIL_V_GAP = 14
export const DETAIL_EDGE_PAD = 24
export const NEAR_DATE_PX = 16

type PlacedRect = {
  left: number
  right: number
  top: number
  bottom: number
  markerX: number
  anchorY: number
  alignment: LabelAlignment
}

type PlacementCandidate = {
  lane: number
  alignment: LabelAlignment
  nudge: number
  compact: boolean
  footprint: MeasuredFootprint
  bounds: ReturnType<typeof footprintBounds>
}

function laneY(height: number, lane: number): number {
  const axis = height * 0.54
  const minAnchorY = 64
  const offset = DETAIL_LANE_OFFSETS[Math.min(lane, DETAIL_MAX_LANES - 1)]
  return Math.max(minAnchorY, axis - offset)
}

function rectsCollide(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
): boolean {
  return !(
    a.right + DETAIL_H_GAP < b.left ||
    b.right + DETAIL_H_GAP < a.left ||
    a.bottom + DETAIL_V_GAP < b.top ||
    b.bottom + DETAIL_V_GAP < a.top
  )
}

function placementCollides(
  markerX: number,
  anchorY: number,
  bounds: PlacedRect,
  placed: PlacedRect[],
  footprint: MeasuredFootprint,
): boolean {
  for (const other of placed) {
    if (rectsCollide(bounds, other)) return true
    if (stemIntersectsBox(markerX, anchorY, footprint.stemHeight, other)) return true
    if (stemIntersectsBox(other.markerX, other.anchorY, footprint.stemHeight, bounds)) return true
  }
  return false
}

function preferredLane(score: number): number {
  if (score >= 850) return 0
  if (score >= 600) return 1
  if (score >= 400) return 2
  return 3
}

function laneOrder(preferred: number): number[] {
  const order = [preferred]
  for (let i = 0; i < DETAIL_MAX_LANES; i++) {
    if (!order.includes(i)) order.push(i)
  }
  return order
}

function edgeAlignment(markerX: number, viewportWidth: number): LabelAlignment | null {
  if (markerX < DETAIL_EDGE_PAD + 95) return 'left'
  if (markerX > viewportWidth - DETAIL_EDGE_PAD - 95) return 'right'
  return null
}

function opposingAlignment(markerX: number, placed: PlacedRect[], viewportWidth: number): LabelAlignment {
  const edge = edgeAlignment(markerX, viewportWidth)
  if (edge) return edge

  const nearby = placed
    .filter((p) => Math.abs(p.markerX - markerX) < 110)
    .sort((a, b) => Math.abs(a.markerX - markerX) - Math.abs(b.markerX - markerX))

  if (!nearby.length) return 'center'
  const closest = nearby[0]
  if (closest.alignment === 'left') return 'right'
  if (closest.alignment === 'right') return 'left'
  return markerX < closest.markerX ? 'left' : 'right'
}

function alignmentOrder(markerX: number, placed: PlacedRect[], viewportWidth: number): LabelAlignment[] {
  const edge = edgeAlignment(markerX, viewportWidth)
  if (edge) return [edge, edge === 'left' ? 'center' : 'right', 'center']

  const oppose = opposingAlignment(markerX, placed, viewportWidth)
  const order: LabelAlignment[] = [oppose, 'center']
  if (oppose === 'left') order.push('right')
  else if (oppose === 'right') order.push('left')
  else order.push('left', 'right')
  return [...new Set(order)]
}

function tryPlacement(
  markerX: number,
  event: FamilyEvent,
  viewportWidth: number,
  height: number,
  placed: PlacedRect[],
  lane: number,
  alignment: LabelAlignment,
  nudge: number,
  compact: boolean,
): PlacementCandidate | null {
  const anchorY = laneY(height, lane)
  const footprint = measureDetailedFootprint(event, viewportWidth, compact)
  const bounds = footprintBounds(markerX, anchorY, footprint, alignment, nudge, viewportWidth)

  const boundsRect: PlacedRect = {
    left: bounds.left,
    right: bounds.right,
    top: bounds.top,
    bottom: bounds.bottom,
    markerX,
    anchorY,
    alignment,
  }

  if (placementCollides(markerX, anchorY, boundsRect, placed, footprint)) return null
  return { lane, alignment, nudge, compact, footprint, bounds }
}

function findDetailPlacement(
  event: FamilyEvent,
  markerX: number,
  viewportWidth: number,
  height: number,
  placed: PlacedRect[],
  score: number,
  forceLane?: number,
  forceAlignment?: LabelAlignment,
): PlacementCandidate | null {
  const lanes = forceLane != null ? [forceLane, ...laneOrder(preferredLane(score)).filter((l) => l !== forceLane)] : laneOrder(preferredLane(score))
  const alignments =
    forceAlignment != null
      ? [forceAlignment, ...alignmentOrder(markerX, placed, viewportWidth).filter((a) => a !== forceAlignment)]
      : alignmentOrder(markerX, placed, viewportWidth)

  for (const lane of lanes) {
    for (const alignment of alignments) {
      for (const nudge of DETAIL_NUDGES) {
        const attempt = tryPlacement(markerX, event, viewportWidth, height, placed, lane, alignment, nudge, false)
        if (attempt) return attempt
      }
    }
  }

  for (const lane of lanes) {
    for (const alignment of alignments) {
      for (const nudge of DETAIL_NUDGES) {
        const attempt = tryPlacement(markerX, event, viewportWidth, height, placed, lane, alignment, nudge, true)
        if (attempt) return attempt
      }
    }
  }

  return null
}

function forceCompactPlacement(
  event: FamilyEvent,
  markerX: number,
  viewportWidth: number,
  height: number,
  placed: PlacedRect[],
  score: number,
): PlacementCandidate | null {
  const lanes = laneOrder(preferredLane(score))
  const alignments: LabelAlignment[] = ['left', 'right', 'center']

  for (const lane of lanes) {
    for (const alignment of alignments) {
      for (const nudge of DETAIL_NUDGES) {
        const attempt = tryPlacement(markerX, event, viewportWidth, height, placed, lane, alignment, nudge, true)
        if (attempt) return attempt
      }
    }
  }

  const lane = DETAIL_MAX_LANES - 1
  const anchorY = laneY(height, lane)
  const footprint = measureDetailedFootprint(event, viewportWidth, true)
  const alignment = edgeAlignment(markerX, viewportWidth) ?? 'center'
  const bounds = footprintBounds(markerX, anchorY, footprint, alignment, 0, viewportWidth)
  return { lane, alignment, nudge: 0, compact: true, footprint, bounds }
}

function sortDetailEvents(
  events: FamilyEvent[],
  scoreOf: (event: FamilyEvent) => number,
): { event: FamilyEvent; markerX: number; score: number }[] {
  return [...events]
    .sort(
      (a, b) =>
        scoreOf(b) - scoreOf(a) ||
        a.year - b.year ||
        a.person.name.localeCompare(b.person.name),
    )
    .map((event) => ({ event, markerX: 0, score: scoreOf(event) }))
}

export function placeDetailEvents(
  candidates: FamilyEvent[],
  start: number,
  span: number,
  width: number,
  height: number,
  scoreOf: (event: FamilyEvent) => number,
): { placed: DetailPlacedEvent[]; unplaced: FamilyEvent[] } {
  const sorted = sortDetailEvents(candidates, scoreOf).map((item) => ({
    ...item,
    markerX: yearX(item.event.year, start, span, width),
  }))
  const placedRects: PlacedRect[] = []
  const placed: DetailPlacedEvent[] = []
  const unplaced: FamilyEvent[] = []

  const markerPositions = sorted
  let i = 0
  while (i < markerPositions.length) {
    const current = markerPositions[i]
    const group = [current]
    let j = i + 1
    while (j < markerPositions.length && Math.abs(markerPositions[j].markerX - current.markerX) < NEAR_DATE_PX) {
      group.push(markerPositions[j])
      j++
    }

    group.forEach((item, groupIndex) => {
      const forceLane = Math.min(DETAIL_MAX_LANES - 1, groupIndex % DETAIL_MAX_LANES)
      const forceAlignment: LabelAlignment =
        groupIndex % 2 === 0 ? 'left' : groupIndex % 3 === 1 ? 'right' : opposingAlignment(item.markerX, placedRects, width)

      let result = findDetailPlacement(
        item.event,
        item.markerX,
        width,
        height,
        placedRects,
        item.score,
        group.length > 1 ? forceLane : undefined,
        group.length > 1 ? forceAlignment : undefined,
      )

      if (!result) {
        result = forceCompactPlacement(item.event, item.markerX, width, height, placedRects, item.score)
      }

      if (!result) {
        unplaced.push(item.event)
        return
      }

      const anchorY = laneY(height, result.lane)
      placedRects.push({
        left: result.bounds.left,
        right: result.bounds.right,
        top: result.bounds.top,
        bottom: result.bounds.bottom,
        markerX: item.markerX,
        anchorY,
        alignment: result.alignment,
      })

      placed.push({
        event: item.event,
        x: item.markerX,
        y: laneY(height, result.lane),
        alignment: result.alignment,
        nudge: effectiveLabelNudge(
          item.markerX,
          anchorY,
          result.footprint,
          result.alignment,
          result.nudge,
          width,
        ),
        compact: result.compact,
        lane: result.lane,
      })
    })

    i = j
  }

  const minimum = Math.min(candidates.length, MIN_VIEWPORT_EVENTS)
  if (placed.length < minimum) {
    const placedIds = new Set(placed.map((item) => canonicalEventId(item.event)))
    const remaining = candidates
      .filter((event) => !placedIds.has(canonicalEventId(event)))
      .sort((a, b) => scoreOf(b) - scoreOf(a) || a.year - b.year)

    for (const event of remaining) {
      if (placed.length >= minimum) break
      const markerX = yearX(event.year, start, span, width)
      let result = findDetailPlacement(event, markerX, width, height, placedRects, scoreOf(event))
      if (!result) {
        result = forceCompactPlacement(event, markerX, width, height, placedRects, scoreOf(event))
      }
      if (!result) continue

      const anchorY = laneY(height, result.lane)
      placedRects.push({
        left: result.bounds.left,
        right: result.bounds.right,
        top: result.bounds.top,
        bottom: result.bounds.bottom,
        markerX,
        anchorY,
        alignment: result.alignment,
      })
      placed.push({
        event,
        x: markerX,
        y: anchorY,
        alignment: result.alignment,
        nudge: effectiveLabelNudge(
          markerX,
          anchorY,
          result.footprint,
          result.alignment,
          result.nudge,
          width,
        ),
        compact: result.compact,
        lane: result.lane,
      })
    }
  }

  return { placed, unplaced }
}

export function eventAccessibleTitle(event: FamilyEvent): string {
  const cat = categoryLabel(event)
  const name = displayName(event)
  const meta =
    event.kind === 'move' || event.kind === 'service'
      ? ` · ${event.detail || movementSummary(event)}`
      : event.person.birthPlace
        ? ` · ${event.person.birthPlace}`
        : ''
  return `${cat} ${name}${meta}`
}
