import type { FamilyRegionId } from './mapRegions'
import { inferRegionId } from './mapRegions'
import { routeMotionDuration } from './mapMigrationMotion'
import type { MigrationSegment } from './placeIndex'

export type MapPoint = { x: number; y: number }

export function normalizeMigrationEndpoint(placeId: string): string {
  if (placeId === 'camden' || placeId === 'gloucester-city') return 'new-jersey'
  if (placeId === 'gawsworth') return 'cheshire'
  if (placeId === 'santa-clara') return 'california'
  return placeId
}

export function countSegmentDirections(
  segments: MigrationSegment[],
  fromPlaceId: string,
  toPlaceId: string,
  resolvePlaceId: (gedcomPlace: string) => string | null,
): { forward: number; reverse: number } {
  let forward = 0
  let reverse = 0

  for (const segment of segments) {
    const fromId = resolvePlaceId(segment.from)
    const toId = resolvePlaceId(segment.to)
    if (!fromId || !toId) continue

    const normFrom = normalizeMigrationEndpoint(fromId)
    const normTo = normalizeMigrationEndpoint(toId)
    if (normFrom === fromPlaceId && normTo === toPlaceId) forward++
    else if (normFrom === toPlaceId && normTo === fromPlaceId) reverse++
  }

  return { forward, reverse }
}

function placeRecordFromSegment(segment: MigrationSegment, which: 'from' | 'to') {
  const name = which === 'from' ? segment.from : segment.to
  return {
    id: name,
    name,
    coordinate: which === 'from' ? segment.fromCoord : segment.toCoord,
    people: [],
    events: [],
    yearMin: null,
    yearMax: null,
    branches: [],
    eventCount: 0,
  }
}

export function countRegionalDirections(
  segments: MigrationSegment[],
  fromRegionId: FamilyRegionId,
  toRegionId: FamilyRegionId,
): { forward: number; reverse: number } {
  let forward = 0
  let reverse = 0

  for (const segment of segments) {
    const fromRegion = inferRegionId(placeRecordFromSegment(segment, 'from'))
    const toRegion = inferRegionId(placeRecordFromSegment(segment, 'to'))
    if (fromRegion === fromRegionId && toRegion === toRegionId) forward++
    else if (fromRegion === toRegionId && toRegion === fromRegionId) reverse++
  }

  return { forward, reverse }
}

/** Pick endpoints so the drawn path follows the heavier migration flow. */
export function pickDominantEndpoints(
  fromPoint: MapPoint,
  toPoint: MapPoint,
  forwardWeight: number,
  reverseWeight: number,
): { from: MapPoint; to: MapPoint } {
  if (reverseWeight > forwardWeight) {
    return { from: toPoint, to: fromPoint }
  }
  return { from: fromPoint, to: toPoint }
}

export function migrationRouteFlowDuration(from: MapPoint, to: MapPoint): number {
  return routeMotionDuration(from, to)
}
