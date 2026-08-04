import { describe, expect, it } from 'vitest'
import {
  countSegmentDirections,
  normalizeMigrationEndpoint,
  pickDominantEndpoints,
} from '../../utils/migrationRouteDirection'
import {
  buildCanonicalMigrationCorridors,
  clearGedcomRouteCache,
  resolveGedcomPlaceToCanonicalId,
  resolveGedcomMigrationRoutes,
} from '../core/gedcomMigrationDirector'

describe('migration route direction', () => {
  it('pickDominantEndpoints follows the heavier migration count', () => {
    const from = { x: 10, y: 20 }
    const to = { x: 40, y: 50 }

    expect(pickDominantEndpoints(from, to, 5, 2)).toEqual({ from, to })
    expect(pickDominantEndpoints(from, to, 2, 5)).toEqual({ from: to, to: from })
  })

  it('counts canonical segment directions for a corridor pair', () => {
    clearGedcomRouteCache()
    const corridors = buildCanonicalMigrationCorridors()
    const atlantic = corridors.find((corridor) => corridor.id === 'scotland->new-jersey')
    expect(atlantic).toBeDefined()

    const reverse = corridors.find((corridor) => corridor.id === 'new-jersey->scotland')
    const counts = countSegmentDirections(
      [...atlantic!.segments, ...(reverse?.segments ?? [])],
      'scotland',
      'new-jersey',
      resolveGedcomPlaceToCanonicalId,
    )
    expect(counts.forward).toBeGreaterThan(counts.reverse)
  })

  it('assigns flow duration to resolved GEDCOM routes', () => {
    clearGedcomRouteCache()
    const routes = resolveGedcomMigrationRoutes({
      chapter: 'Convergence',
      geographicScale: 'continental',
      sceneProgress: 0.6,
      closingMap: true,
      timeMs: 222_000,
      visiblePlaceIds: ['scotland', 'new-jersey'],
      focusPlaceIds: ['scotland', 'new-jersey'],
    })

    expect(routes.length).toBeGreaterThan(0)
    expect(routes.every((route) => (route.flowDurationSec ?? 0) > 0)).toBe(true)
  })

  it('normalizes migration endpoints consistently with GEDCOM corridors', () => {
    expect(normalizeMigrationEndpoint('camden')).toBe('new-jersey')
    expect(normalizeMigrationEndpoint('gawsworth')).toBe('cheshire')
  })
})
