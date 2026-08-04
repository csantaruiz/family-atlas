import { beforeEach, describe, expect, it } from 'vitest'
import { resolveDocumentaryFrame, clearSceneStartCache } from '../core/cameraDirector'
import {
  clearDisplayRevealRegistryForTests,
  isGeoLabelRevealed,
  markGeoLabelRevealed,
  NARRATIVE_OVERLAY_LIFECYCLE_MS,
} from '../core/displayRevealRegistry'
import { resolveNarrativeOverlay } from '../core/narrativeOverlayDirector'
import { DOCUMENTARY_MANIFEST } from '../data/documentaryManifest'

const DURATION_MS = 384_888

describe('display reveal registry', () => {
  beforeEach(() => {
    clearDisplayRevealRegistryForTests()
    clearSceneStartCache()
  })

  it('locks pan drift while a single place stays in focus', () => {
    const earlier = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 178_000, DURATION_MS)
    const later = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 178_600, DURATION_MS)
    expect(earlier?.sceneId).toBe('migration-el-paso')
    expect(later?.sceneId).toBe('migration-el-paso')
    expect(Math.abs(earlier!.camera.cx - later!.camera.cx)).toBeLessThan(0.02)
    expect(Math.abs(earlier!.camera.cy - later!.camera.cy)).toBeLessThan(0.02)
  })

  it('keeps geographic labels visible across scene boundaries once revealed', () => {
    const revealedInPriorScene = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 55_000, DURATION_MS)
    expect(revealedInPriorScene?.sceneId).toBe('gawsworth-william')
    expect(revealedInPriorScene?.geoLabel?.text).toBe('Gawsworth')
    expect(revealedInPriorScene?.geoLabel?.opacity).toBe(1)
    expect(isGeoLabelRevealed('Gawsworth')).toBe(true)

    const nextSceneStart = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 74_850, DURATION_MS)
    expect(nextSceneStart?.sceneId).toBe('cheshire-hold')
    expect(nextSceneStart?.geoLabel?.text).toBe('Gawsworth')
    expect(nextSceneStart?.geoLabel?.opacity).toBe(1)
  })

  it('does not repeat narrative lines after their slot completes', () => {
    const choreography = {
      cameraRelation: 'continue-camera' as const,
      geographicScale: 'regional' as const,
      narrativeOverlay: {
        insight: 'The earliest surviving thread.',
        start: 0.15,
        end: 0.9,
      },
    }

    const sceneStartMs = 60_000
    const cueMs = 60_000
    expect(
      resolveNarrativeOverlay(choreography, 0.5, 'Cheshire', sceneStartMs, cueMs)?.title,
    ).toBe('The earliest surviving thread.')
    expect(
      resolveNarrativeOverlay(
        choreography,
        0.5,
        'Cheshire',
        cueMs + 3_000,
        cueMs,
      )?.opacity,
    ).toBe(1)
    expect(
      resolveNarrativeOverlay(
        choreography,
        0.5,
        'Cheshire',
        cueMs + NARRATIVE_OVERLAY_LIFECYCLE_MS + 100,
        cueMs,
      ),
    ).toBeNull()
    expect(
      resolveNarrativeOverlay(choreography, 0.2, 'Cheshire', cueMs + 500, cueMs),
    ).toBeNull()
  })

  it('does not repeat atlas timeline copy across later audio cues', () => {
    const firstCue = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 320_000, DURATION_MS)
    expect(firstCue?.narrativeOverlay?.title).toBe('Every generation — waiting in the timeline')

    resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 341_000, DURATION_MS)
    const laterCue = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 350_000, DURATION_MS)
    expect(laterCue?.sceneId).toBe('atlas-timeline')
    expect(laterCue?.narrativeOverlay).toBeNull()
  })

  it('still allows a first fade-in for unseen text', () => {
    markGeoLabelRevealed('Cheshire')
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 48_000, DURATION_MS)
    expect(frame?.geoLabel?.text).toBe('Gawsworth')
    expect(frame?.geoLabel?.opacity).toBeLessThan(1)
  })

  it('ramps narrative opacity in, holds, then slowly fades out', () => {
    const choreography = {
      cameraRelation: 'continue-camera' as const,
      geographicScale: 'regional' as const,
      narrativeOverlay: {
        insight: 'Late twentieth century',
        start: 0.2,
        end: 0.82,
      },
    }
    const cueMs = 230_000
    resolveNarrativeOverlay(choreography, 0.5, null, cueMs, cueMs)

    const entering = resolveNarrativeOverlay(choreography, 0.5, null, cueMs + 300, cueMs)
    expect(entering?.opacity).toBeGreaterThan(0)
    expect(entering?.opacity).toBeLessThan(1)

    const holding = resolveNarrativeOverlay(
      choreography,
      0.5,
      null,
      cueMs + 2_000,
      cueMs,
    )
    expect(holding?.opacity).toBe(1)

    const fading = resolveNarrativeOverlay(
      choreography,
      0.5,
      null,
      cueMs + NARRATIVE_OVERLAY_LIFECYCLE_MS - 1_500,
      cueMs,
    )
    expect(fading?.opacity).toBeGreaterThan(0)
    expect(fading?.opacity).toBeLessThan(1)
  })
})
