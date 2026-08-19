import { describe, expect, it } from 'vitest'
import { getAtlasPlace } from '../../places/registry/atlasPlaceRegistry'
import { resolveCanonicalPlaceSync } from '../../places/resolveCanonicalPlace'
import { resolvePlaceCoordinateLegacy } from '../../data/placeCoordinates'
import {
  isCanonicalUsableForJourney,
  journeyPlaceLabel,
  resolveJourneyCoordinate,
  resolveJourneyPlace,
} from './journeyPlace'

describe('journeyPlaceLabel', () => {
  it('labels Forkston as town + Pennsylvania, not Wyoming state', () => {
    expect(journeyPlaceLabel('Forkston, Wyoming, Pennsylvania, United States')).toBe(
      'Forkston, Pennsylvania',
    )
    expect(journeyPlaceLabel('of Forkston,Wyoming,Pa')).toBe('Forkston, Pennsylvania')
    expect(journeyPlaceLabel('Forkston, Wyoming, Pennsylvania, United States')).not.toMatch(
      /Forkston, Wyoming$/,
    )
  })

  it('labels a normal US city and state', () => {
    expect(journeyPlaceLabel('El Paso, Texas, USA')).toBe('El Paso, Texas')
    expect(journeyPlaceLabel('Santa Clara, California')).toBe('Santa Clara, California')
  })

  it('labels a county-style US GEDCOM string', () => {
    expect(journeyPlaceLabel('of Clifford,Susquehanna,Pa')).toBe('Clifford, Pennsylvania')
  })

  it('labels non-US locations reasonably', () => {
    expect(journeyPlaceLabel('Gawsworth, Cheshire, England')).toBe('Gawsworth, Cheshire')
    expect(journeyPlaceLabel('Chihuahua, Chihuahua, Mexico')).toBe('Chihuahua, Chihuahua')
  })
})

describe('resolveJourneyPlace', () => {
  it('resolves Forkston to wyoming-county-pa via canonical path', () => {
    const forkston = resolveJourneyPlace('Forkston, Wyoming, Pennsylvania, United States')
    expect(forkston.label).toBe('Forkston, Pennsylvania')
    expect(forkston.source).toBe('canonical')
    expect(forkston.canonicalPlaceId).toBe('wyoming-county-pa')
    expect(forkston.coordinate.resolved).toBe(true)

    const county = getAtlasPlace('wyoming-county-pa')
    expect(county).not.toBeNull()
    expect(forkston.coordinate.x).toBeCloseTo(county!.x, 1)
    expect(forkston.coordinate.y).toBeCloseTo(county!.y, 1)

    const legacyOnly = resolvePlaceCoordinateLegacy('Forkston, Wyoming, Pennsylvania, United States')
    expect(Math.abs(forkston.coordinate.x - legacyOnly.x)).toBeGreaterThan(0.01)
  })

  it('resolves a normal US city/state through canonical or legacy', () => {
    const elPaso = resolveJourneyPlace('El Paso, Texas, USA')
    expect(elPaso.label).toBe('El Paso, Texas')
    expect(elPaso.coordinate.resolved).toBe(true)
    expect(elPaso.coordinate.region).toBe('United States')
    expect(['canonical', 'legacy']).toContain(elPaso.source)
  })

  it('resolves county-style PA places to county canonical anchors', () => {
    const clifford = resolveJourneyPlace('of Clifford,Susquehanna,Pa')
    expect(clifford.label).toBe('Clifford, Pennsylvania')
    expect(clifford.source).toBe('canonical')
    expect(clifford.canonicalPlaceId).toBe('susquehanna-county-pa')
    expect(clifford.coordinate.resolved).toBe(true)
  })

  it('resolves non-US places without forcing US buckets', () => {
    const cheshire = resolveJourneyPlace('Gawsworth, Cheshire, England')
    expect(cheshire.label).toBe('Gawsworth, Cheshire')
    expect(cheshire.coordinate.resolved).toBe(true)
    expect(cheshire.coordinate.region).toBe('England')
  })

  it('falls back safely for ambiguous places', () => {
    const ny = resolveCanonicalPlaceSync('New York')
    expect(isCanonicalUsableForJourney(ny)).toBe(false)

    const journey = resolveJourneyPlace('New York')
    expect(journey.canonicalPlaceId).toBeNull()
    expect(['legacy', 'unresolved']).toContain(journey.source)
  })

  it('falls back safely for unresolved places', () => {
    const journey = resolveJourneyPlace('Nowhereville, Xyzzy, Zzztopia')
    expect(journey.canonicalPlaceId).toBeNull()
    expect(journey.source).toBe('unresolved')
    expect(journey.coordinate.resolved).toBe(false)
  })
})

describe('resolveJourneyCoordinate', () => {
  it('delegates to canonical-first resolution', () => {
    const coord = resolveJourneyCoordinate('Forkston, Wyoming, Pennsylvania, United States')
    const place = resolveJourneyPlace('Forkston, Wyoming, Pennsylvania, United States')
    expect(coord).toEqual(place.coordinate)
  })
})
