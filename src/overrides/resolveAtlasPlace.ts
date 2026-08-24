import { mapCoordinateFromUnified } from '../places/adapters/exploreMapCoordinate'
import type { MapCoordinate } from '../data/placeCoordinates'
import { resolvePlaceCoordinateLegacy } from '../data/placeCoordinates'
import { getAtlasPlace } from '../places/registry/atlasPlaceRegistry'
import { normalizePlace } from '../places/normalizePlace'
import { placeFingerprint } from '../places/placeFingerprint'
import { resolveCanonicalPlaceSync } from '../places/resolveCanonicalPlace'
import type { CanonicalPlaceResolution } from '../places/types'
import { projectGeo } from '../utils/mapProjection'
import { journeyPlaceKey, journeyPlaceLabel } from '../utils/lifeJourney/journeyPlaceBasics'
import { isRuntimeApplicable } from './identity'
import { getCachedPlaceOverride } from './overrideCache'
import type {
  AtlasOverrideRecord,
  PlaceConfirmPayload,
  PlaceCoordinatesPayload,
  PlaceLabelPayload,
} from './types'

export type AtlasPlaceResolution = {
  original: string
  label: string
  coordinate: MapCoordinate
  canonicalPlaceId: string | null
  confidence: string
  source: 'override' | 'canonical' | 'legacy' | 'unresolved'
  override: AtlasOverrideRecord | null
  selectionProvenance: 'canonical_selection' | 'manual_coordinates' | null
  automated: CanonicalPlaceResolution
}

function projectLatLng(lat: number, lng: number, region: string, label?: string): MapCoordinate {
  const projected = projectGeo(lng, lat)
  return {
    x: projected.x,
    y: projected.y,
    resolved: true,
    region,
    displayRegion: label,
  }
}

/** Legacy Journey coordinate fallback (mirrors pre-override journeyPlace path). */
function legacyJourneyCoordinate(trimmed: string): MapCoordinate {
  const direct = resolvePlaceCoordinateLegacy(trimmed)
  if (direct.resolved) return direct

  const key = journeyPlaceKey(trimmed)
  if (key === 'united-states:california') {
    return resolvePlaceCoordinateLegacy('Los Angeles, California, USA')
  }
  if (key === 'united-states:texas') {
    return resolvePlaceCoordinateLegacy('El Paso, Texas, USA')
  }
  if (key === 'united-states:new-jersey') {
    return resolvePlaceCoordinateLegacy('Camden City, Camden, New Jersey')
  }
  if (key === 'england') return resolvePlaceCoordinateLegacy('England')
  if (key === 'scotland') return resolvePlaceCoordinateLegacy('Scotland')
  if (key === 'mexico') return resolvePlaceCoordinateLegacy('Mexico')
  return { x: 50, y: 50, resolved: false, region: '' }
}

function automatedCoordinate(trimmed: string, automated: CanonicalPlaceResolution): MapCoordinate {
  const fromUnified = mapCoordinateFromUnified(automated)
  if (
    fromUnified.resolved &&
    automated.confidence !== 'LOW' &&
    automated.confidence !== 'UNRESOLVED' &&
    automated.status !== 'ambiguous' &&
    automated.status !== 'unresolved' &&
    automated.status !== 'normalization-only'
  ) {
    return fromUnified
  }
  return legacyJourneyCoordinate(trimmed)
}

function applyPlaceOverride(
  original: string,
  override: AtlasOverrideRecord,
  automated: CanonicalPlaceResolution,
): AtlasPlaceResolution | null {
  if (!isRuntimeApplicable(override)) return null

  if (override.overrideType === 'confirm_resolution') {
    const payload = override.payload as PlaceConfirmPayload
    const place = getAtlasPlace(payload.canonicalPlaceId)
    if (!place) return null
    return {
      original,
      label: payload.label || place.canonicalName || journeyPlaceLabel(original),
      coordinate: {
        x: place.x,
        y: place.y,
        resolved: true,
        region: place.hierarchy.country,
        displayRegion: payload.label || place.canonicalName,
      },
      canonicalPlaceId: payload.canonicalPlaceId,
      confidence: 'CONFIRMED',
      source: 'override',
      override,
      selectionProvenance: 'canonical_selection',
      automated,
    }
  }

  if (override.overrideType === 'set_coordinates') {
    const payload = override.payload as PlaceCoordinatesPayload
    const region =
      automated.provenance.matchedAdminPath?.[0] ||
      (automated.label ?? 'United States')
    return {
      original,
      label: payload.label || journeyPlaceLabel(original),
      coordinate: projectLatLng(payload.lat, payload.lng, region, payload.label),
      canonicalPlaceId: null,
      confidence: 'CONFIRMED',
      source: 'override',
      override,
      selectionProvenance: 'manual_coordinates',
      automated,
    }
  }

  if (override.overrideType === 'set_label') {
    const payload = override.payload as PlaceLabelPayload
    const coordinate = automatedCoordinate(original, automated)
    return {
      original,
      label: payload.label,
      coordinate,
      canonicalPlaceId: automated.canonicalPlaceId,
      confidence: automated.confidence,
      source: coordinate.resolved
        ? automated.canonicalPlaceId
          ? 'canonical'
          : 'legacy'
        : 'unresolved',
      override,
      selectionProvenance: payload.selectionProvenance ?? null,
      automated,
    }
  }

  return null
}

/**
 * Override-aware place resolution.
 * No applicable override → same result as current Journey canonical-first path.
 */
export function resolveAtlasPlace(original: string): AtlasPlaceResolution {
  const trimmed = original.trim()
  const automated = resolveCanonicalPlaceSync(trimmed)
  const fingerprint = placeFingerprint(normalizePlace(trimmed))
  const override = getCachedPlaceOverride(fingerprint)

  if (override) {
    const applied = applyPlaceOverride(trimmed, override, automated)
    if (applied) return applied
  }

  const coordinate = automatedCoordinate(trimmed, automated)
  const label = journeyPlaceLabel(trimmed)
  if (coordinate.resolved) {
    const usedCanonical =
      Boolean(automated.canonicalPlaceId) &&
      automated.confidence !== 'LOW' &&
      automated.confidence !== 'UNRESOLVED' &&
      mapCoordinateFromUnified(automated).resolved
    return {
      original: trimmed,
      label,
      coordinate,
      canonicalPlaceId: automated.canonicalPlaceId,
      confidence: automated.confidence,
      source: usedCanonical ? 'canonical' : 'legacy',
      override: null,
      selectionProvenance: null,
      automated,
    }
  }

  return {
    original: trimmed,
    label,
    coordinate,
    canonicalPlaceId: null,
    confidence: 'UNRESOLVED',
    source: 'unresolved',
    override: null,
    selectionProvenance: null,
    automated,
  }
}
