import { beforeEach, describe, expect, it } from 'vitest'
import { resolveCanonicalPlaceSync } from '../../places/resolveCanonicalPlace'
import { resolveJourneyCoordinate, resolveJourneyPlace } from '../../utils/lifeJourney/journeyPlace'
import { getAtlasPlace } from '../../places/registry/atlasPlaceRegistry'
import {
  applyEventEligibilityOverrides,
  resolveAtlasEvent,
} from '../applyEventOverrides'
import {
  eventEntityKey,
  eventFingerprint,
  placeEntityKey,
  placeSourceSignature,
  rebindOverride,
} from '../identity'
import { memoryOverrideStore } from '../memoryStore'
import {
  cacheUpsert,
  getCachedPlaceOverride,
  hydrateOverrideCache,
  setOverrideAtlasId,
} from '../overrideCache'
import { resolveAtlasPlace } from '../resolveAtlasPlace'
import type { FamilyEvent } from '../../types'
import type { AtlasOverrideRecord } from '../types'

const ATLAS_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const ATLAS_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

const FORKSTON = 'Forkston, Wyoming, Pennsylvania, United States'

function sampleEvent(overrides?: Partial<FamilyEvent>): FamilyEvent {
  return {
    kind: 'birth',
    year: 1850,
    title: 'Test birth',
    detail: FORKSTON,
    person: {
      id: 'I-TEST-1',
      name: 'Test Person',
      birthPlace: FORKSTON,
    },
    importance: 1,
    ...overrides,
  }
}

beforeEach(() => {
  memoryOverrideStore.clear()
  setOverrideAtlasId(ATLAS_A)
  hydrateOverrideCache(ATLAS_A, [])
})

describe('Phase 2B overrides — no override preserves behavior', () => {
  it('place resolution matches automated Journey path when cache empty', () => {
    const atlas = resolveAtlasPlace(FORKSTON)
    const journey = resolveJourneyPlace(FORKSTON)
    expect(atlas.override).toBeNull()
    expect(atlas.coordinate).toEqual(journey.coordinate)
    expect(atlas.label).toBe(journey.label)
  })

  it('resolveCanonicalPlaceSync without override stays automated', () => {
    const a = resolveCanonicalPlaceSync(FORKSTON)
    expect(a.humanOverride.kind).toBe('none')
    expect(a.confidence).not.toBe('CONFIRMED')
  })
})

