import { beforeEach, describe, expect, it } from 'vitest'
import { resolveDocumentaryFrame, clearSceneStartCache } from '../core/cameraDirector'
import { clearDisplayRevealRegistryForTests } from '../core/displayRevealRegistry'
import { clearFinaleCameraCache } from '../core/finaleCameraPolicy'
import { clearScriptMentionCacheForTests, resolveLateAddedPlaceIds } from '../core/scriptMentionDirector'
import { DOCUMENTARY_MANIFEST } from '../data/documentaryManifest'
import { getCanonicalPlace } from '../data/canonicalPlaceRegistry'
import { projectPointInViewBoxCamera, viewBoxCameraForContainer } from '../../utils/mapSemanticZoom'
import { finalizeManifest } from '../utils/migrationPaths'

describe('east coast dot visibility at 3:50', () => {
  beforeEach(() => {
    clearDisplayRevealRegistryForTests()
    clearSceneStartCache()
    clearFinaleCameraCache()
    clearScriptMentionCacheForTests()
  })

  it('includes New Jersey and Pennsylvania markers at 230s', () => {
    const durationMs = 505_000
    const manifest = finalizeManifest(DOCUMENTARY_MANIFEST, durationMs)
    const frame = resolveDocumentaryFrame(manifest, 230_000, durationMs)!
    const placeIds = frame.markers.map((marker) => marker.placeId)

    expect(placeIds).toContain('new-jersey')
    expect(placeIds).toContain('pennsylvania')
    expect(placeIds).toContain('camden')
    expect(placeIds).toContain('england')
  })

  it('projects east coast markers onto the visible map', () => {
    const durationMs = 505_000
    const manifest = finalizeManifest(DOCUMENTARY_MANIFEST, durationMs)
    const frame = resolveDocumentaryFrame(manifest, 230_000, durationMs)!
    const viewBox = viewBoxCameraForContainer(frame.camera, 1920, 1080)

    for (const placeId of ['new-jersey', 'pennsylvania', 'camden', 'gloucester-city']) {
      const place = getCanonicalPlace(placeId)!
      const anchor = projectPointInViewBoxCamera(place.x, place.y, viewBox, 1920, 1080)
      expect(anchor.left, placeId).toBeGreaterThan(40)
      expect(anchor.left, placeId).toBeLessThan(92)
      expect(anchor.top, placeId).toBeGreaterThan(15)
      expect(anchor.top, placeId).toBeLessThan(60)
    }
  })

  it('lists late-added places spoken before 230s', () => {
    expect(resolveLateAddedPlaceIds(230_000, 505_000)).toEqual(
      expect.arrayContaining(['new-jersey', 'pennsylvania', 'scotland', 'camden', 'gloucester-city']),
    )
  })
})
