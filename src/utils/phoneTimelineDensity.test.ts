import { describe, expect, it } from 'vitest'
import {
  aggregatePhoneUnlabeledMarkers,
  clampLabelNudge,
  defaultTimelineSpan,
  groupUnlabeledMarkers,
  leftoverUnlabeledLayout,
  phoneFamilyLabelBudget,
  phoneFamilyLaneOffsets,
  phoneHistoryLabelBudget,
  phoneHistoryLaneOffsets,
  phoneLabelPlacement,
} from './phoneTimelineDensity'

describe('phone timeline density', () => {
  it('does not change the desktop default span', () => {
    expect(defaultTimelineSpan(553, 1400)).toBe(553)
  })

  it('starts the phone on a 100–150 year chapter', () => {
    const span = defaultTimelineSpan(553, 390)
    expect(span).toBeGreaterThanOrEqual(100)
    expect(span).toBeLessThanOrEqual(150)
  })

  it('keeps about 1–2 family labels per visible century at 390px', () => {
    const chapter = phoneFamilyLabelBudget(130, 390)
    expect(chapter).toBeGreaterThanOrEqual(2)
    expect(chapter).toBeLessThanOrEqual(3)
    expect(phoneFamilyLabelBudget(130, 1400)).toBe(Number.POSITIVE_INFINITY)
  })

  it('keeps a single nearby world-history label on a phone chapter view', () => {
    expect(phoneHistoryLabelBudget(130, 390)).toBe(1)
    expect(phoneHistoryLabelBudget(80, 390)).toBeLessThanOrEqual(2)
  })

  it('uses 2–3 family label lanes on phone', () => {
    expect(phoneFamilyLaneOffsets(130).length).toBeGreaterThanOrEqual(2)
    expect(phoneFamilyLaneOffsets(130).length).toBeLessThanOrEqual(3)
    expect(phoneFamilyLaneOffsets(40).length).toBe(3)
  })

  it('keeps phone history diamonds below the year band', () => {
    expect(Math.min(...phoneHistoryLaneOffsets(130))).toBeGreaterThanOrEqual(32)
    expect(Math.min(...phoneHistoryLaneOffsets(80))).toBeGreaterThanOrEqual(32)
  })

  it('clusters leftover markers that share a pixel column', () => {
    const groups = groupUnlabeledMarkers(
      [
        { item: 'a', x: 40 },
        { item: 'b', x: 48 },
        { item: 'c', x: 160 },
      ],
      18,
    )
    expect(groups).toHaveLength(2)
    expect(groups[0].items).toHaveLength(2)
    expect(groups[1].items).toHaveLength(1)
  })

  it('numbers only a few crowded regions instead of every leftover column', () => {
    const items = Array.from({ length: 40 }, (_, i) => ({
      item: `e${i}`,
      x: 20 + (i % 12) * 28 + Math.floor(i / 12) * 8,
    }))
    const layout = aggregatePhoneUnlabeledMarkers(items, 390)
    expect(layout.clusters.length).toBeLessThanOrEqual(2)
    expect(layout.clusters.every((cluster) => cluster.items.length >= 3)).toBe(true)
  })

  it('nudges labels back inside the viewport without moving the marker year', () => {
    expect(clampLabelNudge(12, 160, 390)).toBeGreaterThan(0)
    expect(clampLabelNudge(380, 160, 390)).toBeLessThan(0)
    expect(clampLabelNudge(200, 160, 390)).toBe(0)
  })

  it('aligns labels to the near edge instead of clipping them', () => {
    expect(phoneLabelPlacement(20, 160, 390).align).toBe('left')
    expect(phoneLabelPlacement(370, 160, 390).align).toBe('right')
    expect(phoneLabelPlacement(195, 120, 390).align).toBe('center')
  })

  it('does not synthesize leftover unlabeled clusters on desktop widths', () => {
    const items = Array.from({ length: 40 }, (_, i) => ({
      item: `e${i}`,
      x: 40 + i * 20,
    }))
    expect(leftoverUnlabeledLayout(items, 1440)).toEqual({ ticks: [], clusters: [] })
    expect(leftoverUnlabeledLayout(items, 1920)).toEqual({ ticks: [], clusters: [] })
    expect(leftoverUnlabeledLayout(items, 1280)).toEqual({ ticks: [], clusters: [] })
    expect(leftoverUnlabeledLayout(items, 1181)).toEqual({ ticks: [], clusters: [] })
    expect(leftoverUnlabeledLayout(items, 1024)).toEqual({ ticks: [], clusters: [] })
    const phone = leftoverUnlabeledLayout(items, 390)
    expect(phone.ticks.length + phone.clusters.length).toBeGreaterThan(0)
  })
})
