import type { MapBounds } from './mapRegionGeometry'
import { expandBounds } from './mapRegionGeometry'
import type { MapCamera, MapZoomLevel } from './mapSemanticZoom'

export const MAP_OVERVIEW_SCALE = 1
export const REGION_MIN_SCALE = 1.25
export const REGION_MAX_SCALE = 3.4
export const LOCAL_MIN_SCALE = 1.6
export const LOCAL_MAX_SCALE = 4.8
export const PLACE_MIN_SCALE = 2
export const PLACE_MAX_SCALE = 5.5

export const REGION_FIT_PADDING = 5
export const REGION_FIT_TARGET_WIDTH_RATIO = 0.5
export const REGION_FIT_TARGET_HEIGHT_RATIO = 0.52

export const MAP_CAMERA_TRANSITION_MS = 420

export const MAP_PANEL_WIDTH_PX = 340
export const MAP_PANEL_GAP_PX = 24
export const MAP_FRAME_PADDING_PX = 28

export const DEFAULT_OVERVIEW_CAMERA: MapCamera = { cx: 50, cy: 48, scale: MAP_OVERVIEW_SCALE }

export type MapViewportLayout = {
  frameWidthPx: number
  frameHeightPx: number
  panelOpen: boolean
  panelWidthPx?: number
  panelGapPx?: number
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
  } = layout

  if (frameWidthPx <= 0 || frameHeightPx <= 0) {
    return { centerXPercent: 50, centerYPercent: 50, widthPercent: 100, heightPercent: 100 }
  }

  const pad = MAP_FRAME_PADDING_PX
  const panelReserve = panelOpen ? panelWidthPx + panelGapPx : 0
  const usableWidthPx = Math.max(120, frameWidthPx - pad * 2 - panelReserve)
  const usableHeightPx = Math.max(120, frameHeightPx - pad * 2 - 48)

  const leftPx = pad
  const centerXPercent = ((leftPx + usableWidthPx / 2) / frameWidthPx) * 100
  const centerYPercent = ((pad + 40 + usableHeightPx / 2) / frameHeightPx) * 100

  return {
    centerXPercent,
    centerYPercent,
    widthPercent: (usableWidthPx / frameWidthPx) * 100,
    heightPercent: (usableHeightPx / frameHeightPx) * 100,
  }
}

function scaleLimitsForLevel(level: MapZoomLevel): { min: number; max: number } {
  switch (level) {
    case 'family':
      return { min: MAP_OVERVIEW_SCALE, max: MAP_OVERVIEW_SCALE }
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

export function fitCameraToBounds(
  bounds: MapBounds,
  layout: MapViewportLayout,
  level: MapZoomLevel,
): MapCamera {
  if (level === 'family') return DEFAULT_OVERVIEW_CAMERA

  const padded = expandBounds(bounds, REGION_FIT_PADDING)
  const boundsW = Math.max(4, padded.maxX - padded.minX)
  const boundsH = Math.max(4, padded.maxY - padded.minY)
  const geoCx = (padded.minX + padded.maxX) / 2
  const geoCy = (padded.minY + padded.maxY) / 2

  const usable = usableViewport(layout)

  const scaleX =
    (usable.widthPercent * REGION_FIT_TARGET_WIDTH_RATIO) / boundsW
  const scaleY =
    (usable.heightPercent * REGION_FIT_TARGET_HEIGHT_RATIO) / boundsH
  let scale = Math.min(scaleX, scaleY)

  const { min, max } = scaleLimitsForLevel(level)
  scale = Math.max(min, Math.min(max, scale))

  const cx = geoCx - (usable.centerXPercent - 50) / scale
  const cy = geoCy - (usable.centerYPercent - 50) / scale

  return { cx, cy, scale }
}

export function fitCameraForRegion(
  bounds: MapBounds,
  layout: MapViewportLayout,
  level: MapZoomLevel,
): MapCamera {
  return fitCameraToBounds(bounds, layout, level)
}
