import { beforeEach, describe, expect, it } from 'vitest'
import { resolveDocumentaryFrame, clearSceneStartCache } from '../core/cameraDirector'
import { clearDisplayRevealRegistryForTests } from '../core/displayRevealRegistry'
import { CLOSING_STAGE_START_MS, clearFinaleCameraCache } from '../core/finaleCameraPolicy'
import { resolveLateAddedScriptMarkers } from '../core/lateStageMarkerDirector'
import {
  clearScriptMentionCacheForTests,
  extractPlaceIdsFromText,
  resolveFirstMentionTimes,
  resolveLateAddedPlaceIds,
} from '../core/scriptMentionDirector'
import { DOCUMENTARY_MANIFEST } from '../data/documentaryManifest'
import { finalizeManifest } from '../utils/migrationPaths'
import { AUDIO_ANALYZED_DURATION_MS } from '../core/audioSyncDirector'

const DURATION_MS = AUDIO_ANALYZED_DURATION_MS

describe('script mention director', () => {
  beforeEach(() => {
    clearScriptMentionCacheForTests()
  })

  it('matches place names from the narration against the registry', () => {
    expect(extractPlaceIdsFromText('Scotland, Pennsylvania, and New Jersey.')).toEqual(
      expect.arrayContaining(['scotland', 'pennsylvania', 'new-jersey']),
    )
    expect(extractPlaceIdsFromText('Gloucester City and Camden had become important family places.')).toEqual(
      expect.arrayContaining(['gloucester-city', 'camden']),
    )
  })

  it('treats only first-time late mentions as new wide-map dots', () => {
    const firstMentions = resolveFirstMentionTimes()
    expect(firstMentions.get('england')).toBeLessThan(CLOSING_STAGE_START_MS)
    expect(firstMentions.get('new-jersey')).toBeGreaterThanOrEqual(CLOSING_STAGE_START_MS)

    const atHendryLine = resolveLateAddedPlaceIds(222_000, DURATION_MS)
    expect(atHendryLine).toContain('scotland')
    expect(atHendryLine).toContain('pennsylvania')
    expect(atHendryLine).toContain('new-jersey')
    expect(atHendryLine).not.toContain('england')
    expect(atHendryLine).not.toContain('california')
  })
})

describe('late script marker dots', () => {
  beforeEach(() => {
    clearDisplayRevealRegistryForTests()
    clearSceneStartCache()
    clearFinaleCameraCache()
    clearScriptMentionCacheForTests()
  })

  it('adds dots only for places first named in the late script', () => {
    const markers = resolveLateAddedScriptMarkers(229_000, DURATION_MS)
    expect(markers.map((marker) => marker.placeId)).toEqual(
      expect.arrayContaining(['scotland', 'pennsylvania', 'new-jersey', 'gloucester-city', 'camden']),
    )
    expect(markers.some((marker) => marker.placeId === 'england')).toBe(false)
    expect(markers.every((marker) => marker.lateScript)).toBe(true)
  })

  it('does not repeat early-arc locations on the wide convergence map', () => {
    const manifest = finalizeManifest(DOCUMENTARY_MANIFEST, DURATION_MS)
    const frame = resolveDocumentaryFrame(manifest, 226_000, DURATION_MS)!
    expect(frame.markers.some((marker) => marker.placeId === 'california')).toBe(true)
    expect(frame.markers.some((marker) => marker.placeId === 'new-jersey')).toBe(true)
  })

  it('adds Panama Canal Zone after it is spoken', () => {
    const before = resolveLateAddedScriptMarkers(235_000, DURATION_MS)
    const after = resolveLateAddedScriptMarkers(240_000, DURATION_MS)
    expect(before.some((marker) => marker.placeId === 'panama-canal-zone')).toBe(false)
    expect(after.some((marker) => marker.placeId === 'panama-canal-zone')).toBe(true)
  })
})
