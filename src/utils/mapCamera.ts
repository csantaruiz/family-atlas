import type { MapBounds } from './mapRegionGeometry'
import { expandBounds } from './mapRegionGeometry'
import { WORLD_PLATE_BOUNDS } from './mapProjection'
import {
  viewBoxCameraForContainer,
  type MapCamera,
  type MapZoomLevel,
} from './mapSemanticZoom'

/** Overview may zoom gently into family extent (not locked to world scale). */
export const MAP_OVERVIEW_SCALE = 1
export const OVERVIEW_MIN_SCALE = 1
export const OVERVIEW_MAX_SCALE = 1.75

export const REGION_MIN_SCALE = 1.55
export const REGION_MAX_SCALE = 3.8
export const LOCAL_MIN_SCALE = 1.85
export const LOCAL_MAX_SCALE = 4.8
export const PLACE_MIN_SCALE = 2.2
export const PLACE_MAX_SCALE = 5.5

export const REGION_FIT_PADDING = 4

/** Selected region should dominate ~45–65% of the usable viewport. */
export const REGION_FIT_TARGET_WIDTH_RATIO = 0.58
export const REGION_FIT_TARGET_HEIGHT_RATIO = 0.62

/** Overview fills more of the safe viewport with family geography. */
export const OVERVIEW_FIT_TARGET_WIDTH_RATIO = 0.78
export const OVERVIEW_FIT_TARGET_HEIGHT_RATIO = 0.72

/** Corridor / place fits leave more surrounding context. */
export const CORRIDOR_FIT_TARGET_WIDTH_RATIO = 0.55
export const CORRIDOR_FIT_TARGET_HEIGHT_RATIO = 0.55

export const MAP_CAMERA_TRANSITION_MS = 420

export const MAP_PANEL_WIDTH_PX = 320
export const MAP_PANEL_GAP_PX = 24
export const MAP_FRAME_PADDING_PX = 20

/**
 * Desktop safe-viewport chrome — asymmetric insets so fit/center targets the
 * unobstructed map hole, while the SVG stays full-bleed behind overlays.
 * Tuned for current Journey composition (intro / filters+summary / insight).
 */
export const MAP_RIGHT_CHROME_PX = 360
export const MAP_LEFT_CHROME_PX = 340
/** Corner panels — avoid reserving a full title band across the map. */
export const MAP_TOP_CHROME_PX = 36
/** Collapsed Journey Insight rail + breathing room. */
export const MAP_BOTTOM_CHROME_PX = 148
export const MAP_CHROME_BREATHING_PX = 12

export const DEFAULT_OVERVIEW_CAMERA: MapCamera = { cx: 50, cy: 50, scale: MAP_OVERVIEW_SCALE }

export const MAP_PEEK_INSET_PX = 148

export type MapViewportLayout = {
  frameWidthPx: number
  frameHeightPx: number
  panelOpen: boolean
  panelWidthPx?: number
  panelGapPx?: number
  /**
   * Extra bottom inset (px). Phone: peek sheet. Desktop: Journey Insight rail.
   * Applied on top of base chrome reserves.
   */
  bottomInsetPx?: number
  /** Optional measured overrides for safe-viewport chrome. */
  safeInsetsPx?: {
    left?: number
    right?: number
    top?: number
    bottom?: number
  }
}

export type UsableViewport = {
  centerXPercent: number
  centerYPercent: number
  widthPercent: number
  heightPercent: number
}

