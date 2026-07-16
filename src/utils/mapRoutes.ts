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
