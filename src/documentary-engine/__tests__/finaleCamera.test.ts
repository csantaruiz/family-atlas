import { describe, expect, it, beforeEach } from 'vitest'
import { ATLAS_ESTABLISHING_CAMERA } from '../core/cameraFraming'
import { resolveDocumentaryFrame, clearSceneStartCache } from '../core/cameraDirector'
import { clearDisplayRevealRegistryForTests } from '../core/displayRevealRegistry'
import {
  applyFinaleCameraPolicy,
  CLOSING_STAGE_START_MS,
  clearFinaleCameraCache,
  finalePanDamping,
  finaleProgress,
  isFinaleThird,
} from '../core/finaleCameraPolicy'
import { FINALE_WORLD_CAMERA } from '../core/finaleHighlightDirector'
import { clearScriptMentionCacheForTests, resolveLateAddedPlaceIds } from '../core/scriptMentionDirector'
import { DOCUMENTARY_MANIFEST } from '../data/documentaryManifest'
import { finalizeManifest } from '../utils/migrationPaths'
import { AUDIO_ANALYZED_DURATION_MS } from '../core/audioSyncDirector'

const DURATION_MS = AUDIO_ANALYZED_DURATION_MS

describe('finale camera policy', () => {
  beforeEach(() => {
    clearDisplayRevealRegistryForTests()
    clearSceneStartCache()
    clearFinaleCameraCache()
    clearScriptMentionCacheForTests()
  })

  it('activates at Convergence to frame the full-circle story', () => {
    expect(isFinaleThird(CLOSING_STAGE_START_MS - 1_000, DURATION_MS)).toBe(false)
    expect(isFinaleThird(CLOSING_STAGE_START_MS, DURATION_MS)).toBe(true)
    expect(isFinaleThird(226_000, DURATION_MS)).toBe(true)
    expect(finaleProgress(226_000, DURATION_MS)).toBeCloseTo(0.38, 1)
  })

  it('dampens panning before the closing pull-back', () => {
    expect(finalePanDamping(180_000, DURATION_MS)).toBe(1)
    expect(finalePanDamping(204_000, DURATION_MS)).toBeLessThan(0.6)
    expect(finalePanDamping(CLOSING_STAGE_START_MS, DURATION_MS)).toBeLessThan(0.2)
  })

  it('pulls back during Convergence instead of staying on the last branch', () => {
    clearSceneStartCache()
    clearFinaleCameraCache()
    const manifest = finalizeManifest(DOCUMENTARY_MANIFEST, DURATION_MS)
    const beforeClosing = resolveDocumentaryFrame(manifest, 205_000, DURATION_MS)!
    const duringConvergence = resolveDocumentaryFrame(manifest, 226_000, DURATION_MS)!

    expect(duringConvergence.camera.scale).toBeLessThan(beforeClosing.camera.scale)
    expect(duringConvergence.markers.some((marker) => marker.placeId === 'new-jersey')).toBe(true)
    expect(duringConvergence.markers.some((marker) => marker.placeId === 'california')).toBe(true)
  })

  it('eases toward a wide world view instead of circling between branches', () => {
    clearSceneStartCache()
    const manifest = finalizeManifest(DOCUMENTARY_MANIFEST, DURATION_MS)
    const beforeFinale = resolveDocumentaryFrame(manifest, DURATION_MS * 0.65, DURATION_MS)!
    const lateFinale = resolveDocumentaryFrame(manifest, DURATION_MS * 0.95, DURATION_MS)!

    expect(lateFinale.camera.scale).toBeLessThanOrEqual(beforeFinale.camera.scale + 0.05)
    expect(lateFinale.camera.scale).toBeLessThanOrEqual(ATLAS_ESTABLISHING_CAMERA.scale + 0.12)

    const applied = applyFinaleCameraPolicy(beforeFinale.camera, DURATION_MS * 0.95, DURATION_MS)
    expect(applied.scale).toBeLessThanOrEqual(beforeFinale.camera.scale)
  })

  it('frames every script place in the wide finale camera', () => {
    expect(FINALE_WORLD_CAMERA.scale).toBeLessThanOrEqual(ATLAS_ESTABLISHING_CAMERA.scale + 0.05)
  })

  it('adds late-script dots when new branches are named on the wide map', () => {
    const manifest = finalizeManifest(DOCUMENTARY_MANIFEST, DURATION_MS)
    const frame = resolveDocumentaryFrame(manifest, 229_000, DURATION_MS)!
    const lateIds = resolveLateAddedPlaceIds(229_000, DURATION_MS)

    expect(frame.markers.length).toBeGreaterThan(lateIds.length)
    expect(frame.markers.some((marker) => marker.placeId === 'new-jersey')).toBe(true)
    expect(frame.markers.some((marker) => marker.placeId === 'california')).toBe(true)
  })

  it('hides geographic place labels during the final quarter while keeping dots', () => {
    const manifest = finalizeManifest(DOCUMENTARY_MANIFEST, DURATION_MS)
    const finalQuarterStart = Math.floor(DURATION_MS * 0.75)

    const beforeFinalQuarter = resolveDocumentaryFrame(manifest, 95_000, DURATION_MS)
    expect(beforeFinalQuarter?.geoLabel?.text).toBe('Cheshire')

    const inFinalQuarter = resolveDocumentaryFrame(manifest, finalQuarterStart + 5_000, DURATION_MS)
    expect(inFinalQuarter?.geoLabel).toBeNull()
    expect(inFinalQuarter!.markers.length).toBeGreaterThan(0)
  })
})
