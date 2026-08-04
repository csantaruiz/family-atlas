import type { FamilyRegion, FamilyRegionId } from './mapRegions'
import type { MapSubregion } from './mapSubregions'
import type { PlaceRecord } from './placeIndex'

/** Discrete semantic zoom states — camera pans; content hierarchy changes. */
export type MapZoomLevel = 'family' | 'regional' | 'local' | 'place' | 'record'

export type MapCamera = {
  cx: number
  cy: number
  /** Camera framing scale — typography stays fixed in overlay. */
  scale: number
}

export const MAP_ZOOM_LEVELS: MapZoomLevel[] = [
  'family',
  'regional',
  'local',
  'place',
  'record',
]

/** Extra framing scale so the map plate always covers the atlas frame at every zoom level. */
export const MAP_FRAME_COVERAGE = 1.08
/** Compensates for preserveAspectRatio="slice" letterboxing inside the plate. */
export const MAP_PLATE_SLICE_BLEED = 1.045

/**
 * Minimum scale so a panned camera never reveals the frame backdrop.
 * Derived from plate edges: left = 50 − cx × scale (with center transform origin).
 */
export function effectiveMapScale(camera: MapCamera): number {
  const { cx, cy, scale } = camera

  const horizontal =
    cx <= 50 ? 50 / Math.max(cx, 1) : 50 / Math.max(100 - cx, 1)
  const vertical =
    cy <= 50 ? 50 / Math.max(cy, 1) : 50 / Math.max(100 - cy, 1)
  const panCoverage = Math.max(horizontal, vertical, 1)

  const zoomPadding = Math.min(Math.max(0, scale - 1) * 0.14, 0.05)
  const baseCoverage = (MAP_FRAME_COVERAGE + zoomPadding) * MAP_PLATE_SLICE_BLEED
  const panAwareCoverage = panCoverage * MAP_PLATE_SLICE_BLEED

  // Tiny margin so eased transitions never flash the frame color.
  return scale * Math.max(baseCoverage, panAwareCoverage) * 1.008
}

export const DEFAULT_CAMERA: MapCamera = { cx: 50, cy: 50, scale: 1 }

/** Max ~12% framing zoom — typography stays fixed in overlay. */
const LEVEL_SCALE: Record<MapZoomLevel, number> = {
  family: 1,
  regional: 1.04,
  local: 1.07,
  place: 1.1,
  record: 1.12,
}

export const MAP_TRANSITION_MS = 420

export function cameraForLevel(
  level: MapZoomLevel,
  focus?: { cx: number; cy: number },
): MapCamera {
  const scale = LEVEL_SCALE[level]
  if (!focus || level === 'family') return { ...DEFAULT_CAMERA, scale: 1 }
  return { cx: focus.cx, cy: focus.cy, scale }
}

export function cameraForRegion(region: FamilyRegion, level: MapZoomLevel): MapCamera {
  return cameraForLevel(level, { cx: region.ellipse.cx, cy: region.ellipse.cy })
}

export function cameraForSubregion(sub: MapSubregion, level: MapZoomLevel): MapCamera {
  return cameraForLevel(level, { cx: sub.ellipse.cx, cy: sub.ellipse.cy })
}

export function cameraForPlace(place: PlaceRecord, level: MapZoomLevel = 'record'): MapCamera {
  return cameraForLevel(level, { cx: place.coordinate.x, cy: place.coordinate.y })
}

export function levelIndex(level: MapZoomLevel): number {
  return MAP_ZOOM_LEVELS.indexOf(level)
}

export function advanceLevel(level: MapZoomLevel): MapZoomLevel {
  const idx = levelIndex(level)
  return MAP_ZOOM_LEVELS[Math.min(idx + 1, MAP_ZOOM_LEVELS.length - 1)]
}

export function retreatLevel(level: MapZoomLevel): MapZoomLevel {
  const idx = levelIndex(level)
  return MAP_ZOOM_LEVELS[Math.max(idx - 1, 0)]
}

import { MAP_VIEW_BOX } from './mapProjection'

/** Project atlas coordinate (0–100) to screen percentage with camera pan/zoom. */
export function projectMapPoint(
  x: number,
  y: number,
  camera: MapCamera,
): { left: number; top: number } {
  const scale = effectiveMapScale(camera)
  return {
    left: 50 + (x - camera.cx) * scale,
    top: 50 + (y - camera.cy) * scale,
  }
}

/**
 * Map a viewBox point to container percentages matching SVG preserveAspectRatio="xMidYMid slice".
 * Use for HTML overlays that share the same box as the map SVG.
 */
