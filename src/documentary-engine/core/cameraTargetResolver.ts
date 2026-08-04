import { projectGeo } from '../../utils/mapProjection'
import type { MapCamera } from '../../utils/mapSemanticZoom'
import {
  canDriveLocalCamera,
  allCanonicalPlaces,
  getCanonicalPlace,
  placesForIds,
  SCALE_ZOOM,
  type ProjectedPlace,
} from '../data/canonicalPlaceRegistry'
import type { GeographicScale, SceneChoreography } from '../types/choreography'
import {
  ATLAS_ESTABLISHING_CAMERA,
  cameraForPlaceScale,
  cameraForRoute,
  cameraFromPlaceBounds,
} from './cameraFraming'

export type CameraTargetSource =
  | 'explicit-camera-end'
  | 'route-bounds'
  | 'active-place'
  | 'focus-places-bounds'
  | 'chapter-establishing'
  | 'previous-camera'
  | 'atlas-establishing'

export type ResolvedCameraTarget = {
  camera: MapCamera
  source: CameraTargetSource
  fitBounds: boolean
  fallbackUsed: boolean
  activePlaceId?: string
}

const WESTERN_EUROPE_CENTER = projectGeo(-4, 50)

function warnUnresolved(sceneId: string | undefined, message: string): void {
  if (import.meta.env.DEV) {
    console.warn(`[documentary-camera]${sceneId ? ` scene=${sceneId}` : ''} ${message}`)
  }
}

function isWorldEstablishing(choreography: SceneChoreography, sceneType?: string): boolean {
  return (
    choreography.geographicScale === 'world' ||
    sceneType === 'world-establishing' ||
    (!choreography.activePlaceId && !choreography.focusPlaceIds?.length && !choreography.routes?.length)
  )
}

function resolveActivePlaceCamera(
  placeId: string,
  scale: GeographicScale,
): MapCamera | null {
  const place = getCanonicalPlace(placeId)
  if (!place || place.confidence === 'unresolved') return null
  if (scale === 'local' && !canDriveLocalCamera(place.confidence)) {
    return cameraForPlaceScale(placeId, 'regional')
  }
  return cameraForPlaceScale(placeId, scale)
}

function resolveFocusBoundsCamera(
  ids: string[],
  scale: GeographicScale,
  fitRoute: boolean,
): MapCamera | null {
  const places = placesForIds(ids)
  if (places.length === 0) return null

  if (places.length === 1) {
    return cameraForPlaceScale(places[0].id, scale)
  }

  if (fitRoute && places.length >= 2) {
    return cameraForRoute(places[0].id, places[1].id, scale)
  }

  return cameraFromPlaceBounds(places, SCALE_ZOOM[scale])
}

/** Priority: explicit end → route bounds → active place → focus bounds → chapter/atlas → null */
export function resolveCameraTarget(
  choreography: SceneChoreography,
  options: {
    sceneId?: string
    sceneType?: string
    previousCamera: MapCamera
  },
): ResolvedCameraTarget | null {
  const { sceneId, sceneType, previousCamera } = options
  const scale = choreography.geographicScale
  const activeId = choreography.activePlaceId
  const focusIds = choreography.focusPlaceIds ?? []
  const hasPlaces = Boolean(activeId || focusIds.length)

  if (choreography.cameraEnd) {
    return {
      camera: choreography.cameraEnd,
      source: 'explicit-camera-end',
      fitBounds: false,
      fallbackUsed: false,
      activePlaceId: activeId,
    }
  }

  if (isWorldEstablishing(choreography, sceneType) && !hasPlaces) {
    return {
      camera: { ...ATLAS_ESTABLISHING_CAMERA, scale: SCALE_ZOOM[scale] ?? ATLAS_ESTABLISHING_CAMERA.scale },
      source: 'atlas-establishing',
      fitBounds: false,
      fallbackUsed: false,
    }
  }

  if (choreography.routes?.length && choreography.cameraRelation === 'fit-route') {
    const route = choreography.routes[0]
    const from = getCanonicalPlace(route.fromId)
    const to = getCanonicalPlace(route.toId)
    if (from && to) {
      if (activeId && activeId === route.toId) {
        const activeCam = resolveActivePlaceCamera(activeId, scale)
        if (activeCam) {
          return {
            camera: activeCam,
            source: 'active-place',
            fitBounds: false,
            fallbackUsed: false,
            activePlaceId: activeId,
          }
        }
      }

      const routeCam = cameraForRoute(route.fromId, route.toId, scale)
      return {
        camera: routeCam,
        source: 'route-bounds',
        fitBounds: true,
        fallbackUsed: false,
        activePlaceId: activeId,
      }
    }
  }

  if (activeId) {
    const activeCam = resolveActivePlaceCamera(activeId, scale)
    if (activeCam) {
      return {
        camera: activeCam,
        source: 'active-place',
        fitBounds: false,
        fallbackUsed: false,
        activePlaceId: activeId,
      }
    }
    warnUnresolved(sceneId, `active place "${activeId}" unresolved — retaining previous camera`)
    return null
  }

  if (focusIds.length > 0) {
    const fitRoute = choreography.cameraRelation === 'fit-route'
    const boundsCam = resolveFocusBoundsCamera(focusIds, scale, fitRoute)
    if (boundsCam) {
      return {
        camera: boundsCam,
        source: fitRoute ? 'route-bounds' : 'focus-places-bounds',
        fitBounds: focusIds.length > 1,
        fallbackUsed: false,
      }
    }
    warnUnresolved(sceneId, `focus places unresolved — retaining previous camera`)
    return null
  }

  if (choreography.cameraRelation === 'chapter-reset' || choreography.cameraRelation === 'chapter-transition') {
    return {
      camera: {
        cx: WESTERN_EUROPE_CENTER.x,
        cy: WESTERN_EUROPE_CENTER.y,
        scale: SCALE_ZOOM.country,
      },
      source: 'chapter-establishing',
      fitBounds: false,
      fallbackUsed: false,
    }
  }

  if (hasPlaces) {
    warnUnresolved(sceneId, 'location IDs present but camera target unresolved — retaining previous camera')
    return null
  }

  return {
    camera: previousCamera,
    source: 'previous-camera',
    fitBounds: false,
    fallbackUsed: false,
  }
}

export function placeAtCameraCenter(camera: MapCamera): ProjectedPlace | null {
  let best: ProjectedPlace | null = null
  let bestDist = Infinity

  for (const place of allCanonicalPlaces()) {
    const dist = Math.hypot(place.x - camera.cx, place.y - camera.cy)
    if (dist < bestDist) {
      bestDist = dist
      best = place
    }
  }

  return bestDist < 18 ? best : null
}
