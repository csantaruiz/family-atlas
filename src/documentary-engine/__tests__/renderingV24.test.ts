import { beforeEach, describe, expect, it } from 'vitest'
import { resolveDocumentaryFrame } from '../core/cameraDirector'
import { validateCameraGeography } from '../core/cameraGeographicGuard'
import { clearDisplayRevealRegistryForTests } from '../core/displayRevealRegistry'
import { GEO_LABEL_PX, resolveGeographicLabel } from '../core/geoLabelDirector'
import { resolveNarrativeOverlay } from '../core/narrativeOverlayDirector'
import { getCanonicalPlace } from '../data/canonicalPlaceRegistry'
import { DOCUMENTARY_MANIFEST } from '../data/documentaryManifest'
import type { ResolvedMarker } from '../types/choreography'

const DURATION_MS = 384_888

function marker(placeId: string): ResolvedMarker {
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

describe('V2.4 rendering layer', () => {
  beforeEach(() => {
    clearDisplayRevealRegistryForTests()
  })

  it('exposes at most one geographic label', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 95_000, DURATION_MS)
    expect(frame?.geoLabel?.text).toBe('Cheshire')
    expect(frame?.geoLabel?.fontSizePx).toBeLessThanOrEqual(GEO_LABEL_PX.max)
  })

  it('keeps geographic label px within clamp', () => {
    const labels = resolveGeographicLabel([marker('gawsworth')], 'local', 'gawsworth')
    expect(labels).toHaveLength(1)
    expect(labels[0].fontSizePx).toBe(GEO_LABEL_PX.activeLocal)
    expect(labels[0].fontSizePx).toBeLessThanOrEqual(24)
  })

  it('returns one narrative overlay without duplicate place names', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 45_000, DURATION_MS)
    expect(frame?.narrativeOverlay?.title).toBe('The earliest surviving thread.')
    expect(frame?.narrativeOverlay?.subtitle).toBeUndefined()
    expect(frame?.geoLabel?.text).toBe('Cheshire')
  })

  it('shows William Lowndes overlay without insight clutter', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 51_000, DURATION_MS)
    expect(frame?.narrativeOverlay?.title).toBe('William Lowndes')
    expect(frame?.narrativeOverlay?.date).toBe('1473')
    expect(frame?.narrativeOverlay?.title).not.toBe('The earliest surviving thread.')
    expect(frame?.geoLabel?.text).toBe('Gawsworth')
  })

  it('shows narrative overlay as soon as the Cheshire scene cue begins', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 43_500, DURATION_MS)
    expect(frame?.sceneId).toBe('cheshire-records')
    expect(frame?.narrativeOverlay?.title).toBe('The earliest surviving thread.')
    expect(frame?.geoLabel?.text).toBe('Cheshire')
  })

  it('shows subtle time layer before 0:25', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 12_000, DURATION_MS)
    expect(frame?.timeLayer.mode).toBe('subtle')
    expect(frame?.timeLayer.opacity).toBeGreaterThan(0)
  })

  it('draws migration routes during choreographed scenes', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 125_000, DURATION_MS)
    expect(frame?.sceneId).toBe('chihuahua-arrival')
    const spainArc = frame?.routes.find((route) => route.id.startsWith('manifest-spain-chihuahua'))
    expect(spainArc?.evidence).toBe('branch')
    expect(spainArc?.transoceanic).toBe(true)
    expect(spainArc?.flowDurationSec).toBeGreaterThan(0)
    expect(spainArc?.drawProgress).toBeGreaterThan(0.2)
    expect(spainArc?.d.length).toBeGreaterThan(10)
  })

  it('does not render routes before migration chapters', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 50_000, DURATION_MS)
    expect(frame?.routes).toEqual([])
  })

  it('shows faint corridor routes on the wide closing map', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 320_000, DURATION_MS)
    expect(frame?.routes.length).toBeGreaterThanOrEqual(6)
    expect(frame?.routes.every((route) => route.drawProgress === 1)).toBe(true)
    expect(frame?.routes.some((route) => route.id.startsWith('manifest-closing-'))).toBe(true)
  })

  it('keeps introduced manifest routes visible after their scene ends', () => {
    const duringIntro = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 125_000, DURATION_MS)
    expect(duringIntro?.sceneId).toBe('chihuahua-arrival')
    expect(
      duringIntro?.routes.some((route) => route.id.startsWith('manifest-spain-chihuahua')),
    ).toBe(true)

    const laterScene = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 142_000, DURATION_MS)
    expect(laterScene?.sceneId).toBe('ojinaga-town')
    const spainArc = laterScene?.routes.find((route) =>
      route.id.startsWith('manifest-introduced-spain-chihuahua'),
    )
    expect(spainArc?.drawProgress).toBe(1)
    expect(spainArc?.opacity ?? 0).toBeGreaterThan(0.2)
  })

  it('centers Cheshire scenes on Cheshire — not Africa', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 95_000, DURATION_MS)
    const cheshire = getCanonicalPlace('cheshire')!
    expect(Math.hypot(frame!.camera.cx - cheshire.x, frame!.camera.cy - cheshire.y)).toBeLessThan(9)
    expect(frame!.camera.cy).toBeLessThan(38)
  })

  it('centers Gawsworth at local scale', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 48_000, DURATION_MS)
    expect(frame!.sceneId).toBe('gawsworth-william')
    expect(frame!.geoLabel?.text).toBe('Gawsworth')
  })

  it('camera guard rejects Africa framing for Cheshire', () => {
    const cheshire = getCanonicalPlace('cheshire')!
    const fallback = { cx: cheshire.x, cy: cheshire.y, scale: 2.4 }
    const africaCam = { cx: 50, cy: 44, scale: 1.2 }
    const result = validateCameraGeography('cheshire', africaCam, fallback, 'test')
    expect(result.valid).toBe(false)
    expect(result.camera).toEqual(fallback)
  })

  it('seeking restores single overlay and label state', () => {
    for (const time of [12_000, 44_000, 51_000]) {
      const a = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, time, DURATION_MS)
      const b = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, time, DURATION_MS)
      expect(a?.geoLabel).toEqual(b?.geoLabel)
      expect(a?.narrativeOverlay).toEqual(b?.narrativeOverlay)
      expect(a?.timeLayer).toEqual(b?.timeLayer)
    }
  })

  it('narrative overlay director returns one primary field from spec', () => {
    const overlay = resolveNarrativeOverlay(
      {
        cameraRelation: 'continue-camera',
        geographicScale: 'regional',
        narrativeOverlay: {
          eyebrow: 'Origins',
          subtitle: 'Cheshire',
          insight: 'The earliest surviving thread.',
          start: 0,
          end: 1,
        },
      },
      0.5,
      'Cheshire',
      60_000,
      60_000,
    )
    expect(overlay?.title).toBe('The earliest surviving thread.')
    expect(overlay?.eyebrow).toBeUndefined()
    expect(overlay?.subtitle).toBeUndefined()
  })
})
