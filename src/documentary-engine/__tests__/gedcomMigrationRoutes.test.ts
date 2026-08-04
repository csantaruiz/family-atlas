import { beforeEach, describe, expect, it } from 'vitest'
import { resolveDocumentaryFrame } from '../core/cameraDirector'
import {
  buildCanonicalMigrationCorridors,
  clearGedcomRouteCache,
  isTransoceanicPlacePair,
  resolveGedcomMigrationRoutes,
} from '../core/gedcomMigrationDirector'
import { clearDisplayRevealRegistryForTests } from '../core/displayRevealRegistry'
import { DOCUMENTARY_MANIFEST } from '../data/documentaryManifest'

const DURATION_MS = 384_888

describe('GEDCOM migration routes', () => {
  beforeEach(() => {
    clearDisplayRevealRegistryForTests()
  })

  it('derives Hendry corridors from family move records', () => {
    clearGedcomRouteCache()
    const corridors = buildCanonicalMigrationCorridors()
    const ids = corridors.map((corridor) => corridor.id)

    expect(ids.some((id) => id.startsWith('scotland->'))).toBe(true)
    expect(ids.some((id) => id.includes('new-jersey'))).toBe(true)
  })

  it('classifies Europe ↔ North America as transoceanic', () => {
    expect(isTransoceanicPlacePair('scotland', 'new-jersey')).toBe(true)
    expect(isTransoceanicPlacePair('cheshire', 'pennsylvania')).toBe(true)
    expect(isTransoceanicPlacePair('pennsylvania', 'new-jersey')).toBe(false)
    expect(isTransoceanicPlacePair('ojinaga', 'el-paso')).toBe(false)
  })

  it('includes the Atlantic crossing at country scale during the Cheshire bridge', () => {
    const routes = resolveGedcomMigrationRoutes({
      chapter: 'Origins in Cheshire',
      branch: 'british',
      geographicScale: 'country',
      sceneProgress: 0.5,
      closingMap: false,
      timeMs: 90_000,
      visiblePlaceIds: ['cheshire', 'britain'],
      focusPlaceIds: ['cheshire', 'britain'],
    })
    expect(routes.some((route) => route.id === 'gedcom-regional-britain_ireland->eastern_us')).toBe(
      true,
    )
    expect(routes.every((route) => route.opacity > 0.25)).toBe(true)
  })

  it('shows Atlantic GEDCOM corridor in the Cheshire bridge documentary frame', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 90_000, DURATION_MS)
    const atlantic = frame?.routes.find((route) => route.id.includes('britain_ireland->eastern_us'))
    expect(atlantic).toBeDefined()
    expect(atlantic?.opacity ?? 0).toBeGreaterThan(0.25)
  })

  it('keeps revealed GEDCOM corridors visible after the camera zooms tighter', () => {
    resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 90_000, DURATION_MS)
    const tighterHold = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 75_000, DURATION_MS)
    expect(
      tighterHold?.routes.some((route) => route.id.includes('britain_ireland->eastern_us')),
    ).toBe(true)
  })

  it('shows transoceanic corridors at regional scale when both landmasses are in focus', () => {
    const routes = resolveGedcomMigrationRoutes({
      chapter: 'Convergence',
      branch: 'eastern-us',
      geographicScale: 'regional',
      sceneProgress: 0.5,
      closingMap: false,
      timeMs: 180_000,
      visiblePlaceIds: ['scotland', 'new-jersey'],
      focusPlaceIds: ['scotland', 'new-jersey'],
    })
    expect(routes.some((route) => route.id.includes('britain_ireland->eastern_us'))).toBe(true)
  })

  it('includes the Atlantic crossing at continental Cheshire bridge', () => {
    const routes = resolveGedcomMigrationRoutes({
      chapter: 'Origins in Cheshire',
      branch: 'british',
      geographicScale: 'continental',
      sceneProgress: 0.5,
      closingMap: false,
      timeMs: 85_000,
      visiblePlaceIds: ['cheshire', 'britain'],
      focusPlaceIds: ['cheshire', 'britain'],
    })
    expect(routes.some((route) => route.id === 'gedcom-regional-britain_ireland->eastern_us')).toBe(
      true,
    )
    expect(routes.every((route) => route.drawProgress === 1)).toBe(true)
    expect(routes.every((route) => (route.flowDurationSec ?? 0) > 0)).toBe(true)
  })

  it('hides GEDCOM corridors when zoomed to local scale', () => {
    const routes = resolveGedcomMigrationRoutes({
      chapter: 'Origins in Cheshire',
      branch: 'british',
      geographicScale: 'local',
      sceneProgress: 0.5,
      closingMap: false,
      timeMs: 50_000,
      visiblePlaceIds: ['gawsworth'],
      focusPlaceIds: ['gawsworth'],
    })
    expect(routes).toHaveLength(0)
  })

  it('does not surface intra-continental Mexico corridors from GEDCOM', () => {
    const routes = resolveGedcomMigrationRoutes({
      chapter: 'Migration',
      geographicScale: 'regional',
      sceneProgress: 0.45,
      closingMap: false,
      timeMs: 160_000,
      visiblePlaceIds: ['ojinaga', 'el-paso'],
      focusPlaceIds: ['ojinaga', 'el-paso'],
    })
    expect(routes.some((route) => route.id.includes('mexico->southwest_us'))).toBe(false)
    expect(routes.some((route) => route.id.includes('mexico->california'))).toBe(false)
    expect(routes.some((route) => route.id.includes('pennsylvania->new-jersey'))).toBe(false)
  })

  it('emphasizes Atlantic corridors when Scotland and New Jersey are named late', () => {
    clearGedcomRouteCache()
    const routes = resolveGedcomMigrationRoutes({
      chapter: 'Convergence',
      geographicScale: 'continental',
      sceneProgress: 0.6,
      closingMap: true,
      timeMs: 222_000,
      visiblePlaceIds: ['scotland', 'pennsylvania', 'new-jersey', 'california', 'chihuahua'],
      focusPlaceIds: ['scotland', 'pennsylvania', 'new-jersey'],
    })

    const ids = routes.map((route) => route.id)
    expect(ids).toEqual(expect.arrayContaining(['gedcom-regional-britain_ireland->eastern_us']))
    expect(ids.some((id) => id.includes('pennsylvania->new-jersey'))).toBe(false)
    expect(ids.some((id) => id === 'gedcom-scotland->new-jersey')).toBe(true)
  })

  it('layers transoceanic GEDCOM corridors on the wide closing map', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 320_000, DURATION_MS)
    expect(frame?.routes.some((route) => route.id.includes('britain_ireland->eastern_us'))).toBe(
      true,
    )
    const atlantic = frame?.routes.find((route) => route.id.includes('britain_ireland->eastern_us'))
    expect(atlantic?.transoceanic).toBe(true)
    expect(atlantic?.opacity ?? 0).toBeGreaterThan(0.3)
    expect(frame?.routes.some((route) => route.id.includes('pennsylvania->new-jersey'))).toBe(
      false,
    )
    expect(frame?.routes.some((route) => route.id.startsWith('manifest-closing-'))).toBe(true)
  })
})
