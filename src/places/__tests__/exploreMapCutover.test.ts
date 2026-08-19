import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  resolveExploreMapCoordinate,
  resolvePlaceCoordinateLegacy,
} from '../../data/placeCoordinates'
import { resolveJourneyCoordinate } from '../../utils/lifeJourney/journeyPlace'
import { mapCoordinateFromUnified } from '../adapters/exploreMapCoordinate'
import { resolveCanonicalPlaceSync } from '../resolveCanonicalPlace'

const mockUnifiedFlag = vi.hoisted(() => vi.fn(() => false))

vi.mock('../featureFlag', () => ({
  isUnifiedPlacesEnabled: mockUnifiedFlag,
}))

describe('Phase 2A.2 Explore/Map cutover', () => {
  beforeEach(() => {
    mockUnifiedFlag.mockReturnValue(false)
  })

  afterEach(() => {
    mockUnifiedFlag.mockReset()
    mockUnifiedFlag.mockReturnValue(false)
  })

  it('resolveExploreMapCoordinate matches legacy when unified flag is off', () => {
    const samples = [
      'El Paso, Texas, USA',
      'Gawsworth, Cheshire, England',
      'Chihuahua, Chihuahua, Mexico',
      'Gloucester, Camden, New Jersey, USA',
      'San Jose, Hidalgo Del Parral, Chihuahua, Mexique',
      'Jacksonville, St Johns, Florida, United States',
    ]
    for (const place of samples) {
      expect(resolveExploreMapCoordinate(place)).toEqual(resolvePlaceCoordinateLegacy(place))
    }
  })

  it('resolveExploreMapCoordinate uses unified when flag is on', () => {
    mockUnifiedFlag.mockReturnValue(true)
    const place = 'San Jose, Hidalgo Del Parral, Chihuahua, Mexique'
    const legacy = resolvePlaceCoordinateLegacy(place)
    const map = resolveExploreMapCoordinate(place)
    const unified = mapCoordinateFromUnified(resolveCanonicalPlaceSync(place))

    expect(map).toEqual(unified)
    expect(legacy.region).toBe('United States')
    expect(map.region).toBe('Mexico')
    expect(map.resolved).toBe(true)
  })

  it('resolveJourneyCoordinate ignores unified flag (always legacy path)', () => {
    const place = 'El Paso, Texas, USA'
    mockUnifiedFlag.mockReturnValue(false)
    const withFlagOff = resolveJourneyCoordinate(place)

    mockUnifiedFlag.mockReturnValue(true)
    const withFlagOn = resolveJourneyCoordinate(place)

    expect(withFlagOn).toEqual(withFlagOff)
    expect(withFlagOn.resolved).toBe(true)
    expect(withFlagOn.region).toBe('United States')
  })

  it('unified map cutover corrects Gloucester NJ away from England', () => {
    mockUnifiedFlag.mockReturnValue(true)
    const place = 'Gloucester, New Jersey, USA'
    const legacy = resolvePlaceCoordinateLegacy(place)
    const map = resolveExploreMapCoordinate(place)

    expect(legacy.region).toBe('England')
    expect(map.region).toBe('United States')
    expect(map.resolved).toBe(true)
  })

  it('unified map cutover localizes Jacksonville FL beyond legacy coarse US anchor', () => {
    mockUnifiedFlag.mockReturnValue(true)
    const place = 'Jacksonville, St Johns, Florida, United States'
    const legacy = resolvePlaceCoordinateLegacy(place)
    const map = resolveExploreMapCoordinate(place)

    expect(legacy.region).toBe('United States')
    expect(map.region).toBe('United States')
    expect(map.displayRegion).toBe('Eastern United States')
    expect(map.resolved).toBe(true)
    expect(Math.abs(map.x - legacy.x) + Math.abs(map.y - legacy.y)).toBeGreaterThan(2)
  })
})
