import type { MapBounds } from './mapRegionGeometry'
import { clampCameraToWorldPlate } from './mapCamera'
import { WORLD_PLATE_BOUNDS } from './mapProjection'
import {
  cameraFromScaleAndScreenAnchor,
  screenPercentToWorld,
  type MapCamera,
} from './mapSemanticZoom'

export const GESTURE_MIN_SCALE = 1
export const GESTURE_MAX_SCALE = 5.5
export const PAN_EDGE_PAD_PX = 40

export type MapViewportSize = {
  width: number
  height: number
}

export type MapPanLimits = {
  minCx: number
  maxCx: number
  minCy: number
  maxCy: number
}

export function mapPointFromScreenPercent(
  leftPct: number,
  topPct: number,
  camera: MapCamera,
  viewport?: MapViewportSize | null,
): { x: number; y: number } {
  return screenPercentToWorld(
    leftPct,
    topPct,
    camera,
    viewport?.width ?? 0,
    viewport?.height ?? 0,
  )
}

export function zoomCameraAt(
  camera: MapCamera,
  factor: number,
  originLeftPct: number,
  originTopPct: number,
  viewport?: MapViewportSize | null,
): MapCamera {
  const width = viewport?.width ?? 0
  const height = viewport?.height ?? 0
  const world = mapPointFromScreenPercent(originLeftPct, originTopPct, camera, viewport)
  const nextScale = Math.min(
    GESTURE_MAX_SCALE,
    Math.max(GESTURE_MIN_SCALE, camera.scale * factor),
  )
  return cameraFromScaleAndScreenAnchor(
    nextScale,
    world,
    originLeftPct,
    originTopPct,
    width,
    height,
  )
}

/** Pan changes translation only — scale is unchanged. */
export function panCamera(
  camera: MapCamera,
  dxPx: number,
  dyPx: number,
  frameWidth: number,
  frameHeight: number,
): MapCamera {
  if (frameWidth <= 0 || frameHeight <= 0) return camera
  const originLeft = 50
  const originTop = 50
  const world = mapPointFromScreenPercent(originLeft, originTop, camera, {
    width: frameWidth,
    height: frameHeight,
  })
  const nextLeft = originLeft + (dxPx / frameWidth) * 100
  const nextTop = originTop + (dyPx / frameHeight) * 100
  return cameraFromScaleAndScreenAnchor(
    camera.scale,
    world,
    nextLeft,
    nextTop,
    frameWidth,
    frameHeight,
  )
}

export function panLimitsForCamera(
  camera: MapCamera,
  bounds: MapBounds,
  viewport?: MapViewportSize | null,
): MapPanLimits {
  const scale = Math.min(GESTURE_MAX_SCALE, Math.max(GESTURE_MIN_SCALE, camera.scale))
  const width = viewport?.width ?? 0
  const height = viewport?.height ?? 0
  const padX =
    width > 0 ? PAN_EDGE_PAD_PX / ((width / 100) * scale) : 2
  const padY =
    height > 0 ? PAN_EDGE_PAD_PX / ((height / 100) * scale) : 2

  return {
    minCx: bounds.minX - padX,
    maxCx: bounds.maxX + padX,
    minCy: bounds.minY - padY,
    maxCy: bounds.maxY + padY,
  }
}

export function clampCameraToContent(
  camera: MapCamera,
  bounds: MapBounds | null,
  viewport?: MapViewportSize | null,
): MapCamera {
  const scale = Math.min(GESTURE_MAX_SCALE, Math.max(GESTURE_MIN_SCALE, camera.scale))
  let next: MapCamera = { ...camera, scale }
  if (bounds) {
    const limits = panLimitsForCamera(next, bounds, viewport)
    next = {
      scale,
      cx: clamp(next.cx, limits.minCx, limits.maxCx),
      cy: clamp(next.cy, limits.minCy, limits.maxCy),
    }
  }

  const width = viewport?.width ?? 0
  const height = viewport?.height ?? 0
  if (width > 0 && height > 0) {
    next = clampCameraToWorldPlate(next, width, height, WORLD_PLATE_BOUNDS)
  }
  return next
}

export function cameraHasLeftOverview(camera: MapCamera, overview: MapCamera): boolean {
  const distance = Math.hypot(camera.cx - overview.cx, camera.cy - overview.cy)
  return camera.scale > overview.scale * 1.16 || distance > 5
}

function clamp(value: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2
  return Math.min(max, Math.max(min, value))
}
