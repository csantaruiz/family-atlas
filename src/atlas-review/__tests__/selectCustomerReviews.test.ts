import { describe, expect, it, beforeEach } from 'vitest'
import { memoryOverrideStore } from '../../overrides/memoryStore'
import { hydrateOverrideCache, setOverrideAtlasId } from '../../overrides/overrideCache'
import { placeEntityKey } from '../../overrides/identity'
import { runAtlasHealthCheck } from '../../atlas-health/healthCheck'
import { buildPlaceResolutionRecord } from '../../atlas-health/placeResolution'
import {
  customerDiagnosticKey,
  isCustomerOriginalHandled,
  selectCustomerReviews,
  unifiedAlreadyHandles,
} from '../selectCustomerReviews'
import type { AtlasOverrideRecord } from '../../overrides/types'

describe('customer Atlas Review queue', () => {
  beforeEach(() => {
    memoryOverrideStore.clear()
    setOverrideAtlasId('test-atlas')
    hydrateOverrideCache('test-atlas', [])
  })

  it('hides Gloucester-style conflicts Unified already corrected confidently', () => {
    const report = runAtlasHealthCheck()
    const gloucester = report.priorityPlaces.filter((row) =>
      /gloucester/i.test(row.original),
    )
    expect(gloucester.length).toBeGreaterThan(0)

    for (const row of gloucester) {
      const record = buildPlaceResolutionRecord(row.original)
      expect(unifiedAlreadyHandles(record)).toBe(true)
    }

    const queue = selectCustomerReviews()
    expect(queue.some((item) => item.originals.some((s) => /gloucester/i.test(s)))).toBe(false)
  })

  it('does not add alias or placeholder name findings to the customer queue', () => {
    const queue = selectCustomerReviews()
    expect(JSON.stringify(queue)).not.toMatch(/name_alias_conflict|name_placeholder/)
  })

  it('includes the Salvador* unusual-character name card', () => {
    const names = selectCustomerReviews().filter((item) => item.domain === 'name')
    expect(names).toHaveLength(1)
    expect(names[0]?.personName).toMatch(/salvador/i)
    expect(names[0]?.findingCode).toBe('name_import_garbage')
    expect(names[0]?.suggestedName).toMatch(/salvador pinon vernal/i)
    expect(names[0]?.suggestedName).not.toMatch(/\*/)
  })

  it('includes only the Nellie Whipple date contradiction as a two-sided conflict', () => {
    const dates = selectCustomerReviews().filter((item) => item.domain === 'date')
    expect(dates).toHaveLength(1)
    const item = dates[0]
    expect(item?.personName).toMatch(/nellie b\.? whipple/i)
    expect(item?.findingCode).toBe('date_child_after_parent_death')
    expect(item?.dateShape).toBe('conflict')
    expect(item?.dateSides).toHaveLength(2)
    expect(item?.dateSides?.[0]?.field).toBe('birth')
    expect(item?.dateSides?.[1]?.field).toBe('death')
    expect(item?.dateSides?.[1]?.personName).toMatch(/phebe doll/i)
    expect(item?.dateSides?.[1]?.roleLabel).toMatch(/mother/i)
    expect(item?.conflictSummary).toMatch(/nellie/i)
    expect(item?.conflictSummary).toMatch(/mother/i)
  })

  it('does not surface precision or confidence-only findings', () => {
    const queue = selectCustomerReviews()
    expect(
      queue.every(
        (item) =>
          item.healthCategory === 'GEOGRAPHIC_CONFLICT' ||
          item.healthCategory === 'RESOLUTION_GAP' ||
          item.healthCategory === 'ATLAS_REVIEW',
      ),
    ).toBe(true)
  })

  it('does not send bare New York to Atlas Review as a city-vs-state choice', () => {
    const queue = selectCustomerReviews()
    expect(queue.some((item) => item.originals.some((s) => s.trim() === 'New York'))).toBe(false)
  })

  it('snapshots remaining customer-review originals', () => {
    const queue = selectCustomerReviews().filter((item) => item.domain === 'place')
    expect(
      queue.map((item) => ({
        original: item.primaryOriginal,
        kind: item.kind,
        recommended: item.recommendedCanonicalPlaceId,
      })),
    ).toMatchInlineSnapshot(`
      [
        {
          "kind": "ambiguous",
          "original": "Medord, Oregon, USA",
          "recommended": "medford-or",
        },
        {
          "kind": "unresolved",
          "original": "Anderr",
          "recommended": null,
        },
        {
          "kind": "unresolved",
          "original": "Minshull",
          "recommended": null,
        },
        {
          "kind": "unresolved",
          "original": "Not, Graz-Umgebung, Styria, Austria",
          "recommended": null,
        },
        {
          "kind": "unresolved",
          "original": "Reinos de Castilla, Espagne",
          "recommended": null,
        },
        {
          "kind": "unresolved",
          "original": "Rode, Brabant Wallon, Belgium",
          "recommended": null,
        },
        {
          "kind": "unresolved",
          "original": "Salonika, Greece",
          "recommended": null,
        },
      ]
    `)
  })

  it('keeps Medord as a locality spelling/identity review', () => {
    const queue = selectCustomerReviews()
    const medord = queue.find((item) => item.originals.some((s) => /medord/i.test(s)))
    expect(medord).toBeTruthy()
    expect(medord!.kind).toBe('ambiguous')
    expect(medord!.alternatives.length + (medord!.recommendedCanonicalPlaceId ? 1 : 0)).toBeGreaterThan(0)
  })

  it('shows Medord as the full Medford, Oregon hierarchy, not a bare city name', () => {
    const queue = selectCustomerReviews()
    const medord = queue.find((item) => item.originals.some((s) => /medord/i.test(s)))
    expect(medord).toBeTruthy()
    expect(medord!.familyWording).toMatch(/Medord/i)
    expect(medord!.recommendedCanonicalPlaceId).toBe('medford-or')
    expect(medord!.recommendedLabel).toBe('Medford, Oregon, United States')
    expect(medord!.recommendedLabel).not.toBe('Medford')
    expect(medord!.latitude).toBeCloseTo(42.3265, 3)
    expect(medord!.longitude).toBeCloseTo(-122.8756, 3)
  })

  it('drops an item after a customer ignore disposition is cached', () => {
    const queue = selectCustomerReviews()
    expect(queue.length).toBeGreaterThan(0)
    const target = queue[0]
    const original = target.primaryOriginal
    const key = customerDiagnosticKey(original)
    const row: AtlasOverrideRecord = {
      id: `diag-${key}`,
      atlasId: 'test-atlas',
      entityType: 'diagnostic',
      entityKey: key,
      overrideType: 'disposition',
      payload: {
        category: 'ATLAS_REVIEW',
        disposition: 'ignored',
        originalRef: original,
      },
      status: 'active',
      reviewState: 'ignored',
      source: 'atlas-review',
      matchConfidence: 'exact',
      sourceSignature: null,
      notes: null,
      createdBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    hydrateOverrideCache('test-atlas', [row])
    expect(isCustomerOriginalHandled(original)).toBe(true)
    expect(selectCustomerReviews().some((item) => item.originals.includes(original))).toBe(false)
  })

  it('drops an item after a place confirmation is cached', () => {
    const queue = selectCustomerReviews().filter((item) => item.recommendedCanonicalPlaceId)
    if (queue.length === 0) return
    const target = queue[0]
    const original = target.primaryOriginal
    const fp = placeEntityKey(original)
    const row: AtlasOverrideRecord = {
      id: `ov-${fp}`,
      atlasId: 'test-atlas',
      entityType: 'place',
      entityKey: fp,
      overrideType: 'confirm_resolution',
      payload: {
        fingerprint: fp,
        originalExamples: [original],
        canonicalPlaceId: target.recommendedCanonicalPlaceId!,
        selectionProvenance: 'canonical_selection',
      },
      status: 'active',
      reviewState: 'confirmed',
      source: 'atlas-review',
      matchConfidence: 'exact',
      sourceSignature: null,
      notes: null,
      createdBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    hydrateOverrideCache('test-atlas', [row])
    expect(selectCustomerReviews().some((item) => item.originals.includes(original))).toBe(false)
  })
})
