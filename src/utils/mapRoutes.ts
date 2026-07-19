import type { FamilyEvent } from '../types'
import type { FamilyRegion, FamilyRegionId } from './mapRegions'
import { inferRegionId } from './mapRegions'
import type { MapSubregion } from './mapSubregions'
import type { MigrationSegment, PlaceRecord } from './placeIndex'

export type RouteConfidence = 'documented' | 'inferred'

export type RegionalRoute = {
  id: string
  fromRegionId: FamilyRegionId
  toRegionId: FamilyRegionId
  fromName: string
  toName: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  confidence: RouteConfidence
  segments: MigrationSegment[]
  people: { id: string; name: string }[]
  yearMin: number | null
  yearMax: number | null
  moveCount: number
}

export type SubregionRoute = {
  id: string
  fromSubregionId: string
  toSubregionId: string
  fromName: string
  toName: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  confidence: RouteConfidence
  segments: MigrationSegment[]
  people: { id: string; name: string }[]
  yearMin: number | null
  yearMax: number | null
  moveCount: number
}

function regionAnchor(region: FamilyRegion): { x: number; y: number } {
  return { x: region.anchor.x, y: region.anchor.y }
}

export function buildRegionalRoutes(
  migrations: MigrationSegment[],
  regions: FamilyRegion[],
  events: FamilyEvent[],
): RegionalRoute[] {
  const regionById = new Map(regions.map((r) => [r.id, r]))
  const routeMap = new Map<string, RegionalRoute>()

  for (const segment of migrations) {
    const fromPlace: PlaceRecord = {
      id: segment.from,
      name: segment.from,
      coordinate: segment.fromCoord,
      people: [],
      events: [],
      yearMin: null,
      yearMax: null,
      branches: [],
      eventCount: 0,
    }
    const toPlace: PlaceRecord = {
      id: segment.to,
      name: segment.to,
      coordinate: segment.toCoord,
      people: [],
      events: [],
      yearMin: null,
      yearMax: null,
      branches: [],
      eventCount: 0,
    }

    const fromRegionId = inferRegionId(fromPlace)
    const toRegionId = inferRegionId(toPlace)
    if (!fromRegionId || !toRegionId || fromRegionId === toRegionId) continue

    const fromRegion = regionById.get(fromRegionId)
    const toRegion = regionById.get(toRegionId)
    if (!fromRegion || !toRegion) continue

    const key = `${fromRegionId}->${toRegionId}`
    const hasMoveEvent = events.some(
      (e) =>
        e.person.id === segment.personId &&
        e.kind === 'move' &&
        (e.detail.includes(segment.from) || e.detail.includes(fromRegion.name)),
    )

    let route = routeMap.get(key)
    if (!route) {
      route = {
        id: key,
        fromRegionId,
        toRegionId,
        fromName: fromRegion.name,
        toName: toRegion.name,
        from: regionAnchor(fromRegion),
        to: regionAnchor(toRegion),
        confidence: hasMoveEvent ? 'documented' : 'inferred',
        segments: [],
        people: [],
        yearMin: null,
        yearMax: null,
        moveCount: 0,
      }
      routeMap.set(key, route)
    }

    route.segments.push(segment)
    if (hasMoveEvent) route.confidence = 'documented'
    if (!route.people.some((p) => p.id === segment.personId)) {
      route.people.push({ id: segment.personId, name: segment.personName })
    }
    if (segment.year != null) {
      route.yearMin = route.yearMin == null ? segment.year : Math.min(route.yearMin, segment.year)
      route.yearMax = route.yearMax == null ? segment.year : Math.max(route.yearMax, segment.year)
    }
    route.moveCount = route.segments.length
  }

  return [...routeMap.values()].sort((a, b) => b.segments.length - a.segments.length)
}

function inferSubregionForPlace(
  place: PlaceRecord,
  subregions: MapSubregion[],
): string | null {
  const key = place.name.trim().toLowerCase()
  for (const sub of subregions) {
    if (sub.places.some((p) => p.name.trim().toLowerCase() === key || p.id === key)) {
      return sub.id
    }
  }
  return null
}

