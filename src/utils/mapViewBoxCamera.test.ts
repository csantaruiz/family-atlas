import { describe, expect, it } from 'vitest'
import { DEFAULT_CAMERA } from './mapSemanticZoom'
import {
  cameraFromScaleAndScreenAnchor,
  projectWorldThroughViewBoxCamera,
  screenPercentToWorld,
  viewBoxCameraForContainer,
} from './mapSemanticZoom'
import { panCamera, zoomCameraAt } from './mapCameraGestures'

const PHONE = { width: 390, height: 844 }
const CALIFORNIA = { x: 18, y: 39 }

describe('viewBox camera', () => {
  it('keeps viewBox aspect equal to the viewport', () => {
    const viewBox = viewBoxCameraForContainer(DEFAULT_CAMERA, PHONE.width, PHONE.height)
    expect(viewBox.width / viewBox.height).toBeCloseTo(PHONE.width / PHONE.height, 8)
  })

  it('projects a world point through the same mapping the SVG viewBox uses', () => {
    const cameras = [
      DEFAULT_CAMERA,
      { cx: 22, cy: 40, scale: 1.5 },
      { cx: 18, cy: 39, scale: 2 },
      { cx: 18, cy: 39, scale: 5.5 },
      { cx: 40, cy: 42, scale: 1.8 },
      { cx: 10, cy: 40, scale: 2.2 },
    ]

    for (const camera of cameras) {
      const overlay = projectWorldThroughViewBoxCamera(
        CALIFORNIA.x,
        CALIFORNIA.y,
        camera,
        PHONE.width,
        PHONE.height,
      )
      const viewBox = viewBoxCameraForContainer(camera, PHONE.width, PHONE.height)
      const px = ((CALIFORNIA.x - viewBox.minX) / viewBox.width) * PHONE.width
      const py = ((CALIFORNIA.y - viewBox.minY) / viewBox.height) * PHONE.height
      expect(Math.abs((overlay.left / 100) * PHONE.width - px)).toBeLessThan(1.5)
      expect(Math.abs((overlay.top / 100) * PHONE.height - py)).toBeLessThan(1.5)
    }
  })

  it('does not change scale during a one-finger pan', () => {
    const start = { cx: 28, cy: 41, scale: 1.7 }
    const moved = panCamera(start, 90, 40, PHONE.width, PHONE.height)
    expect(moved.scale).toBe(start.scale)
  })

  it('keeps the pinched world point under the fingers', () => {
    const originLeft = 28
    const originTop = 42
    const start = { cx: 24, cy: 40, scale: 1.3 }
    const before = screenPercentToWorld(originLeft, originTop, start, PHONE.width, PHONE.height)
    const zoomed = zoomCameraAt(start, 1.8, originLeft, originTop, PHONE)
    const after = screenPercentToWorld(originLeft, originTop, zoomed, PHONE.width, PHONE.height)
    expect(Math.abs(after.x - before.x)).toBeLessThan(0.25)
    expect(Math.abs(after.y - before.y)).toBeLessThan(0.25)
  })

  it('rebuilds the camera from a world anchor without leftover CSS scale', () => {
    const world = { x: 18, y: 39 }
    const camera = cameraFromScaleAndScreenAnchor(2.1, world, 40, 55, PHONE.width, PHONE.height)
    const roundTrip = screenPercentToWorld(40, 55, camera, PHONE.width, PHONE.height)
    expect(Math.abs(roundTrip.x - world.x)).toBeLessThan(0.2)
    expect(Math.abs(roundTrip.y - world.y)).toBeLessThan(0.2)
  })
})
