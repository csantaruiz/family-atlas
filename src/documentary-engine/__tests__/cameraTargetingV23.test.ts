import { describe, expect, it } from 'vitest'
import { resolveDocumentaryFrame } from '../core/cameraDirector'
import { ATLAS_ESTABLISHING_CAMERA } from '../core/cameraFraming'
import { resolveCameraTarget } from '../core/cameraTargetResolver'
import { GEO_LABEL_PX, resolveGeographicLabel } from '../core/geoLabelDirector'
import { needsStagedTransition } from '../core/cameraStagedTransitions'
import { getCanonicalPlace } from '../data/canonicalPlaceRegistry'
import { DOCUMENTARY_MANIFEST } from '../data/documentaryManifest'
import type { ResolvedMarker } from '../types/choreography'

const DURATION_MS = 384_888

function cameraNearPlace(
  camera: { cx: number; cy: number },
  placeId: string,
  maxDist = 6,
): boolean {
  const place = getCanonicalPlace(placeId)
  if (!place) return false
  return Math.hypot(camera.cx - place.x, camera.cy - place.y) <= maxDist
}

describe('camera targeting V2.3+', () => {
  it('uses atlas establishing center — not Africa viewport center (50,50)', () => {
    expect(ATLAS_ESTABLISHING_CAMERA.cx).toBeLessThan(40)
    expect(ATLAS_ESTABLISHING_CAMERA.cy).toBeLessThan(42)
    const opening = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 4_000, DURATION_MS)
    expect(opening?.camera.cx).toBeLessThan(40)
    expect(opening?.camera.cy).toBeLessThan(42)
  })

  it('keeps the opening atlas view before Cheshire is named in narration', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 24_000, DURATION_MS)
    expect(frame?.sceneId).toBe('opening')
    expect(frame?.camera.cx).toBeLessThan(40)
    expect(frame?.camera.cy).toBeLessThan(42)
  })

  it('targets Cheshire within England after the narration names Cheshire', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 95_000, DURATION_MS)
    expect(frame?.sceneId).toBe('cheshire-timeline')
    expect(cameraNearPlace(frame!.camera, 'cheshire', 6)).toBe(true)
  })

  it('retains previous camera when active place is unresolved', () => {
    const previous = { cx: 49.5, cy: 33.8, scale: 2.4 }
    const result = resolveCameraTarget(
      {
        cameraRelation: 'continue-camera',
        geographicScale: 'local',
        activePlaceId: 'nonexistent-place',
        focusPlaceIds: ['nonexistent-place'],
      },
      { sceneId: 'test', previousCamera: previous },
    )
    expect(result).toBeNull()
  })

  it('uses staged transitions for long-distance chapter moves', () => {
    const start = { cx: 49.4, cy: 33.8, scale: 2.4 }
    const end = { cx: 49.1, cy: 37.6, scale: 1.62 }
    expect(
      needsStagedTransition(start, end, {
        cameraRelation: 'chapter-transition',
        geographicScale: 'country',
        activePlaceId: 'spain',
      }, 'spain-branch'),
    ).toBe(true)
  })
})

describe('time layer', () => {
  it('becomes visible before 0:25', () => {
    const at12s = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 12_000, DURATION_MS)
    expect(at12s?.timeLayer.mode).toBe('subtle')
    expect(at12s?.timeLayer.opacity).toBeGreaterThan(0)
  })
})

describe('geographic labels', () => {
  const marker = (placeId: string): ResolvedMarker => {
    const place = getCanonicalPlace(placeId)!
    return {
      id: placeId,
      placeId,
      x: place.x,
      y: place.y,
      active: true,
      contextual: false,
      opacity: 1,
    }
  }

  it('clamps geographic label font sizes in px', () => {
    const labels = resolveGeographicLabel([marker('gawsworth')], 'local', 'gawsworth')
    expect(labels.length).toBe(1)
    expect(labels[0].fontSizePx).toBeGreaterThanOrEqual(GEO_LABEL_PX.min)
    expect(labels[0].fontSizePx).toBeLessThanOrEqual(GEO_LABEL_PX.activeLocal)
  })

  it('returns only the active place label', () => {
    const labels = resolveGeographicLabel([marker('gawsworth')], 'local', 'gawsworth')
    expect(labels).toHaveLength(1)
    expect(labels[0].text).toBe('Gawsworth')
  })
})

describe('seek reconstruction', () => {
  it('restores camera, labels, and timeline together', () => {
    const times = [12_000, 48_000, 100_000]
    for (const timeMs of times) {
      const a = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, timeMs, DURATION_MS)
      const b = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, timeMs, DURATION_MS)
      expect(a).toEqual(b)
    }
  })
})
