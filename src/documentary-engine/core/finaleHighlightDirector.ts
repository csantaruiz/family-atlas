import {
  getCanonicalPlace,
  placesForIds,
  SCALE_ZOOM,
} from '../data/canonicalPlaceRegistry'
import {
  ATLAS_ESTABLISHING_CAMERA,
  cameraFromPlaceBounds,
} from './cameraFraming'
import { resolveAllScriptPlaceIds } from './scriptMentionDirector'

/** Wide atlas framing — derived from every place named in the narration script. */
export const FINALE_WORLD_CAMERA = (() => {
  const places = placesForIds(resolveAllScriptPlaceIds())
  if (places.length === 0) return ATLAS_ESTABLISHING_CAMERA

  const fitted = cameraFromPlaceBounds(places, SCALE_ZOOM.world)
  return {
    cx: fitted.cx,
    cy: fitted.cy,
    scale: Math.min(fitted.scale, ATLAS_ESTABLISHING_CAMERA.scale),
  }
})()

export function resolveFinaleHighlightPlaceId(
  cuePlaceId: string | undefined,
  fallbackPlaceId: string | undefined,
): string | undefined {
  if (cuePlaceId && getCanonicalPlace(cuePlaceId)) return cuePlaceId
  return fallbackPlaceId
}
