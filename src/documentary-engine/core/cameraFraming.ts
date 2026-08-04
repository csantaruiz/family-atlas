import { expandBounds, boundsFromPoints, type MapBounds } from '../../utils/mapRegionGeometry'
import { projectGeo } from '../../utils/mapProjection'
import type { MapCamera } from '../../utils/mapSemanticZoom'
import {
  DOCUMENTARY_MAX_CAMERA_SCALE,
  DOCUMENTARY_MAX_SCALE_DELTA,
  DOCUMENTARY_SCALE_INTERP_EXPONENT,
} from '../data/playbackConfig'
import {
  canDriveLocalCamera,
  getCanonicalPlace,
  placesForIds,
  SCALE_ZOOM,
  type ProjectedPlace,
} from '../data/canonicalPlaceRegistry'
import type { GeographicScale, SceneChoreography } from '../types/choreography'

/** Geographic center of the family atlas viewport — NOT viewBox (50,50) which lands on West Africa. */
const ATLAS_GEO_CENTER = projectGeo(-68, 38.5)

export const ATLAS_ESTABLISHING_CAMERA: MapCamera = {
  cx: ATLAS_GEO_CENTER.x,
  cy: ATLAS_GEO_CENTER.y,
  scale: SCALE_ZOOM.world,
}

/** @deprecated Use ATLAS_ESTABLISHING_CAMERA — (50,50) projected to West Africa on Natural Earth. */
export const DEFAULT_WORLD_CAMERA: MapCamera = ATLAS_ESTABLISHING_CAMERA

const SAFE_TEXT_BIAS_Y = 4

function boundsForPlaces(places: ProjectedPlace[], padding = 12): MapBounds {
  return expandBounds(
    boundsFromPoints(places.map((p) => ({ x: p.x, y: p.y }))),
    padding,
  )
}

export function cameraFromPlaceBounds(places: ProjectedPlace[], targetScale?: number): MapCamera {
  return cameraFromBounds(boundsForPlaces(places), targetScale)
}

function cameraFromBounds(bounds: MapBounds, targetScale?: number): MapCamera {
  const width = Math.max(4, bounds.maxX - bounds.minX)
  const height = Math.max(4, bounds.maxY - bounds.minY)
  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2 + SAFE_TEXT_BIAS_Y * 0.08

  const fitScale = Math.min(88 / width, 72 / height) * 0.34
  const scale = targetScale ?? fitScale

  return {
    cx,
    cy,
    scale: Math.max(SCALE_ZOOM.world, Math.min(DOCUMENTARY_MAX_CAMERA_SCALE, scale)),
  }
}

export function cameraForPlaceScale(
  placeId: string,
  scale: GeographicScale,
  bias?: { x?: number; y?: number },
): MapCamera {
  const place = getCanonicalPlace(placeId)
  if (!place) return ATLAS_ESTABLISHING_CAMERA

  const effectiveScale =
    scale === 'local' && !canDriveLocalCamera(place.confidence) ? 'regional' : scale

  return {
    cx: place.x + (bias?.x ?? 0),
    cy: place.y + (bias?.y ?? SAFE_TEXT_BIAS_Y * 0.06),
    scale: SCALE_ZOOM[effectiveScale],
  }
}

export function cameraForRoute(
  fromId: string,
  toId: string,
  scale: GeographicScale = 'continental',
): MapCamera {
  const places = placesForIds([fromId, toId])
  if (places.length < 2) return cameraForPlaceScale(fromId, scale)

  const bounds = boundsForPlaces(places, scale === 'continental' ? 10 : 6)
  const target = scale === 'continental' ? undefined : SCALE_ZOOM[scale]
  return cameraFromBounds(bounds, target)
}

export function computeSceneEndCamera(choreography: SceneChoreography): MapCamera {
  if (choreography.cameraEnd) return choreography.cameraEnd

  const activeId = choreography.activePlaceId
  const scale = choreography.geographicScale

  if (activeId) {
    return cameraForPlaceScale(activeId, scale)
  }

  const ids = choreography.focusPlaceIds ?? []
  if (ids.length === 0) {
    return { ...ATLAS_ESTABLISHING_CAMERA, scale: SCALE_ZOOM[scale] }
  }

  if (ids.length === 1) {
    return cameraForPlaceScale(ids[0], scale)
  }

  if (choreography.cameraRelation === 'fit-route') {
    return cameraForRoute(ids[0], ids[1], scale)
  }

  const places = placesForIds(ids)
  return cameraFromPlaceBounds(places, SCALE_ZOOM[scale])
}

export function softenCameraTarget(target: MapCamera, previous: MapCamera): MapCamera {
  const capped = Math.min(target.scale, DOCUMENTARY_MAX_CAMERA_SCALE)
  const scale =
    capped > previous.scale
      ? Math.min(capped, previous.scale + DOCUMENTARY_MAX_SCALE_DELTA)
      : Math.max(SCALE_ZOOM.world, capped)

  return {
    cx: target.cx,
    cy: target.cy,
    scale,
  }
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

export function interpolateCamera(from: MapCamera, to: MapCamera, t: number): MapCamera {
  const clamped = Math.min(1, Math.max(0, t))
  const panT = easeInOutCubic(clamped)
  const scaleT = easeInOutCubic(Math.pow(clamped, DOCUMENTARY_SCALE_INTERP_EXPONENT))

  return {
    cx: from.cx + (to.cx - from.cx) * panT,
    cy: from.cy + (to.cy - from.cy) * panT,
    scale: from.scale + (to.scale - from.scale) * scaleT,
  }
}

export function applyHoldDrift(
  camera: MapCamera,
  progress: number,
  phase: number,
  options: { pan?: boolean; scale?: boolean } = {},
): MapCamera {
  const t = Math.min(1, Math.max(0, progress))
  const panDrift = options.pan !== false
  const scaleDrift = options.scale !== false

  return {
    cx: panDrift ? camera.cx + Math.sin(t * Math.PI * 1.6 + phase) * 0.18 : camera.cx,
    cy: panDrift ? camera.cy + Math.cos(t * Math.PI * 1.4 + phase * 0.7) * 0.12 : camera.cy,
    scale: scaleDrift ? camera.scale + Math.sin(phase + t * 4) * 0.002 : camera.scale,
  }
}