export function usableViewport(layout: MapViewportLayout): UsableViewport {
  const {
    frameWidthPx,
    frameHeightPx,
    panelOpen,
    panelWidthPx = MAP_PANEL_WIDTH_PX,
    panelGapPx = MAP_PANEL_GAP_PX,
    safeInsetsPx,
  } = layout

  if (frameWidthPx <= 0 || frameHeightPx <= 0) {
    return { centerXPercent: 50, centerYPercent: 50, widthPercent: 100, heightPercent: 100 }
  }

  const compact = frameWidthPx < 760
  const pad = compact ? 8 : MAP_FRAME_PADDING_PX
  const breath = compact ? 0 : MAP_CHROME_BREATHING_PX
  const panelReserve = panelOpen && !compact ? panelWidthPx + panelGapPx : 0

  const leftReserve = compact
    ? 12
    : (safeInsetsPx?.left ?? MAP_LEFT_CHROME_PX) + breath
  const rightReserve = compact
    ? 12
    : Math.max(safeInsetsPx?.right ?? MAP_RIGHT_CHROME_PX, panelReserve) + breath
  const topReserve = compact ? 16 : (safeInsetsPx?.top ?? MAP_TOP_CHROME_PX) + breath
  const baseBottom = compact
    ? Math.max(16, layout.bottomInsetPx ?? 16)
    : Math.max(safeInsetsPx?.bottom ?? MAP_BOTTOM_CHROME_PX, layout.bottomInsetPx ?? 0)
  const bottomReserve = compact ? baseBottom : baseBottom + breath

  const usableWidthPx = Math.max(120, frameWidthPx - pad - rightReserve - leftReserve)
  const usableHeightPx = Math.max(120, frameHeightPx - pad - topReserve - bottomReserve)

  const leftPx = pad + leftReserve
  const centerXPercent = ((leftPx + usableWidthPx / 2) / frameWidthPx) * 100
  const centerYPercent = ((topReserve + pad + usableHeightPx / 2) / frameHeightPx) * 100

  return {
    centerXPercent,
    centerYPercent,
    widthPercent: (usableWidthPx / frameWidthPx) * 100,
    heightPercent: (usableHeightPx / frameHeightPx) * 100,
  }
}

type FitOptions = {
  minScale: number
  maxScale: number
  widthRatio: number
  heightRatio: number
  worldPad: number
}

function scaleLimitsForLevel(level: MapZoomLevel): { min: number; max: number } {
  switch (level) {
    case 'family':
      return { min: OVERVIEW_MIN_SCALE, max: OVERVIEW_MAX_SCALE }
    case 'regional':
      return { min: REGION_MIN_SCALE, max: REGION_MAX_SCALE }
    case 'local':
      return { min: LOCAL_MIN_SCALE, max: LOCAL_MAX_SCALE }
    case 'place':
      return { min: PLACE_MIN_SCALE, max: PLACE_MAX_SCALE }
    case 'record':
      return { min: PLACE_MIN_SCALE, max: PLACE_MAX_SCALE }
  }
}

function fitRatiosForLevel(level: MapZoomLevel): { widthRatio: number; heightRatio: number } {
  switch (level) {
    case 'family':
      return {
        widthRatio: OVERVIEW_FIT_TARGET_WIDTH_RATIO,
        heightRatio: OVERVIEW_FIT_TARGET_HEIGHT_RATIO,
      }
    case 'regional':
      return {
        widthRatio: REGION_FIT_TARGET_WIDTH_RATIO,
        heightRatio: REGION_FIT_TARGET_HEIGHT_RATIO,
      }
    case 'local':
    case 'place':
    case 'record':
      return {
        widthRatio: CORRIDOR_FIT_TARGET_WIDTH_RATIO,
        heightRatio: CORRIDOR_FIT_TARGET_HEIGHT_RATIO,
      }
  }
}

function clamp(value: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2
  return Math.min(max, Math.max(min, value))
}

/**
 * Keep the SVG viewBox inside the rendered world plate (+ overscan).
 * Accounts for current zoom and container aspect — not a fixed center clamp.
 */
