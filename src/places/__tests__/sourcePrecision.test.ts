import { beforeEach, describe, expect, it } from 'vitest'
import { resolveCanonicalPlaceSync } from '../resolveCanonicalPlace'
import { normalizePlace } from '../normalizePlace'
import type { ParsedPlaceComponents } from '../types'
import {
  collapsePlaceIdsToSourcePrecision,
  isNestedFinerPlace,
  sourcePrecisionFromComponents,
} from '../sourcePrecision'
import { getAtlasPlace } from '../registry/atlasPlaceRegistry'
import { memoryOverrideStore } from '../../overrides/memoryStore'
import {
  cacheUpsert,
  hydrateOverrideCache,
  setOverrideAtlasId,
} from '../../overrides/overrideCache'
import { placeEntityKey, placeSourceSignature } from '../../overrides/identity'

function componentsOf(original: string): ParsedPlaceComponents {
  return normalizePlace(original).components
}

describe('source precision vs nested hierarchy', () => {
  it('treats bare New York as state-level evidence, not a locality', () => {
    const components = componentsOf('New York')
    expect(components.locality).toBeNull()
    expect(components.admin1).toBe('New York')
    expect(components.country).toBe('United States')
    expect(sourcePrecisionFromComponents(components)).toBe('state')
  })

  it('knows New York City is nested under New York State', () => {
    const city = getAtlasPlace('new-york-city')
    const state = getAtlasPlace('new-york-state')
    expect(city).toBeTruthy()
    expect(state).toBeTruthy()
    expect(isNestedFinerPlace(city!, state!)).toBe(true)
    expect(isNestedFinerPlace(state!, city!)).toBe(false)
  })

  it('collapses city+state candidates to the state when the source is state-precision', () => {
    const ids = collapsePlaceIdsToSourcePrecision(
      ['new-york-city', 'new-york-state'],
      componentsOf('New York'),
    )
    expect(ids).toEqual(['new-york-state'])
  })

  it('keeps genuine same-depth identity ambiguity', () => {
    const ids = collapsePlaceIdsToSourcePrecision(
      ['medford-or', 'hidalgo-del-parral'],
      {
        parts: ['Springfield'],
        locality: 'Springfield',
        admin2: null,
        admin1: null,
        country: null,
        historicalEntity: null,
        parseQuality: 'partial',
        parseNotes: [],
      },
    )
    expect(ids.sort()).toEqual(['hidalgo-del-parral', 'medford-or'].sort())
  })

  it('resolves bare New York to New York State, not New York City', () => {
    const resolution = resolveCanonicalPlaceSync('New York')
    expect(resolution.status).toBe('coarse')
    expect(resolution.canonicalPlaceId).toBe('new-york-state')
    expect(resolution.precision).not.toBe('locality')
    expect(resolution.alternatives).toEqual([])
    expect(resolution.original).toBe('New York')
  })

  it('resolves New York, USA to the state', () => {
    const resolution = resolveCanonicalPlaceSync('New York, USA')
    expect(resolution.canonicalPlaceId).toBe('new-york-state')
    expect(resolution.precision).not.toBe('locality')
  })

  it('keeps city precision when the source actually names the city', () => {
    const city = resolveCanonicalPlaceSync('New York, New York')
    expect(city.canonicalPlaceId).toBe('new-york-city')
    const cityUsa = resolveCanonicalPlaceSync('New York, New York, USA')
    expect(cityUsa.canonicalPlaceId).toBe('new-york-city')
  })

  it('does not over-precision a state record into a child locality that shares the name', () => {
    const resolution = resolveCanonicalPlaceSync('New York')
    expect(resolution.canonicalPlaceId).not.toBe('new-york-city')
  })
})

describe('human override still outranks source-precision capping', () => {
  beforeEach(() => {
    memoryOverrideStore.clear()
    setOverrideAtlasId('test-atlas')
    hydrateOverrideCache('test-atlas', [])
  })

  it('keeps a confirmed city reading for bare New York', () => {
    const auto = resolveCanonicalPlaceSync('New York')
    expect(auto.canonicalPlaceId).toBe('new-york-state')
    const fp = placeEntityKey('New York')
    cacheUpsert({
      entityType: 'place',
      entityKey: fp,
      overrideType: 'confirm_resolution',
      sourceSignature: placeSourceSignature('New York', 'new-york-city'),
      payload: {
        fingerprint: fp,
        originalExamples: ['New York'],
        canonicalPlaceId: 'new-york-city',
        selectionProvenance: 'canonical_selection',
        autoCanonicalPlaceId: auto.canonicalPlaceId,
      },
    })
    const confirmed = resolveCanonicalPlaceSync('New York')
    expect(confirmed.canonicalPlaceId).toBe('new-york-city')
    expect(confirmed.humanOverride.kind).toBe('confirmed')
    expect(confirmed.original).toBe('New York')
  })
})
