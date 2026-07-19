import { curvedRoutePath, type RegionalRoute, type SubregionRoute } from './mapRoutes'

export type MapRouteLike = RegionalRoute | SubregionRoute

export function routePathD(route: MapRouteLike): string {
  return curvedRoutePath(route.from, route.to)
}

export function formatRouteYearLabel(route: MapRouteLike): string {
  if (route.yearMin == null && route.yearMax == null) return 'Dates uncertain'
  if (route.yearMin == null) return `By ${route.yearMax}`
  if (route.yearMax == null) return `From ${route.yearMin}`
  if (route.yearMin === route.yearMax) return String(route.yearMin)
  return `${route.yearMin}–${route.yearMax}`
}

export function formatRouteTravelers(route: MapRouteLike, maxNames = 3): string {
  if (route.people.length === 0) return 'Unknown travelers'
  if (route.people.length === 1) return route.people[0].name
  if (route.people.length <= maxNames) {
    return route.people.map((p) => p.name).join(' · ')
  }
  const shown = route.people
    .slice(0, maxNames)
    .map((p) => p.name)
    .join(' · ')
  return `${shown} +${route.people.length - maxNames} more`
}

export function routeHasDetail(route: MapRouteLike): boolean {
  return route.moveCount > 0 || route.people.length > 0 || route.segments.length > 0
}

/** Duration scales slightly with corridor length — always slow. */
export function routeMotionDuration(from: { x: number; y: number }, to: { x: number; y: number }): number {
  const dist = Math.hypot(to.x - from.x, to.y - from.y)
  return Math.round(14 + dist * 0.45)
}
