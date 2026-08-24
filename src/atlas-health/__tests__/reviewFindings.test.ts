import { describe, expect, it, beforeEach } from 'vitest'
import { memoryOverrideStore } from '../../overrides/memoryStore'
import { hydrateOverrideCache, setOverrideAtlasId } from '../../overrides/overrideCache'
import { placeEntityKey } from '../../overrides/identity'
import {
  buildPlainFindingCopy,
  buildReviewQueue,
  diagnosticEntityKey,
  isPriorityFindingHandled,
  reviewFindingKey,
} from '../dev/reviewFindingsModel'
import { runAtlasHealthCheck } from '../healthCheck'
import type { AtlasOverrideRecord } from '../../overrides/types'

function seedPlaceConfirm(original: string, canonicalPlaceId: string) {
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
      canonicalPlaceId,
      selectionProvenance: 'canonical_selection',
    },
    status: 'active',
    reviewState: 'confirmed',
    source: 'test',
    matchConfidence: 'exact',
    sourceSignature: null,
    notes: null,
    createdBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  hydrateOverrideCache('test-atlas', [row])
}

function seedIgnore(original: string, category: string) {
  const key = diagnosticEntityKey(original, category as 'GEOGRAPHIC_CONFLICT')
  const row: AtlasOverrideRecord = {
    id: `diag-${key}`,
    atlasId: 'test-atlas',
    entityType: 'diagnostic',
    entityKey: key,
    overrideType: 'disposition',
    payload: {
      category,
      disposition: 'ignored',
      originalRef: original,
    },
    status: 'active',
    reviewState: 'ignored',
    source: 'test',
    matchConfidence: 'exact',
    sourceSignature: null,
    notes: null,
    createdBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  hydrateOverrideCache('test-atlas', [row])
}

describe('DEV Review Findings model', () => {
  beforeEach(() => {
    memoryOverrideStore.clear()
    setOverrideAtlasId('test-atlas')
    hydrateOverrideCache('test-atlas', [])
  })

  it('builds a queue of conflict + gap findings only', () => {
    const report = runAtlasHealthCheck()
    const queue = buildReviewQueue(report)
    expect(queue.length).toBeGreaterThan(0)
    expect(queue.every((f) => f.category === 'GEOGRAPHIC_CONFLICT' || f.category === 'RESOLUTION_GAP')).toBe(
      true,
    )
    const firstConflict = queue.findIndex((f) => f.category === 'GEOGRAPHIC_CONFLICT')
    const firstGap = queue.findIndex((f) => f.category === 'RESOLUTION_GAP')
    if (firstConflict >= 0 && firstGap >= 0) {
      expect(firstConflict).toBeLessThan(firstGap)
    }
  })

  it('drops findings after place Confirm in cache', () => {
    const report = runAtlasHealthCheck()
    const target = report.priorityPlaces.find((p) => p.category === 'GEOGRAPHIC_CONFLICT')
    expect(target).toBeTruthy()
    seedPlaceConfirm(target!.original, 'gloucester-city')
    expect(isPriorityFindingHandled(target!)).toBe(true)
    const queue = buildReviewQueue(report)
    expect(queue.some((f) => f.original === target!.original)).toBe(false)
  })

  it('drops findings after Ignore disposition in cache', () => {
    const report = runAtlasHealthCheck()
    const target = report.priorityPlaces.find((p) => p.category === 'GEOGRAPHIC_CONFLICT')
    expect(target).toBeTruthy()
    seedIgnore(target!.original, target!.category)
    expect(isPriorityFindingHandled(target!)).toBe(true)
    expect(buildReviewQueue(report).some((f) => f.original === target!.original)).toBe(false)
  })

  it('plain copy recommends unified place when available', () => {
    const report = runAtlasHealthCheck()
    const gloucester = report.priorityPlaces.find((p) =>
      p.original.includes('Gloucester, Camden, New Jersey'),
    )
    expect(gloucester).toBeTruthy()
    const copy = buildPlainFindingCopy(gloucester!)
    expect(copy.canConfirm).toBe(true)
    expect(copy.recommendedCanonicalPlaceId).toBe('gloucester-city')
    expect(copy.whatMayBeWrong.toLowerCase()).toContain('disagree')
  })

  it('reviewFindingKey distinguishes same category different strings', () => {
    const a = {
      original: 'Gloucester City Ward 2, Camden, New Jersey',
      category: 'GEOGRAPHIC_CONFLICT' as const,
      summary: 'x',
      explorePrecision: 'state/region' as const,
      documentaryPrecision: 'state/region' as const,
    }
    const b = {
      ...a,
      original: 'Gloucester, Camden, New Jersey',
    }
    expect(reviewFindingKey(a)).not.toBe(reviewFindingKey(b))
  })
})
