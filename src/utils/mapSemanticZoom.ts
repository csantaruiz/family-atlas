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

/** Project atlas coordinate (0–100) to screen percentage with camera pan/zoom. */
export function projectMapPoint(
  x: number,
  y: number,
  camera: MapCamera,
): { left: number; top: number } {
  const scale = camera.scale * MAP_FRAME_COVERAGE
  return {
    left: 50 + (x - camera.cx) * scale,
    top: 50 + (y - camera.cy) * scale,
  }
}

export function cameraTransform(camera: MapCamera): string {
  const scale = camera.scale * MAP_FRAME_COVERAGE
  const tx = (50 - camera.cx) * scale
  const ty = (50 - camera.cy) * scale
  return `translate(${tx}%, ${ty}%) scale(${scale})`
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
