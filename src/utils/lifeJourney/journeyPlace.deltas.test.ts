import { describe, expect, it } from 'vitest'
import { resolvePlaceCoordinateLegacy } from '../../data/placeCoordinates'
import { resolveJourneyPlace } from './journeyPlace'

/** Document Journey places that now pin differently under canonical resolution. */
describe('Journey canonical geography deltas', () => {
  it('Forkston and Clifford PA use county anchors instead of coarse Eastern US', () => {
    for (const place of [
      'Forkston, Wyoming, Pennsylvania, United States',
      'of Clifford,Susquehanna,Pa',
    ]) {
      const journey = resolveJourneyPlace(place)
      const legacy = resolvePlaceCoordinateLegacy(place)
      expect(journey.source).toBe('canonical')
      expect(journey.canonicalPlaceId).toMatch(/-county-pa$/)
      expect(Math.abs(journey.coordinate.x - legacy.x) + Math.abs(journey.coordinate.y - legacy.y)).toBeGreaterThan(
        0.01,
      )
    }
  })

  it('Gloucester NJ can resolve canonically when registry is confident', () => {
    const journey = resolveJourneyPlace('Gloucester City, Camden, New Jersey')
    const legacy = resolvePlaceCoordinateLegacy('Gloucester City, Camden, New Jersey')
    expect(journey.coordinate.resolved).toBe(true)
    expect(journey.coordinate.region).toBe('United States')
    if (journey.source === 'canonical') {
      expect(journey.canonicalPlaceId).toBe('gloucester-city')
      expect(legacy.region).toBe('United States')
    }
  })
})
