import { describe, expect, it } from 'vitest'
import {
  fitCameraToBounds,
  fitOverviewCamera,
  usableViewport,
  MAP_LEFT_CHROME_PX,
  MAP_RIGHT_CHROME_PX,
  MAP_BOTTOM_CHROME_PX,
} from './mapCamera'
import { boundsFromRouteEndpoints, ensureMinBoundsExtent } from './mapRegionGeometry'

const DESKTOP = { frameWidthPx: 1728, frameHeightPx: 900, panelOpen: true }

describe('usableViewport', () => {
  it('computes a reduced safe viewport inside desktop chrome reserves', () => {
    const usable = usableViewport(DESKTOP)
    expect(usable.widthPercent).toBeLessThan(75)
    expect(usable.heightPercent).toBeLessThan(85)
    expect(usable.centerXPercent).toBeGreaterThan(40)
    expect(usable.centerXPercent).toBeLessThan(58)
  })

  it('shifts the safe center when left and right chrome differ', () => {
    const usable = usableViewport({
      ...DESKTOP,
      panelOpen: false,
      safeInsetsPx: { left: 420, right: 220, top: 36, bottom: 148 },
    })
    expect(usable.centerXPercent).toBeGreaterThan(50)
  })

  it('reserves desktop bottom chrome for the Journey Insight rail', () => {
    const usable = usableViewport({ ...DESKTOP, bottomInsetPx: MAP_BOTTOM_CHROME_PX })
    const topHeavy = usableViewport({
      ...DESKTOP,
      bottomInsetPx: 40,
      safeInsetsPx: { bottom: 40 },
    })
    expect(usable.centerYPercent).toBeLessThan(topHeavy.centerYPercent)
  })

  it('keeps phone chrome compact', () => {
    const phone = usableViewport({
      frameWidthPx: 390,
      frameHeightPx: 720,
      panelOpen: true,
      bottomInsetPx: 148,
    })
    expect(phone.widthPercent).toBeGreaterThan(85)
  })
})

describe('fitCameraToBounds', () => {
  it('zooms a compact Britain cluster well above overview scale', () => {
    const britain = { minX: 49, maxX: 55, minY: 29, maxY: 35 }
    const camera = fitCameraToBounds(britain, DESKTOP, 'regional')
    expect(camera.scale).toBeGreaterThan(1.8)
    expect(camera.scale).toBeLessThanOrEqual(3.8)
  })

  it('centers geography in the safe viewport, not the full frame midpoint', () => {
    const britain = { minX: 49, maxX: 55, minY: 29, maxY: 35 }
    const camera = fitCameraToBounds(britain, DESKTOP, 'regional')
    const usable = usableViewport(DESKTOP)
    const geoCx = 52
    // cx is offset so geo appears at usable.centerXPercent
    const projectedCenter =
      50 + (geoCx - camera.cx) * camera.scale
    expect(Math.abs(projectedCenter - usable.centerXPercent)).toBeLessThan(2)
  })

  it('fits family overview without locking to scale 1 when extent is compact', () => {
    const compactFamily = { minX: 30, maxX: 55, minY: 30, maxY: 42 }
    const camera = fitOverviewCamera(compactFamily, { ...DESKTOP, panelOpen: false })
    expect(camera.scale).toBeGreaterThanOrEqual(1)
    expect(camera.scale).toBeLessThanOrEqual(1.75)
  })
})

describe('route and min bounds', () => {
  it('builds corridor bounds from endpoints', () => {
    const bounds = boundsFromRouteEndpoints({ x: 18, y: 38 }, { x: 52, y: 32 })
    expect(bounds.minX).toBeLessThan(18)
    expect(bounds.maxX).toBeGreaterThan(52)
  })

  it('enforces a minimum extent for sparse points', () => {
    const tiny = ensureMinBoundsExtent({ minX: 50, maxX: 50.2, minY: 40, maxY: 40.1 }, 6)
    expect(tiny.maxX - tiny.minX).toBeGreaterThanOrEqual(6)
    expect(tiny.maxY - tiny.minY).toBeGreaterThanOrEqual(6)
  })
})

describe('chrome constants', () => {
  it('keeps left/right reserves in the current composition range', () => {
    expect(MAP_LEFT_CHROME_PX).toBeGreaterThanOrEqual(300)
    expect(MAP_RIGHT_CHROME_PX).toBeGreaterThanOrEqual(320)
    expect(MAP_BOTTOM_CHROME_PX).toBeGreaterThanOrEqual(120)
  })
})
