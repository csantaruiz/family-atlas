import { describe, expect, it } from 'vitest'
import { familyDatabase } from '../../data/familyDatabase'
import { familyMarriages } from '../../data/familyMarriages'
import { buildPlaceResolutionRecord, collectUniquePlaceStrings } from '../../atlas-health/placeResolution'
import { PRIORITY_FIXTURES, assertFixture } from './phase1Regression.test'

describe('166-place unified shadow parity', () => {
  const places = collectUniquePlaceStrings({
    people: familyDatabase.people,
    marriagePlaces: familyMarriages.map((marriage) => marriage.place),
  })

  it('collects 166 unique place strings from family GEDCOM', () => {
    expect(places.length).toBe(166)
  })

  it('has zero unified regressions against acceptable legacy geography', () => {
    const records = places.map((place) => buildPlaceResolutionRecord(place))
    const regressions = records.filter((r) => r.unifiedComparison.category === 'UNIFIED_REGRESSION')
    expect(regressions).toEqual([])
  })

  it('resolves all 26 priority fixtures correctly', () => {
    for (const fixture of PRIORITY_FIXTURES) {
      assertFixture(fixture)
    }
  })

  it('reports unified status distribution', () => {
    const records = places.map((place) => buildPlaceResolutionRecord(place))
    const distribution = {
      resolved: 0,
      coarse: 0,
      ambiguous: 0,
      unresolved: 0,
      normalizationOnly: 0,
    }
    for (const record of records) {
      switch (record.unified.status) {
        case 'resolved':
          distribution.resolved += 1
          break
        case 'coarse':
          distribution.coarse += 1
          break
        case 'ambiguous':
          distribution.ambiguous += 1
          break
        case 'normalization-only':
          distribution.normalizationOnly += 1
          break
        default:
          distribution.unresolved += 1
          break
      }
    }
    // Sanity: majority of family atlas places should resolve or coarse-resolve.
    expect(distribution.resolved + distribution.coarse).toBeGreaterThan(100)
    expect(distribution.unresolved).toBeLessThan(20)
  })
})
