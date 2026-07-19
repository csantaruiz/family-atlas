import { buildFamilyEvents } from '../data/buildFamilyEvents'
import { familyDatabase } from '../data/familyDatabase'
import { dedupeFamilyEvents } from './canonicalEvent'
import { buildFamilyRegions } from './mapRegions'
import type { RouteConfidence } from './mapRoutes'
import { buildRegionalRoutes, curvedRoutePath } from './mapRoutes'
import { buildMigrationSegments, buildPlaceIndex } from './placeIndex'

export type BackdropMigrationArc = {
  id: string
  d: string
  confidence: RouteConfidence
}

export function buildBackdropMigrationArcs(maxRoutes = 9): BackdropMigrationArc[] {
  const people = familyDatabase.people
  const events = dedupeFamilyEvents(buildFamilyEvents(people))
  const places = buildPlaceIndex(people, events)
  const migrations = buildMigrationSegments(people, events)
  const regions = buildFamilyRegions(places)
  const routes = buildRegionalRoutes(migrations, regions, events)

  return routes
    .sort((a, b) => b.moveCount - a.moveCount || b.segments.length - a.segments.length)
    .slice(0, maxRoutes)
    .map((route) => ({
      id: route.id,
      d: curvedRoutePath(route.from, route.to),
      confidence: route.confidence,
    }))
}