export function viewBoxPointToContainerPercent(
  x: number,
  y: number,
  containerWidth: number,
  containerHeight: number,
  viewBoxWidth = MAP_VIEW_BOX.width,
  viewBoxHeight = MAP_VIEW_BOX.height,
): { left: number; top: number } {
  if (containerWidth <= 0 || containerHeight <= 0) {
    return { left: x, top: y }
  }

  const scale = Math.max(containerWidth / viewBoxWidth, containerHeight / viewBoxHeight)
  const renderedWidth = viewBoxWidth * scale
  const renderedHeight = viewBoxHeight * scale
  const offsetX = (containerWidth - renderedWidth) / 2
  const offsetY = (containerHeight - renderedHeight) / 2
  const px = x * scale + offsetX
  const py = y * scale + offsetY

  return {
    left: (px / containerWidth) * 100,
    top: (py / containerHeight) * 100,
  }
}

export function cameraTransform(camera: MapCamera): string {
  const scale = effectiveMapScale(camera)
  const tx = (50 - camera.cx) * scale
  const ty = (50 - camera.cy) * scale
  return `translate(${tx}%, ${ty}%) scale(${scale})`
}

/**
 * Slice-aware camera transform for containers using preserveAspectRatio="xMidYMid slice".
 * Centers `camera.cx/cy` on the viewport; falls back to percentage transform when size is unknown.
 */
export function cameraTransformForContainer(
  camera: MapCamera,
  containerWidth: number,
  containerHeight: number,
): string {
  if (containerWidth <= 0 || containerHeight <= 0) {
    return cameraTransform(camera)
  }

  const scale = effectiveMapScale(camera)
  const focal = viewBoxPointToContainerPercent(
    camera.cx,
    camera.cy,
    containerWidth,
    containerHeight,
  )
  const focalX = (focal.left / 100) * containerWidth
  const focalY = (focal.top / 100) * containerHeight
  const tx = -scale * (focalX - containerWidth / 2)
  const ty = -scale * (focalY - containerHeight / 2)

  return `translate(${tx}px, ${ty}px) scale(${scale})`
}

/** Visible SVG viewBox region — vector zoom without CSS scale rasterization. */
export type ViewBoxCamera = {
  minX: number
  minY: number
  width: number
  height: number
}

/** Derive a slice-aware viewBox that centers `camera.cx/cy` at the requested zoom. */
export function viewBoxCameraForContainer(
  camera: MapCamera,
  containerWidth: number,
  containerHeight: number,
  fullWidth = MAP_VIEW_BOX.width,
  fullHeight = MAP_VIEW_BOX.height,
): ViewBoxCamera {
  const zoom = effectiveMapScale(camera)
  const aspect = containerWidth / Math.max(containerHeight, 1)

  let width: number
  let height: number
  if (aspect >= 1) {
    width = fullWidth / zoom
    height = width / aspect
  } else {
    height = fullHeight / zoom
    width = height * aspect
  }

  return {
    minX: camera.cx - width / 2,
    minY: camera.cy - height / 2,
    width,
    height,
  }
}

/** Project atlas coords to viewport % using a dynamic SVG viewBox (no CSS scale). */
export function projectPointInViewBoxCamera(
  x: number,
  y: number,
  viewBox: ViewBoxCamera,
  containerWidth: number,
  containerHeight: number,
): { left: number; top: number } {
  if (containerWidth <= 0 || containerHeight <= 0) {
    return { left: 50, top: 50 }
  }

  const scale = Math.max(containerWidth / viewBox.width, containerHeight / viewBox.height)
  const renderedWidth = viewBox.width * scale
  const renderedHeight = viewBox.height * scale
  const offsetX = (containerWidth - renderedWidth) / 2
  const offsetY = (containerHeight - renderedHeight) / 2
  const px = (x - viewBox.minX) * scale + offsetX
  const py = (y - viewBox.minY) * scale + offsetY

  return {
    left: (px / containerWidth) * 100,
    top: (py / containerHeight) * 100,
  }
}

/** Map viewBox coords to viewport % after slice + camera transform. */
export function projectViewBoxPointThroughCamera(
  x: number,
  y: number,
  camera: MapCamera,
  containerWidth: number,
  containerHeight: number,
): { left: number; top: number } {
  if (containerWidth <= 0 || containerHeight <= 0) {
    return projectMapPoint(x, y, camera)
  }

  const scale = effectiveMapScale(camera)
  const local = viewBoxPointToContainerPercent(x, y, containerWidth, containerHeight)
  const localX = (local.left / 100) * containerWidth
  const localY = (local.top / 100) * containerHeight
  const focal = viewBoxPointToContainerPercent(
    camera.cx,
    camera.cy,
    containerWidth,
    containerHeight,
  )
  const focalX = (focal.left / 100) * containerWidth
  const focalY = (focal.top / 100) * containerHeight
  const tx = -scale * (focalX - containerWidth / 2)
  const ty = -scale * (focalY - containerHeight / 2)

  const screenX = containerWidth / 2 + scale * (localX - containerWidth / 2) + tx
  const screenY = containerHeight / 2 + scale * (localY - containerHeight / 2) + ty

  return {
    left: (screenX / containerWidth) * 100,
    top: (screenY / containerHeight) * 100,
  }
}

