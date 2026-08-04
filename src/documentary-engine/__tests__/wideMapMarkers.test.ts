import { beforeEach, describe, expect, it } from 'vitest'
import { resolveDocumentaryFrame, clearSceneStartCache } from '../core/cameraDirector'
import { clearDisplayRevealRegistryForTests } from '../core/displayRevealRegistry'
import { clearFinaleCameraCache } from '../core/finaleCameraPolicy'
import { clearScriptMentionCacheForTests, resolveLateAddedPlaceIds } from '../core/scriptMentionDirector'
import { DOCUMENTARY_MANIFEST } from '../data/documentaryManifest'
import {
  projectPointInViewBoxCamera,
  viewBoxCameraForContainer,
} from '../../utils/mapSemanticZoom'
import { finalizeManifest } from '../utils/migrationPaths'
import { AUDIO_ANALYZED_DURATION_MS } from '../core/audioSyncDirector'

const STAGE = { width: 1920, height: 1080 }

describe('wide map late-script dots', () => {
  beforeEach(() => {
    clearDisplayRevealRegistryForTests()
    clearSceneStartCache()
    clearFinaleCameraCache()
    clearScriptMentionCacheForTests()
  })

  it('projects late-added dots on screen during convergence', () => {
    const durationMs = AUDIO_ANALYZED_DURATION_MS
    const manifest = finalizeManifest(DOCUMENTARY_MANIFEST, durationMs)
    const timeMs = 229_000
    const frame = resolveDocumentaryFrame(manifest, timeMs, durationMs)!
    const lateIds = resolveLateAddedPlaceIds(timeMs, durationMs)
    const viewBox = viewBoxCameraForContainer(frame.camera, STAGE.width, STAGE.height)

    expect(lateIds.length).toBeGreaterThanOrEqual(5)
    expect(frame.markers.length).toBeGreaterThan(lateIds.length)

    for (const placeId of lateIds) {
      const marker = frame.markers.find((entry) => entry.placeId === placeId)
      expect(marker, placeId).toBeTruthy()
      const anchor = projectPointInViewBoxCamera(
        marker!.x,
        marker!.y,
        viewBox,
        STAGE.width,
        STAGE.height,
      )
      expect(anchor.left, placeId).toBeGreaterThan(2)
      expect(anchor.left, placeId).toBeLessThan(98)
      expect(anchor.top, placeId).toBeGreaterThan(2)
      expect(anchor.top, placeId).toBeLessThan(98)
    }
  })
})