export function buildSubregionRoutes(
  migrations: MigrationSegment[],
  subregions: MapSubregion[],
  events: FamilyEvent[],
): SubregionRoute[] {
  const subById = new Map(subregions.map((s) => [s.id, s]))
  const routeMap = new Map<string, SubregionRoute>()

  for (const segment of migrations) {
    const fromPlace: PlaceRecord = {
      id: segment.from,
      name: segment.from,
      coordinate: segment.fromCoord,
      people: [],
      events: [],
      yearMin: null,
      yearMax: null,
      branches: [],
      eventCount: 0,
    }
    const toPlace: PlaceRecord = {
      id: segment.to,
      name: segment.to,
      coordinate: segment.toCoord,
      people: [],
      events: [],
      yearMin: null,
      yearMax: null,
      branches: [],
      eventCount: 0,
    }

    const fromSubId = inferSubregionForPlace(fromPlace, subregions)
    const toSubId = inferSubregionForPlace(toPlace, subregions)
    if (!fromSubId || !toSubId || fromSubId === toSubId) continue

    const fromSub = subById.get(fromSubId)
    const toSub = subById.get(toSubId)
    if (!fromSub || !toSub) continue

    const key = `${fromSubId}->${toSubId}`
    const hasMoveEvent = events.some(
      (e) =>
        e.person.id === segment.personId &&
        e.kind === 'move' &&
        (e.detail.includes(segment.from) || e.detail.includes(fromSub.name)),
    )

    let route = routeMap.get(key)
    if (!route) {
      route = {
        id: key,
        fromSubregionId: fromSubId,
        toSubregionId: toSubId,
        fromName: fromSub.name,
        toName: toSub.name,
        from: { x: fromSub.anchor.x, y: fromSub.anchor.y },
        to: { x: toSub.anchor.x, y: toSub.anchor.y },
        confidence: hasMoveEvent ? 'documented' : 'inferred',
        segments: [],
        people: [],
        yearMin: null,
        yearMax: null,
        moveCount: 0,
      }
      routeMap.set(key, route)
    }

    route.segments.push(segment)
    if (hasMoveEvent) route.confidence = 'documented'
    if (!route.people.some((p) => p.id === segment.personId)) {
      route.people.push({ id: segment.personId, name: segment.personName })
    }
    if (segment.year != null) {
      route.yearMin = route.yearMin == null ? segment.year : Math.min(route.yearMin, segment.year)
      route.yearMax = route.yearMax == null ? segment.year : Math.max(route.yearMax, segment.year)
    }
    route.moveCount = route.segments.length
  }

  return [...routeMap.values()].sort((a, b) => b.segments.length - a.segments.length)
}

/** Curved SVG path between two points in atlas coordinates (0–100). */
export function curvedRoutePath(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.hypot(dx, dy)
  if (dist < 0.01) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`

  const isTransoceanic = dist > 14
  const bow = isTransoceanic
    ? Math.min(22, 6 + dist * 0.32)
    : Math.min(14, 3 + dist * 0.24)

  const perpX = -dy / dist
  const perpY = dx / dist
  const bowSign = from.x < to.x ? 1 : -1

  const cx =
    (from.x + to.x) / 2 + perpX * bow * 0.42 * bowSign
  const cy =
    (from.y + to.y) / 2 + perpY * bow * 0.42 * bowSign - bow * 0.12

  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`
}

function routeShortPlace(place: string): string {
  return place.split(',')[0].trim() || place
}

