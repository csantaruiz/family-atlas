import { describe, expect, it } from 'vitest'
import { resolveCanonicalPlaceSync } from '../resolveCanonicalPlace'
import { unifiedMacroGeography } from '../unifiedLegacyComparison'

type FixtureExpectation =
  | 'auto-corrected'
  | 'coarse'
  | 'ambiguous'
  | 'unresolved'

type Fixture = {
  place: string
  expectation: FixtureExpectation
  macro: 'us' | 'mexico' | 'europe' | 'other'
  /** When set, unified must resolve to this canonical id (or be ambiguous with it as alternative). */
  canonicalId?: string
  /** Canonical ids that must not be chosen (e.g. california for Jacksonville FL). */
  forbidCanonicalIds?: string[]
}

const PRIORITY_FIXTURES: Fixture[] = [
  // Geographic conflicts (10)
  { place: 'Gloucester, Camden, New Jersey', expectation: 'auto-corrected', macro: 'us', canonicalId: 'gloucester-city' },
  { place: 'Gloucester, Camden, New Jersey, USA', expectation: 'auto-corrected', macro: 'us', canonicalId: 'gloucester-city' },
  { place: 'Gloucester, New Jersey, USA', expectation: 'auto-corrected', macro: 'us', canonicalId: 'gloucester-city', forbidCanonicalIds: ['england'] },
  { place: 'Gloucester City, New Jersey, USA', expectation: 'auto-corrected', macro: 'us', canonicalId: 'gloucester-city' },
  { place: 'Gloucester City, Camden, New Jersey, United States', expectation: 'auto-corrected', macro: 'us', canonicalId: 'gloucester-city' },
  { place: 'Gloucester City Ward 1, Camden, New Jersey', expectation: 'auto-corrected', macro: 'us', canonicalId: 'gloucester-city' },
  { place: 'Jacksonville, St Johns, Florida, United States', expectation: 'auto-corrected', macro: 'us', canonicalId: 'jacksonville-fl', forbidCanonicalIds: ['california'] },
  {
    place: 'San Jose del Parral, Nueva Vizcaya, Nueva Espana (Hidalgo del Parral, Chihuahua, Mexico)',
    expectation: 'auto-corrected',
    macro: 'mexico',
    canonicalId: 'hidalgo-del-parral',
    forbidCanonicalIds: ['california', 'santa-clara'],
  },
  {
    place: 'San Jose, Hidalgo Del Parral, Chihuahua, Mexique',
    expectation: 'auto-corrected',
    macro: 'mexico',
    canonicalId: 'hidalgo-del-parral',
    forbidCanonicalIds: ['california', 'santa-clara'],
  },
  { place: 'United States of America', expectation: 'coarse', macro: 'us', canonicalId: 'united-states' },

  // Resolution gaps (16)
  { place: ', , Virginia, USA', expectation: 'coarse', macro: 'us', canonicalId: 'virginia' },
  { place: ', , West Virginia, USA', expectation: 'coarse', macro: 'us', canonicalId: 'west-virginia' },
  { place: ', Hampshire, Massachusetts, USA', expectation: 'coarse', macro: 'us' },
  { place: ', Knox, Missouri, USA', expectation: 'coarse', macro: 'us' },
  { place: 'Anahiem, Ca USA', expectation: 'auto-corrected', macro: 'us', canonicalId: 'anaheim-ca' },
  { place: 'Anahiem, CA USA', expectation: 'auto-corrected', macro: 'us', canonicalId: 'anaheim-ca' },
  {
    place: 'Bostock House, in Little Hassall, parish of Sandbach, County of',
    expectation: 'coarse',
    macro: 'europe',
    canonicalId: 'cheshire',
  },
  { place: 'Glou. City, N.j.', expectation: 'auto-corrected', macro: 'us', canonicalId: 'gloucester-city' },
  { place: 'Hampshire, , Virginia, USA', expectation: 'coarse', macro: 'us' },
  { place: 'Ireland', expectation: 'coarse', macro: 'europe', canonicalId: 'ireland' },
  { place: 'Ledyard, New London, Connecticut, USA', expectation: 'auto-corrected', macro: 'us', canonicalId: 'ledyard-ct', forbidCanonicalIds: ['england'] },
  { place: 'Medord, Oregon, USA', expectation: 'ambiguous', macro: 'us' },
  { place: 'New York', expectation: 'ambiguous', macro: 'us' },
  { place: 'of Clifford,Susquehanna,Pa', expectation: 'coarse', macro: 'us', canonicalId: 'susquehanna-county-pa' },
  { place: 'of Forkston,Wyoming,Pa', expectation: 'coarse', macro: 'us', canonicalId: 'wyoming-county-pa' },
  { place: 'San Antonio, TX, USA', expectation: 'auto-corrected', macro: 'us', canonicalId: 'san-antonio-tx' },
]

function assertFixture(fixture: Fixture): void {
  const resolution = resolveCanonicalPlaceSync(fixture.place)
  const macro = unifiedMacroGeography(resolution)

  if (fixture.forbidCanonicalIds) {
    for (const forbidden of fixture.forbidCanonicalIds) {
      expect(resolution.canonicalPlaceId, `${fixture.place} must not resolve to ${forbidden}`).not.toBe(
        forbidden,
      )
    }
  }

  switch (fixture.expectation) {
    case 'auto-corrected':
      expect(resolution.status, fixture.place).toBe('resolved')
      expect(macro, fixture.place).toBe(fixture.macro)
      if (fixture.canonicalId) {
        expect(resolution.canonicalPlaceId, fixture.place).toBe(fixture.canonicalId)
      }
      break
    case 'coarse':
      expect(['coarse', 'resolved'], fixture.place).toContain(resolution.status)
      expect(macro, fixture.place).toBe(fixture.macro)
      if (fixture.canonicalId) {
        expect(resolution.canonicalPlaceId, fixture.place).toBe(fixture.canonicalId)
      }
      expect(resolution.precision, fixture.place).not.toBe('locality')
      break
    case 'ambiguous':
      expect(resolution.status, fixture.place).toBe('ambiguous')
      expect(resolution.canonicalPlaceId, fixture.place).toBeNull()
      break
    case 'unresolved':
      expect(resolution.status, fixture.place).toBe('unresolved')
      break
    default:
      break
  }

  // Never falsely pin California for Mexico-context San Jose cases.
  if (/san jose/i.test(fixture.place) && /chihuahua|mexique|mexico|parral|nueva/i.test(fixture.place)) {
    expect(resolution.canonicalPlaceId, fixture.place).not.toBe('california')
    expect(resolution.canonicalPlaceId, fixture.place).not.toBe('santa-clara')
  }

  // Never pin England for NJ Gloucester cases.
  if (/gloucester/i.test(fixture.place) && /new jersey|camden|n\.j/i.test(fixture.place)) {
    expect(macro, fixture.place).toBe('us')
    expect(resolution.canonicalPlaceId, fixture.place).not.toBe('england')
  }
}

describe('Phase 1 priority place fixtures (26)', () => {
  it.each(PRIORITY_FIXTURES.map((fixture) => [fixture.place, fixture] as const))(
    '%s',
    (_label, fixture) => {
      assertFixture(fixture)
    },
  )

  it('passes all 26 fixtures', () => {
    let passed = 0
    for (const fixture of PRIORITY_FIXTURES) {
      try {
        assertFixture(fixture)
        passed += 1
      } catch {
        // counted by individual tests
      }
    }
    expect(PRIORITY_FIXTURES.length).toBe(26)
    expect(passed).toBe(26)
  })
})

export { PRIORITY_FIXTURES, assertFixture }
