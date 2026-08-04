import { describe, expect, it } from 'vitest'
import { DOCUMENTARY_MANIFEST } from '../data/documentaryManifest'
import { chapterMarkersFromManifest, startedChapterMarkers } from '../core/chapterMarkers'
import { resolveTimeLayer, storyYearAtTime } from '../core/timeLayerDirector'

describe('chapter markers', () => {
  it('lists the first scene of each chapter in order', () => {
    const markers = chapterMarkersFromManifest(DOCUMENTARY_MANIFEST)
    expect(markers.map((m) => m.chapter)).toEqual([
      'Opening',
      'Origins in Cheshire',
      'Spain & Chihuahua',
      'Migration',
      'Convergence',
      'Enter the Atlas',
    ])
    expect(markers[1]?.startMs).toBe(43_200)
  })

  it('only exposes chapter ticks once their chapter has begun', () => {
    const markers = chapterMarkersFromManifest(DOCUMENTARY_MANIFEST)
    expect(startedChapterMarkers(markers, 30_000).map((m) => m.chapter)).toEqual(['Opening'])
    expect(startedChapterMarkers(markers, 150_000).map((m) => m.chapter)).toEqual([
      'Opening',
      'Origins in Cheshire',
      'Spain & Chihuahua',
    ])
  })
})

describe('time layer director', () => {
  it('tracks William Lowndes at 1473 during his scene', () => {
    const layer = resolveTimeLayer(
      DOCUMENTARY_MANIFEST,
      48_000,
      { title: 'William Lowndes', date: '1473', opacity: 1 },
      [
        {
          personId: 'I18150788585',
          displayName: 'William Lowndes',
          year: 1473,
          placeId: 'gawsworth',
          start: 0.12,
          end: 0.92,
        },
      ],
    )

    expect(layer.activeYear).toBe(1473)
    expect(layer.playheadRatio).toBeGreaterThanOrEqual(0)
    expect(layer.playheadRatio).toBeLessThan(0.05)
  })

  it('advances the playhead toward present later in the documentary', () => {
    const early = resolveTimeLayer(DOCUMENTARY_MANIFEST, 12_000, null, [])
    const late = resolveTimeLayer(DOCUMENTARY_MANIFEST, 260_000, null, [])

    expect(early.playheadRatio).toBeLessThan(late.playheadRatio ?? 0)
  })

  it('ends the visible span at the present calendar year', () => {
    const layer = resolveTimeLayer(DOCUMENTARY_MANIFEST, 12_000, null, [])
    expect(layer.rangeEnd).toBe(new Date().getFullYear())
  })

  it('tracks the El Paso migration near the twentieth century, not the origin year', () => {
    const layer = resolveTimeLayer(DOCUMENTARY_MANIFEST, 177_800, null, [])
    expect(layer.activeYear).toBeGreaterThanOrEqual(1930)
    expect(layer.playheadRatio).toBeGreaterThan(0.7)
  })

  it('anchors the playhead to narration years mentioned in the script', () => {
    expect(storyYearAtTime(DOCUMENTARY_MANIFEST, 46_660)).toBe(1473)
    expect(storyYearAtTime(DOCUMENTARY_MANIFEST, 171_820)).toBe(1932)
    expect(storyYearAtTime(DOCUMENTARY_MANIFEST, 297_200)).toBeGreaterThanOrEqual(1975)
  })

  it('never moves the playhead backward as the documentary progresses', () => {
    const samples = [12_000, 48_000, 121_300, 171_820, 177_800, 260_000, 320_000]
    const ratios = samples.map(
      (timeMs) => resolveTimeLayer(DOCUMENTARY_MANIFEST, timeMs, null, []).playheadRatio ?? 0,
    )
    for (let i = 1; i < ratios.length; i += 1) {
      expect(ratios[i]).toBeGreaterThanOrEqual(ratios[i - 1]! - 0.001)
    }
  })
})
