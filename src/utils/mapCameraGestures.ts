import type { MapBounds } from './mapRegionGeometry'
import { effectiveMapScale, type MapCamera } from './mapSemanticZoom'

export const GESTURE_MIN_SCALE = 1
export const GESTURE_MAX_SCALE = 5.5

export function mapPointFromScreenPercent(
  leftPct: number,
  topPct: number,
  camera: MapCamera,
): { x: number; y: number } {
  const scale = effectiveMapScale(camera)
  return {
    x: camera.cx + (leftPct - 50) / scale,
    y: camera.cy + (topPct - 50) / scale,
  }
}

export function zoomCameraAt(
  camera: MapCamera,
  factor: number,
  originLeftPct: number,
  originTopPct: number,
): MapCamera {
  const point = mapPointFromScreenPercent(originLeftPct, originTopPct, camera)
  const nextScale = Math.min(GESTURE_MAX_SCALE, Math.max(GESTURE_MIN_SCALE, camera.scale * factor))
  let next: MapCamera = { ...camera, scale: nextScale }
  for (let i = 0; i < 4; i++) {
    const scale = effectiveMapScale(next)
    next = {
      scale: nextScale,
      cx: point.x - (originLeftPct - 50) / scale,
      cy: point.y - (originTopPct - 50) / scale,
    }
  }
  return next
}

export function panCamera(
  camera: MapCamera,
  dxPx: number,
  dyPx: number,
  frameWidth: number,
  frameHeight: number,
): MapCamera {
  if (frameWidth <= 0 || frameHeight <= 0) return camera
  const scale = effectiveMapScale(camera)
  return {
    ...camera,
    cx: camera.cx - ((dxPx / frameWidth) * 100) / scale,
    cy: camera.cy - ((dyPx / frameHeight) * 100) / scale,
  }
}

export function clampCameraToContent(camera: MapCamera, bounds: MapBounds | null): MapCamera {
  const scale = Math.min(GESTURE_MAX_SCALE, Math.max(GESTURE_MIN_SCALE, camera.scale))
  const next: MapCamera = { ...camera, scale }
  if (!bounds) return next

  const visual = effectiveMapScale(next)
  const halfW = 50 / visual
  const halfH = 50 / visual
  const margin = 10
  const minCx = bounds.minX - halfW + margin
  const maxCx = bounds.maxX + halfW - margin
  const minCy = bounds.minY - halfH + margin
  const maxCy = bounds.maxY + halfH - margin

  return {
    scale,
    cx: clamp(next.cx, minCx, maxCx),
    cy: clamp(next.cy, minCy, maxCy),
  }
}

export function cameraHasLeftOverview(camera: MapCamera, overview: MapCamera): boolean {
  const distance = Math.hypot(camera.cx - overview.cx, camera.cy - overview.cy)
  return camera.scale > overview.scale * 1.16 || distance > 5
}

function clamp(value: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2
  return Math.min(max, Math.max(min, value))
}