describe('Phase 2B place overrides', () => {
  it('confirm_resolution wins over automated and records canonical_selection', () => {
    const auto = resolveCanonicalPlaceSync(FORKSTON)
    expect(auto.canonicalPlaceId).toBe('wyoming-county-pa')
    const fp = placeEntityKey(FORKSTON)

    cacheUpsert({
      entityType: 'place',
      entityKey: fp,
      overrideType: 'confirm_resolution',
      sourceSignature: placeSourceSignature(FORKSTON, auto.canonicalPlaceId),
      payload: {
        fingerprint: fp,
        originalExamples: [FORKSTON],
        canonicalPlaceId: 'wyoming-county-pa',
        selectionProvenance: 'canonical_selection',
        autoCanonicalPlaceId: auto.canonicalPlaceId,
      },
    })

    const atlas = resolveAtlasPlace(FORKSTON)
    expect(atlas.source).toBe('override')
    expect(atlas.selectionProvenance).toBe('canonical_selection')
    expect(atlas.confidence).toBe('CONFIRMED')
    expect(atlas.canonicalPlaceId).toBe('wyoming-county-pa')

    const synced = resolveCanonicalPlaceSync(FORKSTON)
    expect(synced.humanOverride.kind).toBe('confirmed')
    expect(synced.confidence).toBe('CONFIRMED')
    expect(synced.provenance.constraintNotes?.join(' ') || synced.method).toBeTruthy()
  })

  it('set_coordinates records manual_coordinates provenance', () => {
    const fp = placeEntityKey(FORKSTON)
    cacheUpsert({
      entityType: 'place',
      entityKey: fp,
      overrideType: 'set_coordinates',
      sourceSignature: placeSourceSignature(FORKSTON, null),
      payload: {
        fingerprint: fp,
        originalExamples: [FORKSTON],
        lat: 41.52,
        lng: -76.015,
        label: 'Forkston (manual pin)',
        selectionProvenance: 'manual_coordinates',
        autoCanonicalPlaceId: null,
      },
    })

    const atlas = resolveAtlasPlace(FORKSTON)
    expect(atlas.selectionProvenance).toBe('manual_coordinates')
    expect(atlas.label).toBe('Forkston (manual pin)')
    expect(atlas.coordinate.resolved).toBe(true)

    const synced = resolveCanonicalPlaceSync(FORKSTON)
    expect(synced.provenance.constraintNotes).toContain('selectionProvenance:manual_coordinates')
  })

  it('reverting override restores automated behavior', () => {
    const fp = placeEntityKey(FORKSTON)
    const before = resolveJourneyCoordinate(FORKSTON)
    const created = cacheUpsert({
      entityType: 'place',
      entityKey: fp,
      overrideType: 'set_coordinates',
      payload: {
        fingerprint: fp,
        originalExamples: [FORKSTON],
        lat: 10,
        lng: 10,
        label: 'Wrong pin',
        selectionProvenance: 'manual_coordinates',
      },
    })
    expect(resolveAtlasPlace(FORKSTON).label).toBe('Wrong pin')

    memoryOverrideStore.revert(ATLAS_A, created.id)
    hydrateOverrideCache(ATLAS_A, memoryOverrideStore.list(ATLAS_A, { status: 'active' }))

    expect(getCachedPlaceOverride(fp)).toBeNull()
    const after = resolveJourneyCoordinate(FORKSTON)
    expect(after).toEqual(before)
  })
})

describe('Phase 2B atlas isolation', () => {
  it('Atlas A overrides cannot affect Atlas B', () => {
    const fp = placeEntityKey(FORKSTON)
    setOverrideAtlasId(ATLAS_A)
    cacheUpsert({
      entityType: 'place',
      entityKey: fp,
      overrideType: 'set_label',
      payload: {
        fingerprint: fp,
        originalExamples: [FORKSTON],
        label: 'Atlas A label',
      },
    })

    setOverrideAtlasId(ATLAS_B)
    hydrateOverrideCache(ATLAS_B, [])
    expect(resolveAtlasPlace(FORKSTON).label).not.toBe('Atlas A label')
  })
})