function routeDominantPlace(values: string[]): string | null {
  const counts = new Map<string, number>()
  for (const value of values) {
    const label = routeShortPlace(value)
    if (!label) continue
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  let best: string | null = null
  let bestCount = 0
  for (const [label, count] of counts) {
    if (count > bestCount) {
      best = label
      bestCount = count
    }
  }
  return best
}

const REGION_CORRIDOR_TITLES: Partial<Record<string, string>> = {
  'britain_ireland->eastern_us': 'Crossing the Atlantic',
  'britain_ireland->california': 'From Britain to California',
  'britain_ireland->southwest_us': 'From Britain to the Southwest',
  'eastern_us->california': 'Westward to California',
  'mexico->southwest_us': 'Across the borderlands',
  'mexico->california': 'From Mexico to California',
  'mexico->eastern_us': 'From Mexico to the United States',
  'southwest_us->california': 'Into California',
}

/** Narrative title for a migration corridor, derived from GEDCOM move records. */
export function generateMigrationRouteTitle(route: RegionalRoute | SubregionRoute): string {
  if ('fromRegionId' in route) {
    const corridorKey = `${route.fromRegionId}->${route.toRegionId}`
    const corridorTitle = REGION_CORRIDOR_TITLES[corridorKey]
    if (corridorTitle) return corridorTitle
  }

  if (route.segments.length > 0) {
    const from = routeDominantPlace(route.segments.map((segment) => segment.from))
    const to = routeDominantPlace(route.segments.map((segment) => segment.to))
    if (from && to && from.toLowerCase() !== to.toLowerCase()) {
      return `${from} to ${to}`
    }
  }

  return `${route.fromName} → ${route.toName}`
}

const ROUTE_SYNOPSIS: Partial<Record<string, string>> = {
  'britain_ireland->eastern_us':
    'Atlantic crossings appear to bring English and Irish branches into the mid-Atlantic colonies, where families consolidate in port and industrial towns rather than moving west immediately.',
  'britain_ireland->california':
    'Later crossings suggest a long corridor from Britain toward the Pacific coast, skipping intermediate settlement in favor of a western destination.',
  'britain_ireland->southwest_us':
    'Records suggest movement from Britain into the American Southwest, likely through intermediate ports before families push inland.',
  'eastern_us->california':
    'Westward moves suggest families leaving the eastern seaboard for California, treating the continent as a sequence of chapters rather than one permanent home.',
  'mexico->southwest_us':
    'Borderland records suggest families crossing from northern Mexico into the American Southwest as political boundaries shift around them.',
  'mexico->california':
    'Movement from Mexico toward California suggests a northward expansion as later generations leave older Chihuahua roots.',
  'mexico->eastern_us':
    'A less common corridor — when it appears, it suggests families bypassing the borderlands for direct resettlement in the eastern United States.',
  'southwest_us->california':
    'Short western corridors suggest families already near the border pushing into California as the final American chapter.',
}

/** Inferred narrative for a migration corridor before names and move lists. */
export function generateMigrationRouteSynopsis(route: RegionalRoute | SubregionRoute): string {
  const yearLead =
    route.yearMin != null && route.yearMax != null
      ? route.yearMin === route.yearMax
        ? `In ${route.yearMin}, `
        : `Between ${route.yearMin} and ${route.yearMax}, `
      : ''

  const confidenceLead =
    route.confidence === 'documented'
      ? 'Documented moves suggest '
      : 'Inferred routes suggest '

  if ('fromRegionId' in route) {
    const corridorKey = `${route.fromRegionId}->${route.toRegionId}`
    const corridorSynopsis = ROUTE_SYNOPSIS[corridorKey]
    if (corridorSynopsis) {
      return `${yearLead}${confidenceLead}${corridorSynopsis}`
    }
  }

  const fromPlace = routeDominantPlace(route.segments.map((segment) => segment.from))
  const toPlace = routeDominantPlace(route.segments.map((segment) => segment.to))

  if (fromPlace && toPlace && fromPlace.toLowerCase() !== toPlace.toLowerCase()) {
    const moveTail =
      route.moveCount === 1 ? 'a single recorded move' : `${route.moveCount} recorded moves`
    return `${yearLead}${confidenceLead}a corridor from ${fromPlace} toward ${toPlace} across ${moveTail}.`
  }

  const moveTail =
    route.moveCount === 1 ? 'a single recorded move' : `${route.moveCount} recorded moves`
  return `${yearLead}${confidenceLead}a corridor from ${route.fromName} toward ${route.toName} across ${moveTail}.`
}
