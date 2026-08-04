import { getCanonicalPlace } from '../data/canonicalPlaceRegistry'
import type { MapCamera } from '../../utils/mapSemanticZoom'

export type CameraGuardResult = {
  valid: boolean
  camera: MapCamera
  reason?: string
}

/** West Africa anchor on the Natural Earth atlas crop — (50, ~44) in viewBox space. */
const AFRICA_VIEWBOX_ANCHOR = { cx: 50, cy: 43.88 }

const ENGLAND_PLACES = new Set(['britain', 'england', 'cheshire', 'gawsworth'])

function distance(a: { cx: number; cy: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.cx - b.x, a.cy - b.y)
}

function isAfricaDominant(camera: MapCamera): boolean {
  const distToAfrica = Math.hypot(camera.cx - AFRICA_VIEWBOX_ANCHOR.cx, camera.cy - AFRICA_VIEWBOX_ANCHOR.cy)
  return distToAfrica < 12 && camera.cy > 38
}

export function validateCameraGeography(
  activePlaceId: string | undefined,
  camera: MapCamera,
  fallbackCamera: MapCamera,
  sceneId?: string,
): CameraGuardResult {
  if (!activePlaceId) {
    if (isAfricaDominant(camera)) {
      return guardFail(fallbackCamera, 'camera centered on West Africa without active place', sceneId)
    }
    return { valid: true, camera }
  }

  const place = getCanonicalPlace(activePlaceId)
  if (!place) {
    return guardFail(fallbackCamera, `unresolved active place "${activePlaceId}"`, sceneId)
  }

  const maxDist =
    place.geographicScale === 'local' ? 7 : place.geographicScale === 'regional' ? 9 : 12
  const dist = distance(camera, place)

  if (ENGLAND_PLACES.has(activePlaceId)) {
    if (camera.cy > 38) {
      return guardFail(fallbackCamera, `${activePlaceId} scene framed too far south (Africa visible)`, sceneId)
    }
    if (dist > maxDist) {
      return guardFail(fallbackCamera, `${activePlaceId} camera ${dist.toFixed(1)} units from target`, sceneId)
    }
  } else if (dist > maxDist + 4) {
    return guardFail(fallbackCamera, `${activePlaceId} camera off target`, sceneId)
  }

  if (isAfricaDominant(camera) && ENGLAND_PLACES.has(activePlaceId)) {
    return guardFail(fallbackCamera, `${activePlaceId} scene dominated by Africa framing`, sceneId)
  }

  return { valid: true, camera }
}

function guardFail(fallbackCamera: MapCamera, reason: string, sceneId?: string): CameraGuardResult {
  if (import.meta.env.DEV) {
    console.warn(`[documentary-camera-guard]${sceneId ? ` scene=${sceneId}` : ''} ${reason}`)
  }
  return { valid: false, camera: fallbackCamera, reason }
}
