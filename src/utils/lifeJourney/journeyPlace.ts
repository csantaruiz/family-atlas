import { mapCoordinateFromUnified } from '../../places/adapters/exploreMapCoordinate'
import { resolveCanonicalPlaceSync } from '../../places/resolveCanonicalPlace'
import type { CanonicalPlaceResolution } from '../../places/types'
import { resolvePlaceCoordinateLegacy, type MapCoordinate } from '../../data/placeCoordinates'
import { resolveAtlasPlace } from '../../overrides/resolveAtlasPlace'
import { journeyPlaceKey, journeyPlaceLabel, journeyLabelFromComponents } from './journeyPlaceBasics'

export { journeyPlaceKey, journeyPlaceLabel, journeyLabelFromComponents }

export type JourneyPlaceSource = 'canonical' | 'legacy' | 'unresolved'

export type JourneyPlaceResult = {
  label: string
  coordinate: MapCoordinate
  canonicalPlaceId: string | null
  source: JourneyPlaceSource
}

export function isCanonicalUsableForJourney(resolution: CanonicalPlaceResolution): boolean {
  if (
    resolution.status === 'ambiguous' ||
    resolution.status === 'unresolved' ||
    resolution.status === 'normalization-only'
  ) {
    return false
  }
  if (resolution.confidence === 'LOW' || resolution.confidence === 'UNRESOLVED') {
    return false
  }
  if (resolution.latitude == null || resolution.longitude == null || !resolution.projected) {
    return false
  }
  return true
}

function resolveJourneyCoordinateLegacy(trimmed: string): MapCoordinate {
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

function mapAtlasSource(source: string): JourneyPlaceSource {
  if (source === 'override' || source === 'canonical') return 'canonical'
  if (source === 'legacy') return 'legacy'
  return 'unresolved'
}

/**
 * Canonical / override-aware Journey place resolution.
 * No override → same as prior canonical-first + legacy fallback behavior.
 */
export function resolveJourneyPlace(place: string): JourneyPlaceResult {
  const trimmed = place.trim()
  if (!trimmed) {
    return {
      label: '',
      coordinate: { x: 50, y: 50, resolved: false, region: '' },
      canonicalPlaceId: null,
      source: 'unresolved',
    }
  }

  const atlas = resolveAtlasPlace(trimmed)
  if (atlas.source === 'override') {
    return {
      label: atlas.label,
      coordinate: atlas.coordinate,
      canonicalPlaceId: atlas.canonicalPlaceId,
      source: mapAtlasSource(atlas.source),
    }
  }

  // Preserve exact prior path when no override (bit-identical automated behavior).
  const label = journeyPlaceLabel(trimmed)
  const canonical = resolveCanonicalPlaceSync(trimmed)
  if (isCanonicalUsableForJourney(canonical)) {
    const coordinate = mapCoordinateFromUnified(canonical)
    if (coordinate.resolved) {
      return {
        label,
        coordinate,
        canonicalPlaceId: canonical.canonicalPlaceId,
        source: 'canonical',
      }
    }
  }

  const coordinate = resolveJourneyCoordinateLegacy(trimmed)
  return {
    label,
    coordinate,
    canonicalPlaceId: null,
    source: coordinate.resolved ? 'legacy' : 'unresolved',
  }
}

export function resolveJourneyCoordinate(place: string): MapCoordinate {
  return resolveJourneyPlace(place).coordinate
}

export function isTransatlanticKeyPair(a: string, b: string): boolean {
  const brit = (key: string) =>
    key === 'england' || key === 'scotland' || key === 'ireland' || key === 'britain'
  const us = (key: string) => key.startsWith('united-states')
  return (brit(a) && us(b)) || (brit(b) && us(a))
}