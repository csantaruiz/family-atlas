import type { MapZoomLevel } from './mapSemanticZoom'
import { viewBoxPointToContainerPercent } from './mapSemanticZoom'

export type MapLabelCandidate = {
  id: string
  x: number
  y: number
  text: string
  subtext?: string
  priority: number
  kind: 'major' | 'sub' | 'place' | 'stats' | 'cta'
  widthPx?: number
  heightPx?: number
}

export type PlacedMapLabel = MapLabelCandidate & {
  left: number
  top: number
  offsetY: number
}

const DEFAULT_WIDTH: Record<MapLabelCandidate['kind'], number> = {
  major: 148,
  sub: 112,
  place: 88,
  stats: 120,
  cta: 96,
}

const DEFAULT_HEIGHT: Record<MapLabelCandidate['kind'], number> = {
  major: 52,
  sub: 40,
  place: 22,
  stats: 16,
  cta: 14,
}

function rectsOverlap(
  a: { left: number; top: number; w: number; h: number },
  b: { left: number; top: number; w: number; h: number },
  pad = 6,
): boolean {
  return !(
    a.left + a.w + pad < b.left ||
    b.left + b.w + pad < a.left ||
    a.top + a.h + pad < b.top ||
    b.top + b.h + pad < a.top
  )
}

/**
 * Greedy label placement with collision rejection.
 * Returns highest-priority labels that fit without overlap.
 */
export function layoutMapLabels(
  candidates: MapLabelCandidate[],
  frameWidthPx: number,
  frameHeightPx: number,
  maxLabels?: number,
): PlacedMapLabel[] {
  const sorted = [...candidates].sort((a, b) => b.priority - a.priority)
  const placed: PlacedMapLabel[] = []
  const occupied: { left: number; top: number; w: number; h: number }[] = []

  for (const cand of sorted) {
    if (maxLabels != null && placed.length >= maxLabels) break

    const proj = viewBoxPointToContainerPercent(cand.x, cand.y, frameWidthPx, frameHeightPx)
    if (proj.left < 4 || proj.left > 96 || proj.top < 6 || proj.top > 94) continue

    const w = cand.widthPx ?? DEFAULT_WIDTH[cand.kind]
    const h = cand.heightPx ?? DEFAULT_HEIGHT[cand.kind]
    const leftPx = (proj.left / 100) * frameWidthPx - w / 2
    const topPx = (proj.top / 100) * frameHeightPx - h - 8

    const rect = { left: leftPx, top: topPx, w, h }
    if (occupied.some((o) => rectsOverlap(rect, o))) continue

    occupied.push(rect)
    placed.push({
      ...cand,
      left: proj.left,
      top: proj.top,
      offsetY: 0,
    })
  }

  return placed
}

export function labelBudgetForLevel(level: MapZoomLevel): number {
  switch (level) {
    case 'family':
      return 12
    case 'regional':
      return 16
    case 'local':
      return 22
    case 'place':
      return 32
    case 'record':
      return 40
  }
}

export function topPlacesByWeight(
  places: { id: string; people: unknown[]; eventCount: number }[],
  limit: number,
): Set<string> {
  const ranked = [...places]
    .sort(
      (a, b) =>
        b.people.length + b.eventCount * 0.5 - (a.people.length + a.eventCount * 0.5),
    )
    .slice(0, limit)
  return new Set(ranked.map((p) => p.id))
}