export type MapLayerVisibility = {
  showMajorHalos: boolean
  showMajorMarkers: boolean
  showMajorLabels: boolean
  showSubregions: boolean
  showSubregionMarkers: boolean
  showSubregionLabels: boolean
  showPlaces: boolean
  showPlaceLabels: boolean
  showAllPlaces: boolean
  showRecordDetail: boolean
  fadeMajorRegions: boolean
  showMajorRoutes: boolean
  showLocalRoutes: boolean
}

export function visibleLayers(level: MapZoomLevel): MapLayerVisibility {
  switch (level) {
    case 'family':
      return {
        showMajorHalos: true,
        showMajorMarkers: true,
        showMajorLabels: true,
        showSubregions: false,
        showSubregionMarkers: false,
        showSubregionLabels: false,
        showPlaces: false,
        showPlaceLabels: false,
        showAllPlaces: false,
        showRecordDetail: false,
        fadeMajorRegions: false,
        showMajorRoutes: true,
        showLocalRoutes: false,
      }
    case 'regional':
      return {
        showMajorHalos: true,
        showMajorMarkers: false,
        showMajorLabels: false,
        showSubregions: true,
        showSubregionMarkers: true,
        showSubregionLabels: true,
        showPlaces: false,
        showPlaceLabels: false,
        showAllPlaces: false,
        showRecordDetail: false,
        fadeMajorRegions: true,
        showMajorRoutes: false,
        showLocalRoutes: true,
      }
    case 'local':
      return {
        showMajorHalos: false,
        showMajorMarkers: false,
        showMajorLabels: false,
        showSubregions: true,
        showSubregionMarkers: true,
        showSubregionLabels: false,
        showPlaces: true,
        showPlaceLabels: true,
        showAllPlaces: false,
        showRecordDetail: false,
        fadeMajorRegions: true,
        showMajorRoutes: false,
        showLocalRoutes: true,
      }
    case 'place':
      return {
        showMajorHalos: false,
        showMajorMarkers: false,
        showMajorLabels: false,
        showSubregions: false,
        showSubregionMarkers: false,
        showSubregionLabels: false,
        showPlaces: true,
        showPlaceLabels: true,
        showAllPlaces: true,
        showRecordDetail: false,
        fadeMajorRegions: true,
        showMajorRoutes: false,
        showLocalRoutes: true,
      }
    case 'record':
      return {
        showMajorHalos: false,
        showMajorMarkers: false,
        showMajorLabels: false,
        showSubregions: false,
        showSubregionMarkers: false,
        showSubregionLabels: false,
        showPlaces: true,
        showPlaceLabels: true,
        showAllPlaces: true,
        showRecordDetail: true,
        fadeMajorRegions: true,
        showMajorRoutes: false,
        showLocalRoutes: true,
      }
  }
}

export function markerDiameterPx(level: MapZoomLevel, kind: 'major' | 'sub' | 'place'): number {
  const table: Record<MapZoomLevel, Record<'major' | 'sub' | 'place', number>> = {
    family: { major: 30, sub: 28, place: 18 },
    regional: { major: 26, sub: 26, place: 18 },
    local: { major: 22, sub: 24, place: 20 },
    place: { major: 20, sub: 20, place: 18 },
    record: { major: 18, sub: 18, place: 18 },
  }
  return Math.min(42, Math.max(18, table[level][kind]))
}

export function heatIntensity(placeCount: number, maxCount: number): number {
  if (maxCount <= 0) return 0.04
  return 0.03 + (placeCount / maxCount) * 0.09
}

export function regionVisibleAtLevel(
  regionId: FamilyRegionId,
  level: MapZoomLevel,
  focusRegionId: FamilyRegionId | null,
): boolean {
  if (level === 'family') return true
  if (!focusRegionId) return level === 'regional'
  return regionId === focusRegionId
}

export function subregionVisibleAtLevel(
  sub: MapSubregion,
  level: MapZoomLevel,
  focusRegionId: FamilyRegionId | null,
  focusSubregionId: string | null,
): boolean {
  if (level === 'family') return false
  if (focusRegionId && sub.parentRegionId !== focusRegionId) return false
  if (level === 'place' || level === 'record') {
    return focusSubregionId ? sub.id === focusSubregionId : false
  }
  if (level === 'local' && focusSubregionId) return sub.id === focusSubregionId
  return true
}

/** @deprecated Use MapZoomLevel */
export type LegacyMapZoomLevel = 'overview' | 'subregions' | 'cities' | 'detail'

export function legacyToLevel(legacy: LegacyMapZoomLevel): MapZoomLevel {
  const map: Record<LegacyMapZoomLevel, MapZoomLevel> = {
    overview: 'family',
    subregions: 'regional',
    cities: 'local',
    detail: 'record',
  }
  return map[legacy]
}
