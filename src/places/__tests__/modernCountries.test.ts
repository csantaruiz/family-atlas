import { beforeEach, describe, expect, it } from 'vitest'
import { resolveCanonicalPlaceSync } from '../resolveCanonicalPlace'
import { normalizePlace } from '../normalizePlace'
import { getAtlasPlace } from '../registry/atlasPlaceRegistry'
import { selectCustomerReviews } from '../../atlas-review/selectCustomerReviews'
import { memoryOverrideStore } from '../../overrides/memoryStore'
import {
  cacheUpsert,
  hydrateOverrideCache,
  setOverrideAtlasId,
} from '../../overrides/overrideCache'
import { placeEntityKey, placeSourceSignature } from '../../overrides/identity'

describe('Phase 2C.1 modern country foundation', () => {
  it('resolves Iceland as a country, not as an unknown locality', () => {
    const parsed = normalizePlace('Iceland')
    expect(parsed.components.country).toBe('Iceland')
    expect(parsed.components.locality).toBeNull()
    const resolution = resolveCanonicalPlaceSync('Iceland')
    expect(['coarse', 'resolved']).toContain(resolution.status)
    expect(resolution.canonicalPlaceId).toBe('iceland')
    expect(resolution.precision).toBe('country')
    expect(getAtlasPlace('iceland')?.hierarchy.country).toBe('Iceland')
    expect(getAtlasPlace('iceland')?.hierarchy.locality).toBeUndefined()
  })

  it('resolves Belgium, Greece, and Austria as countries', () => {
    expect(resolveCanonicalPlaceSync('Belgium').canonicalPlaceId).toBe('belgium')
    expect(resolveCanonicalPlaceSync('Greece').canonicalPlaceId).toBe('greece')
    expect(resolveCanonicalPlaceSync('Austria').canonicalPlaceId).toBe('austria')
  })

  it('maps Espagne to Spain as a language alias, without inventing a locality', () => {
    const resolution = resolveCanonicalPlaceSync('Espagne')
    expect(resolution.canonicalPlaceId).toBe('spain')
    expect(resolution.precision).toBe('country')
  })

  it('does not discard an unmatched locality just because the country is now known', () => {
    const salonika = resolveCanonicalPlaceSync('Salonika, Greece')
    expect(salonika.status).toBe('unresolved')
    expect(salonika.canonicalPlaceId).toBeNull()
    expect(normalizePlace('Salonika, Greece').components.country).toBe('Greece')
    expect(normalizePlace('Salonika, Greece').components.locality).toBeTruthy()

    const rode = resolveCanonicalPlaceSync('Rode, Brabant Wallon, Belgium')
    expect(rode.status).toBe('unresolved')
    expect(rode.canonicalPlaceId).toBeNull()

    const castile = resolveCanonicalPlaceSync('Reinos de Castilla, Espagne')
    expect(castile.status).toBe('unresolved')
    expect(castile.canonicalPlaceId).not.toBe('spain')
  })

  it('keeps unmatched locality+country strings in Atlas Review', () => {
    const queue = selectCustomerReviews()
    expect(queue.some((item) => item.originals.includes('Salonika, Greece'))).toBe(true)
    expect(queue.some((item) => item.originals.includes('Rode, Brabant Wallon, Belgium'))).toBe(true)
    expect(queue.some((item) => item.originals.includes('Reinos de Castilla, Espagne'))).toBe(true)
    expect(queue.some((item) => item.originals.some((s) => s.trim() === 'Iceland'))).toBe(false)
  })

  it('preserves New York source-precision behavior', () => {
    expect(resolveCanonicalPlaceSync('New York').canonicalPlaceId).toBe('new-york-state')
    expect(resolveCanonicalPlaceSync('New York, New York').canonicalPlaceId).toBe('new-york-city')
  })

  it('keeps Medord as a locality identity case, not a country coarsen', () => {
    const resolution = resolveCanonicalPlaceSync('Medord, Oregon, USA')
    expect(resolution.status).toBe('ambiguous')
    expect(resolution.alternatives.some((alt) => alt.canonicalPlaceId === 'medford-or')).toBe(true)
  })

  it('does not force-match unknown junk to a country', () => {
    const resolution = resolveCanonicalPlaceSync('Anderr')
    expect(resolution.status).toBe('unresolved')
    expect(resolution.canonicalPlaceId).toBeNull()
  })
})

describe('Phase 2C.1 overrides still win', () => {
  beforeEach(() => {
    memoryOverrideStore.clear()
    setOverrideAtlasId('test-atlas')
    hydrateOverrideCache('test-atlas', [])
  })

  it('keeps a human-confirmed Iceland override', () => {
    const fp = placeEntityKey('Iceland')
    cacheUpsert({
      entityType: 'place',
      entityKey: fp,
      overrideType: 'confirm_resolution',
      sourceSignature: placeSourceSignature('Iceland', 'iceland'),
      payload: {
        fingerprint: fp,
        originalExamples: ['Iceland'],
        canonicalPlaceId: 'iceland',
        selectionProvenance: 'canonical_selection',
        autoCanonicalPlaceId: 'iceland',
      },
    })
    const confirmed = resolveCanonicalPlaceSync('Iceland')
    expect(confirmed.canonicalPlaceId).toBe('iceland')
    expect(confirmed.humanOverride.kind).toBe('confirmed')
    expect(confirmed.original).toBe('Iceland')
  })
})