export function clampCameraToWorldPlate(
  camera: MapCamera,
  frameWidthPx: number,
  frameHeightPx: number,
  plate: MapBounds = WORLD_PLATE_BOUNDS,
): MapCamera {
  if (frameWidthPx <= 0 || frameHeightPx <= 0) return camera

  const viewBox = viewBoxCameraForContainer(camera, frameWidthPx, frameHeightPx)
  const halfW = viewBox.width / 2
  const halfH = viewBox.height / 2

  let minCx = plate.minX + halfW
  let maxCx = plate.maxX - halfW
  let minCy = plate.minY + halfH
  let maxCy = plate.maxY - halfH

  if (minCx > maxCx) {
    minCx = maxCx = (plate.minX + plate.maxX) / 2
  }
  if (minCy > maxCy) {
    minCy = maxCy = (plate.minY + plate.maxY) / 2
  }

  return {
    ...camera,
    cx: clamp(camera.cx, minCx, maxCx),
    cy: clamp(camera.cy, minCy, maxCy),
  }
}

/**
 * Fit geographic bounds into the asymmetric safe viewport.
 * Map stays full-bleed; camera scale/center target the unobstructed hole.
 */
export function fitCameraToUsableViewport(
  bounds: MapBounds,
  layout: MapViewportLayout,
  options: FitOptions,
): MapCamera {
  const padded = expandBounds(bounds, options.worldPad)
  const boundsW = Math.max(3.5, padded.maxX - padded.minX)
  const boundsH = Math.max(3.5, padded.maxY - padded.minY)
  const geoCx = (padded.minX + padded.maxX) / 2
  const geoCy = (padded.minY + padded.maxY) / 2

  const usable = usableViewport(layout)
  const scaleX = (usable.widthPercent * options.widthRatio) / boundsW
  const scaleY = (usable.heightPercent * options.heightRatio) / boundsH
  let scale = Math.min(scaleX, scaleY)
  scale = Math.max(options.minScale, Math.min(options.maxScale, scale))

  const cx = geoCx - (usable.centerXPercent - 50) / scale
  const cy = geoCy - (usable.centerYPercent - 50) / scale

  const fitted = { cx, cy, scale }
  if (layout.frameWidthPx <= 0 || layout.frameHeightPx <= 0) return fitted
  return clampCameraToWorldPlate(fitted, layout.frameWidthPx, layout.frameHeightPx)
}

/** Family overview: fit meaningful family geography into the safe viewport. */
export function fitOverviewCamera(bounds: MapBounds, layout: MapViewportLayout): MapCamera {
  if (layout.frameWidthPx > 0 && layout.frameWidthPx < 760) {
    return fitCameraToBounds(bounds, { ...layout, panelOpen: false }, 'regional')
  }

  return fitCameraToUsableViewport(bounds, layout, {
    minScale: OVERVIEW_MIN_SCALE,
    maxScale: OVERVIEW_MAX_SCALE,
    widthRatio: OVERVIEW_FIT_TARGET_WIDTH_RATIO,
    heightRatio: OVERVIEW_FIT_TARGET_HEIGHT_RATIO,
    worldPad: REGION_FIT_PADDING + 2,
  })
}

export function fitCameraToBounds(
  bounds: MapBounds,
  layout: MapViewportLayout,
  level: MapZoomLevel,
): MapCamera {
  if (level === 'family') return fitOverviewCamera(bounds, layout)

  const { min, max } = scaleLimitsForLevel(level)
  const { widthRatio, heightRatio } = fitRatiosForLevel(level)

  return fitCameraToUsableViewport(bounds, layout, {
    minScale: min,
    maxScale: max,
    widthRatio,
    heightRatio,
    worldPad: REGION_FIT_PADDING,
  })
}

export function fitCameraForRegion(
  bounds: MapBounds,
  layout: MapViewportLayout,
  level: MapZoomLevel,
): MapCamera {
  return fitCameraToBounds(bounds, layout, level)
}

/** Insight / corridor helper — same math, explicit level. */
export function fitCameraForInsight(
  bounds: MapBounds,
  layout: MapViewportLayout,
  level: MapZoomLevel = 'local',
): MapCamera {
  return fitCameraToBounds(bounds, layout, level)
}
