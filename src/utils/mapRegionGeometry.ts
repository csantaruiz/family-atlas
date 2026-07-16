import type { RegionEllipse } from './mapRegions'

export type MapPoint = { x: number; y: number }

export type MapBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export type RegionGeometry = RegionEllipse & {
  /** Representative anchor — marker and label attach here. */
  anchorX: number
  anchorY: number
  bounds: MapBounds
}

/** Extra map-space padding so overview markers sit inside halos. */
export const REGION_MARKER_PADDING = 3.5

export function boundsFromPoints(points: MapPoint[]): MapBounds {
  if (!points.length) {
    return { minX: 48, maxX: 52, minY: 46, maxY: 50 }
  }
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

export function expandBounds(bounds: MapBounds, padding: number): MapBounds {
  return {
    minX: bounds.minX - padding,
    maxX: bounds.maxX + padding,
    minY: bounds.minY - padding,
    maxY: bounds.maxY + padding,
  }
}

export function boundsFromEllipse(ellipse: RegionEllipse): MapBounds {
  return {
    minX: ellipse.cx - ellipse.rx,
    maxX: ellipse.cx + ellipse.rx,
    minY: ellipse.cy - ellipse.ry,
    maxY: ellipse.cy + ellipse.ry,
  }
}

function weightedCentroid(points: MapPoint[], weights?: number[]): MapPoint {
  if (!points.length) return { x: 50, y: 50 }
  let wx = 0
  let wy = 0
  let wSum = 0
  for (let i = 0; i < points.length; i++) {
    const w = weights?.[i] ?? 1
    wx += points[i].x * w
    wy += points[i].y * w
    wSum += w
  }
  return { x: wx / wSum, y: wy / wSum }
}

function pointInEllipse(px: number, py: number, ellipse: RegionEllipse, inset = 0.85): boolean {
  const rx = Math.max(0.5, ellipse.rx - inset)
  const ry = Math.max(0.5, ellipse.ry - inset)
  const nx = (px - ellipse.cx) / rx
  const ny = (py - ellipse.cy) / ry
  return nx * nx + ny * ny <= 1
}

function pullAnchorInside(anchor: MapPoint, ellipse: RegionEllipse): MapPoint {
  if (pointInEllipse(anchor.x, anchor.y, ellipse)) return anchor
  return { x: ellipse.cx, y: ellipse.cy }
}

function expandEllipseToContain(
  ellipse: RegionEllipse,
  points: MapPoint[],
  extraPadding: number,
): RegionEllipse {
  let { cx, cy, rx, ry } = ellipse
  for (const p of points) {
    const dx = Math.abs(p.x - cx)
    const dy = Math.abs(p.y - cy)
    rx = Math.max(rx, dx + extraPadding)
    ry = Math.max(ry, dy + extraPadding)
  }
  return { cx, cy, rx, ry }
}

export function buildRegionGeometry(
  points: MapPoint[],
  weights: number[] | undefined,
  minRx: number,
  minRy: number,
  padding: number,
  markerPadding = REGION_MARKER_PADDING,
): RegionGeometry {
  if (!points.length) {
    const ellipse = { cx: 50, cy: 50, rx: minRx, ry: minRy }
    return {
      ...ellipse,
      anchorX: ellipse.cx,
      anchorY: ellipse.cy,
      bounds: boundsFromEllipse(ellipse),
    }
  }

  const bounds = boundsFromPoints(points)

  let ellipse: RegionEllipse = {
    cx: (bounds.minX + bounds.maxX) / 2,
    cy: (bounds.minY + bounds.maxY) / 2,
    rx: Math.max(minRx, (bounds.maxX - bounds.minX) / 2 + padding),
    ry: Math.max(minRy, (bounds.maxY - bounds.minY) / 2 + padding),
  }

  ellipse = expandEllipseToContain(ellipse, points, padding * 0.5 + markerPadding)

  const anchor = weightedCentroid(points, weights)
  ellipse = expandEllipseToContain(ellipse, [anchor], markerPadding * 0.5)
  const finalAnchor = pullAnchorInside(anchor, ellipse)

  return {
    ...ellipse,
    anchorX: finalAnchor.x,
    anchorY: finalAnchor.y,
    bounds: expandBounds(boundsFromEllipse(ellipse), padding * 0.25),
  }
}

/** Verify every point lies inside the region ellipse (for dev checks). */
export function verifyContainment(
  points: MapPoint[],
  ellipse: RegionEllipse,
): { contained: boolean; outliers: MapPoint[] } {
  const outliers = points.filter((p) => !pointInEllipse(p.x, p.y, ellipse, 0))
  return { contained: outliers.length === 0, outliers }
}
