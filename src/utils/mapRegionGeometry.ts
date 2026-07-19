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
/** Tight halo margin for family regions — keeps circles on land. */
export const FAMILY_REGION_HALO_PAD = 1.35

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

/** Fallback extent when no regions are visible (US + Britain cluster). */
export const DEFAULT_FAMILY_CONTENT_BOUNDS: MapBounds = {
  minX: 25,
  maxX: 55,
  minY: 32,
  maxY: 48,
}

export function boundsFromRegionAnchors(
  regions: { anchor: { x: number; y: number } }[],
  padding = REGION_MARKER_PADDING,
): MapBounds {
  return expandBounds(
    boundsFromPoints(regions.map((region) => ({ x: region.anchor.x, y: region.anchor.y }))),
    padding,
  )
}

export function unionMapBounds(boundsList: MapBounds[]): MapBounds {
  if (!boundsList.length) return DEFAULT_FAMILY_CONTENT_BOUNDS

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const bounds of boundsList) {
    minX = Math.min(minX, bounds.minX)
    maxX = Math.max(maxX, bounds.maxX)
    minY = Math.min(minY, bounds.minY)
    maxY = Math.max(maxY, bounds.maxY)
  }

  return { minX, maxX, minY, maxY }
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

type FamilyRegionId =
  | 'britain_ireland'
  | 'eastern_us'
  | 'california'
  | 'mexico'
  | 'southwest_us'

/**
 * Fit a region halo to resolved place coordinates, biased toward a geographic anchor
 * and clamped so coastal regions do not bloom into the ocean.
 */
export function fitFamilyRegionEllipse(
  regionId: FamilyRegionId,
  points: MapPoint[],
  anchor: MapPoint,
  minRx = 4,
  minRy = 4,
): RegionEllipse {
  if (!points.length) {
    return { cx: anchor.x, cy: anchor.y, rx: minRx, ry: minRy }
  }

  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const pad = FAMILY_REGION_HALO_PAD

  let cx = (minX + maxX) / 2
  let cy = (minY + maxY) / 2
  cx = cx * 0.88 + anchor.x * 0.12
  cy = cy * 0.88 + anchor.y * 0.12

  let rx = Math.max(minRx, (maxX - minX) / 2 + pad)
  let ry = Math.max(minRy, (maxY - minY) / 2 + pad)

  for (const point of points) {
    rx = Math.max(rx, Math.abs(point.x - cx) + pad * 0.55)
    ry = Math.max(ry, Math.abs(point.y - cy) + pad * 0.55)
  }

  // Atlas x increases eastward — clamp halos at coastlines.
  if (regionId === 'eastern_us') {
    const eastLimit = maxX + pad
    if (cx + rx > eastLimit) rx = Math.max(minRx, eastLimit - cx)
  }
  if (regionId === 'britain_ireland') {
    const westLimit = minX - pad
    if (cx - rx < westLimit) rx = Math.max(minRx, cx - westLimit)
  }
  if (regionId === 'california') {
    const westLimit = minX - pad
    if (cx - rx < westLimit) rx = Math.max(minRx, cx - westLimit)
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
