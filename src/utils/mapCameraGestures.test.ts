import { describe, expect, it } from 'vitest'
import { DEFAULT_CAMERA } from './mapSemanticZoom'
import {
  cameraHasLeftOverview,
  clampCameraToContent,
  mapPointFromScreenPercent,
  panCamera,
  panLimitsForCamera,
  zoomCameraAt,
} from './mapCameraGestures'

const PHONE = { width: 390, height: 720 }

describe('mapCameraGestures', () => {
  it('keeps the focal map point under the pinch midpoint', () => {
    const originLeft = 35
    const originTop = 40
    const start = { cx: 50, cy: 48, scale: 1.2 }
    const before = mapPointFromScreenPercent(originLeft, originTop, start, PHONE)
    const zoomed = zoomCameraAt(start, 1.35, originLeft, originTop, PHONE)
    const after = mapPointFromScreenPercent(originLeft, originTop, zoomed, PHONE)
    expect(zoomed.scale).toBeGreaterThan(start.scale)
    expect(Math.abs(after.x - before.x)).toBeLessThan(0.4)
    expect(Math.abs(after.y - before.y)).toBeLessThan(0.4)
  })

  it('does not change scale when panning', () => {
    const start = { cx: 42, cy: 44, scale: 1.8 }
    const moved = panCamera(start, 80, -30, PHONE.width, PHONE.height)
    expect(moved.scale).toBe(start.scale)
    expect(moved.cx).not.toBe(start.cx)
  })

  it('clamps scale to the gesture range', () => {
    const tooFar = zoomCameraAt(DEFAULT_CAMERA, 40, 50, 50, PHONE)
    expect(tooFar.scale).toBeLessThanOrEqual(5.5)
    const tooClose = zoomCameraAt(DEFAULT_CAMERA, 0.01, 50, 50, PHONE)
    expect(tooClose.scale).toBeGreaterThanOrEqual(1)
  })

  it('pans opposite the finger so content follows the drag', () => {
    const moved = panCamera(DEFAULT_CAMERA, 40, 0, 400, 400)
    expect(moved.cx).toBeLessThan(DEFAULT_CAMERA.cx)
    expect(moved.scale).toBe(DEFAULT_CAMERA.scale)
  })

  it('can center the western content edge (California)', () => {
    const bounds = { minX: 14, maxX: 56, minY: 32, maxY: 50 }
    const camera = { cx: 14, cy: 40, scale: 1.2 }
    const clamped = clampCameraToContent(camera, bounds, PHONE)
    expect(Math.abs(clamped.cx - 14)).toBeLessThan(1.5)
    expect(clamped.scale).toBe(1.2)
    const limits = panLimitsForCamera(camera, bounds, PHONE)
    expect(limits.minCx).toBeLessThanOrEqual(14)
    expect(limits.maxCx).toBeGreaterThanOrEqual(56)
  })

  it('keeps the camera from leaving family content', () => {
    const bounds = { minX: 30, maxX: 70, minY: 40, maxY: 60 }
    const clamped = clampCameraToContent({ cx: -40, cy: 200, scale: 1.4 }, bounds, PHONE)
    expect(clamped.cx).toBeGreaterThan(0)
    expect(clamped.cy).toBeLessThan(120)
  })

  it('detects when the user has left the overview framing', () => {
    expect(cameraHasLeftOverview({ cx: 50, cy: 50, scale: 1.4 }, DEFAULT_CAMERA)).toBe(true)
    expect(cameraHasLeftOverview(DEFAULT_CAMERA, DEFAULT_CAMERA)).toBe(false)
  })
})
