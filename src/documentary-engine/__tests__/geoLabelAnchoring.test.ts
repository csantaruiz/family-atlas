import { describe, expect, it } from 'vitest'
import { resolveDocumentaryFrame } from '../core/cameraDirector'
import { getCanonicalPlace } from '../data/canonicalPlaceRegistry'
import { DOCUMENTARY_MANIFEST } from '../data/documentaryManifest'
import {
  projectMapPoint,
  projectPointInViewBoxCamera,
  viewBoxCameraForContainer,
  viewBoxPointToContainerPercent,
} from '../../utils/mapSemanticZoom'

const DURATION_MS = 384_888
const STAGE = { width: 1920, height: 1080 }

describe('geographic label anchoring', () => {
  it('slice-aware placement matches marker coords, not viewport-center projection', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 44_000, DURATION_MS)!
    const marker = frame.markers.find((entry) => entry.active && !entry.preview)!
    const label = frame.geoLabel!

    expect(label.text).toBe('Cheshire')
    expect(marker.x).toBe(label.x)
    expect(marker.y).toBe(label.y)

    const sliceAnchor = viewBoxPointToContainerPercent(
      label.x,
      label.y,
      STAGE.width,
      STAGE.height,
    )
    const legacyAnchor = projectMapPoint(label.x, label.y, frame.camera)

    expect(Math.abs(sliceAnchor.left - legacyAnchor.left)).toBeGreaterThan(0.4)
    expect(sliceAnchor.top).toBeLessThan(legacyAnchor.top)
  })

  it('anchors Cheshire label to Cheshire projection when named in narration', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 95_000, DURATION_MS)!
    const cheshire = getCanonicalPlace('cheshire')!
    const viewBox = viewBoxCameraForContainer(frame.camera, STAGE.width, STAGE.height)
    const anchor = projectPointInViewBoxCamera(
      cheshire.x,
      cheshire.y,
      viewBox,
      STAGE.width,
      STAGE.height,
    )

    expect(frame.geoLabel?.text).toBe('Cheshire')
    expect(anchor.left).toBeGreaterThan(47)
    expect(anchor.left).toBeLessThan(53)
    expect(anchor.top).toBeGreaterThan(47)
    expect(anchor.top).toBeLessThan(53)
  })

  it('viewBox camera centers the active focal point on viewport', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 44_000, DURATION_MS)!
    const viewBox = viewBoxCameraForContainer(frame.camera, STAGE.width, STAGE.height)
    const projected = projectPointInViewBoxCamera(
      frame.camera.cx,
      frame.camera.cy,
      viewBox,
      STAGE.width,
      STAGE.height,
    )

    expect(projected.left).toBeCloseTo(50, 1)
    expect(projected.top).toBeCloseTo(50, 1)
  })

  it('label and marker share the same screen anchor', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 95_000, DURATION_MS)!
    const viewBox = viewBoxCameraForContainer(frame.camera, STAGE.width, STAGE.height)
    const marker = frame.markers.find((entry) => entry.active && !entry.preview)!
    const label = frame.geoLabel!

    const markerAnchor = projectPointInViewBoxCamera(
      marker.x,
      marker.y,
      viewBox,
      STAGE.width,
      STAGE.height,
    )
    const labelAnchor = projectPointInViewBoxCamera(
      label!.x,
      label!.y,
      viewBox,
      STAGE.width,
      STAGE.height,
    )

    expect(markerAnchor).toEqual(labelAnchor)
  })
})
