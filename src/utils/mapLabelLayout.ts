import type { MapCamera, MapZoomLevel } from './mapSemanticZoom'
import {
  viewBoxPointToContainerPercent,
  projectViewBoxPointThroughCamera,
} from './mapSemanticZoom'

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

export type MapPointProjector = (x: number, y: number) => { left: number; top: number }

const DEFAULT_WIDTH: Record<MapLabelCandidate['kind'], number> = {
  major: 148,
  sub: 112,
  place: 88,
  stats: 120,
  cta: 96,
}

const DEFAULT_HEIGHT: Record<MapLabelCandidate['kind'], number> = {
  major: 36,
  sub: 28,
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

export function estimateLabelWidthPx(
  kind: MapLabelCandidate['kind'],
  text: string,
  frameWidthPx: number,
): number {
  const char = kind === 'major' ? 9.2 : kind === 'sub' ? 7.6 : 6.6
  const raw = 16 + text.length * char
  const cap = kind === 'major' ? Math.min(frameWidthPx * 0.78, 220) : kind === 'sub' ? 150 : 120
  return Math.min(cap, Math.max(DEFAULT_WIDTH[kind] * 0.7, raw))
}

function clampRect(
  rect: { left: number; top: number; w: number; h: number },
  frameWidthPx: number,
  frameHeightPx: number,
): { left: number; top: number; w: number; h: number } {
  const pad = 8
  const left = Math.min(Math.max(rect.left, pad), Math.max(pad, frameWidthPx - rect.w - pad))
  const top = Math.min(Math.max(rect.top, pad), Math.max(pad, frameHeightPx - rect.h - pad))
  return { ...rect, left, top }
}

function markerPercentFromRect(
  rect: { left: number; top: number; w: number; h: number },
  frameWidthPx: number,
  frameHeightPx: number,
  gap = 8,
): { left: number; top: number } {
  return {
    left: ((rect.left + rect.w / 2) / frameWidthPx) * 100,
    top: ((rect.top + rect.h + gap) / frameHeightPx) * 100,
  }
}

/**
 * Screen-space greedy placement. Coordinates must already be projected into
 * container percentages (camera applied). Labels clamp inward at the frame
 * edge instead of overflowing.
 */
export function layoutMapLabels(
  candidates: MapLabelCandidate[],
  frameWidthPx: number,
  frameHeightPx: number,
  maxLabels?: number,
  project: MapPointProjector = (x, y) =>
    viewBoxPointToContainerPercent(x, y, frameWidthPx, frameHeightPx),
): PlacedMapLabel[] {
  const sorted = [...candidates].sort((a, b) => b.priority - a.priority)
  const placed: PlacedMapLabel[] = []
  const occupied: { left: number; top: number; w: number; h: number }[] = []

  for (const cand of sorted) {
    if (maxLabels != null && placed.length >= maxLabels) break

    const proj = project(cand.x, cand.y)
    if (proj.left < -8 || proj.left > 108 || proj.top < -8 || proj.top > 108) continue

    const w = cand.widthPx ?? DEFAULT_WIDTH[cand.kind]
    const h = cand.heightPx ?? DEFAULT_HEIGHT[cand.kind]
    const markerX = (proj.left / 100) * frameWidthPx
    const markerY = (proj.top / 100) * frameHeightPx

    const slots = [
      { left: markerX - w / 2, top: markerY - h - 8 },
      { left: markerX - w / 2, top: markerY + 12 },
      { left: markerX + 10, top: markerY - h / 2 },
      { left: markerX - w - 10, top: markerY - h / 2 },
    ]

    let chosen: { left: number; top: number; w: number; h: number } | null = null
    for (const slot of slots) {
      const clamped = clampRect({ ...slot, w, h }, frameWidthPx, frameHeightPx)
      if (occupied.some((o) => rectsOverlap(clamped, o))) continue
      chosen = clamped
      break
    }

    if (!chosen) {
      if (cand.priority < 90) continue
      const fallback = clampRect(
        { left: markerX - w / 2, top: markerY - h - 8, w, h },
        frameWidthPx,
        frameHeightPx,
      )
      if (occupied.some((o) => rectsOverlap(fallback, o))) continue
      chosen = fallback
    }

    occupied.push(chosen)
    const anchor = markerPercentFromRect(chosen, frameWidthPx, frameHeightPx)
    placed.push({
      ...cand,
      left: anchor.left,
      top: anchor.top,
      offsetY: 0,
    })
  }

  return placed
}

export function projectLabelPoint(
  x: number,
  y: number,
  camera: MapCamera,
  frameWidthPx: number,
  frameHeightPx: number,
): { left: number; top: number } {
  return projectViewBoxPointThroughCamera(x, y, camera, frameWidthPx, frameHeightPx)
}

export function labelBudgetForLevel(level: MapZoomLevel): number {
  switch (level) {
    case 'family':
      return 8
    case 'regional':
      return 10
    case 'local':
      return 12
    case 'place':
      return 14
    case 'record':
      return 16
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
