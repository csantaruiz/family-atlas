import type { JourneyInsightModel } from './journeyInsight'
import type { FamilyRegion, FamilyRegionId } from './mapRegions'
import type { PlaceRecord } from './placeIndex'
import type { MapBounds } from './mapRegionGeometry'
import {
  boundsFromResolvedPlaces,
  boundsFromRouteEndpoints,
  DEFAULT_FAMILY_CONTENT_BOUNDS,
  unionMapBounds,
} from './mapRegionGeometry'

/**
 * Prefer resolved place markers for a region; fall back to halo bounds.
 * Keeps regional camera on family evidence, not generic continent boxes.
 */
export function boundsForFamilyRegion(region: FamilyRegion): MapBounds {
  return (
    boundsFromResolvedPlaces(region.places, region.id === 'britain_ireland' ? 7 : 6) ??
    region.bounds
  )
}

/** Geographic bounds supporting a Journey Insight (people / places / regions / routes). */
export function boundsForJourneyInsight(
  insight: JourneyInsightModel,
  regions: FamilyRegion[],
  places: PlaceRecord[],
  routes: { id: string; from: { x: number; y: number }; to: { x: number; y: number } }[] = [],
): MapBounds {
  const highlight = insight.mapHighlight
  const regionIds = new Set<FamilyRegionId>([
    ...(highlight?.regionIds ?? []),
    ...insight.evidence.regionIds,
  ])
  const placeIds = new Set<string>([
    ...(highlight?.placeIds ?? []),
    ...insight.evidence.placeIds,
  ])
  const routeIds = new Set<string>([
    ...(highlight?.routeIds ?? []),
    ...insight.evidence.routeIds,
  ])

  const parts: MapBounds[] = []

  if (placeIds.size > 0) {
    const selectedPlaces = places.filter((place) => placeIds.has(place.id))
    const fromPlaces = boundsFromResolvedPlaces(selectedPlaces, 6)
    if (fromPlaces) parts.push(fromPlaces)
  }

  for (const region of regions) {
    if (!regionIds.has(region.id)) continue
    parts.push(boundsForFamilyRegion(region))
  }

  for (const route of routes) {
    if (!routeIds.has(route.id)) continue
    parts.push(boundsFromRouteEndpoints(route.from, route.to))
  }

  if (parts.length === 0) {
    const allPlaces = boundsFromResolvedPlaces(places, 8)
    if (allPlaces) return allPlaces
    if (regions.length) return unionMapBounds(regions.map(boundsForFamilyRegion))
    return DEFAULT_FAMILY_CONTENT_BOUNDS
  }

  return unionMapBounds(parts)
}