describe('Phase 2B reimport rebinding', () => {
  it('confirmed correction survives when key and signature match', () => {
    const fp = placeEntityKey(FORKSTON)
    const sig = placeSourceSignature(FORKSTON, 'wyoming-county-pa')
    const override: AtlasOverrideRecord = {
      id: 'ov-1',
      atlasId: ATLAS_A,
      entityType: 'place',
      entityKey: fp,
      overrideType: 'confirm_resolution',
      payload: {
        fingerprint: fp,
        originalExamples: [FORKSTON],
        canonicalPlaceId: 'wyoming-county-pa',
        selectionProvenance: 'canonical_selection',
      },
      status: 'active',
      reviewState: 'confirmed',
      source: 'test',
      matchConfidence: 'exact',
      sourceSignature: sig,
      notes: null,
      createdBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const result = rebindOverride(override, [{ entityKey: fp, sourceSignature: sig }])
    expect(result.nextStatus).toBe('active')
    expect(result.matchConfidence).toBe('exact')
  })

  it('stable key match with material signature change → needs_review (not silent apply)', () => {
    const fp = placeEntityKey(FORKSTON)
    const override: AtlasOverrideRecord = {
      id: 'ov-2',
      atlasId: ATLAS_A,
      entityType: 'place',
      entityKey: fp,
      overrideType: 'confirm_resolution',
      payload: {
        fingerprint: fp,
        originalExamples: [FORKSTON],
        canonicalPlaceId: 'wyoming-county-pa',
        selectionProvenance: 'canonical_selection',
      },
      status: 'active',
      reviewState: null,
      source: 'test',
      matchConfidence: 'exact',
      sourceSignature: placeSourceSignature(FORKSTON, 'wyoming-county-pa'),
      notes: null,
      createdBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const changedSig = placeSourceSignature(FORKSTON, 'pennsylvania')
    const result = rebindOverride(override, [{ entityKey: fp, sourceSignature: changedSig }])
    expect(result.nextStatus).toBe('needs_review')
    expect(result.reason).toMatch(/source signature changed/i)
  })

  it('ambiguous post-reimport match is NOT silently applied', () => {
    const fp = placeEntityKey(FORKSTON)
    const result = rebindOverride(
      {
        id: 'ov-3',
        entityKey: fp,
        sourceSignature: 'sig',
        status: 'active',
      },
      [
        { entityKey: fp, sourceSignature: 'sig' },
        { entityKey: fp, sourceSignature: 'sig-2' },
      ],
    )
    expect(result.nextStatus).toBe('needs_review')
    expect(result.matchConfidence).toBe('ambiguous')
  })
})

describe('Phase 2B event overrides', () => {
  it('suppress removes event from eligibility list deterministically', () => {
    const event = sampleEvent()
    const key = eventEntityKey(event)
    const fp = eventFingerprint(event, 'gedcom-person-vital')
    cacheUpsert({
      entityType: 'event',
      entityKey: key,
      overrideType: 'suppress',
      sourceSignature: fp,
      payload: { eventFingerprint: fp, reason: 'test' },
    })

    const effect = resolveAtlasEvent(event, 'gedcom-person-vital')
    expect(effect.suppressed).toBe(true)

    const filtered = applyEventEligibilityOverrides([event], () => 'gedcom-person-vital')
    expect(filtered).toHaveLength(0)
  })

  it('force_include is eligibility-only and does not imply layout bypass', () => {
    const event = sampleEvent()
    const key = eventEntityKey(event)
    const fp = eventFingerprint(event, 'inferred-move')
    cacheUpsert({
      entityType: 'event',
      entityKey: key,
      overrideType: 'force_include',
      sourceSignature: fp,
      payload: { eventFingerprint: fp, eligibilityOnly: true, reason: 'keep eligible' },
    })

    const effect = resolveAtlasEvent(event, 'inferred-move')
    expect(effect.forceIncludeEligible).toBe(true)
    // Still present in eligibility list; layout pipelines remain responsible for density.
    const filtered = applyEventEligibilityOverrides([event], () => 'inferred-move')
    expect(filtered).toHaveLength(1)
    expect(filtered[0]).toMatchObject({ year: event.year, kind: event.kind })
  })
})

describe('Phase 2B memory store round trip', () => {
  it('upsert + list + revert behaves like API/database round trip', () => {
    setOverrideAtlasId(ATLAS_A)
    const fp = placeEntityKey(FORKSTON)
    const created = memoryOverrideStore.upsert(ATLAS_A, {
      entityType: 'place',
      entityKey: fp,
      overrideType: 'confirm_resolution',
      payload: {
        fingerprint: fp,
        originalExamples: [FORKSTON],
        canonicalPlaceId: 'wyoming-county-pa',
        selectionProvenance: 'canonical_selection',
      },
    })
    expect(memoryOverrideStore.list(ATLAS_A, { status: 'active' })).toHaveLength(1)
    expect(memoryOverrideStore.get(created.id)?.id).toBe(created.id)

    memoryOverrideStore.revert(ATLAS_A, created.id)
    expect(memoryOverrideStore.list(ATLAS_A, { status: 'active' })).toHaveLength(0)
    expect(memoryOverrideStore.get(created.id)?.status).toBe('reverted')
  })
})

describe('Phase 2B geography not worsened', () => {
  it('Forkston still resolves to wyoming-county-pa without override', () => {
    const place = getAtlasPlace('wyoming-county-pa')
    expect(place).not.toBeNull()
    const journey = resolveJourneyPlace(FORKSTON)
    expect(journey.canonicalPlaceId).toBe('wyoming-county-pa')
    expect(journey.coordinate.resolved).toBe(true)
  })
})
