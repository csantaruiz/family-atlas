import { describe, expect, it } from 'vitest'
import { familyDatabase } from '../data/familyDatabase'
import { buildFamilyEvents } from '../data/buildFamilyEvents'
import {
  eventImportanceScore,
  foldSpatiallyConflictingEvents,
  layoutBirthClustersProgressive,
  buildBirthClusters,
  showBirthPeriodClusters,
  layoutFamilyEventsProgressive,
  targetVisibleEventCount,
} from './clustering'
import {
  estimateCalloutObstacle,
  placeHybridLandmarks,
  selectDistributedLandmarks,
} from './landmarkSelection'
import { chapterDensity, semanticZoomMode } from './semanticZoom'
import { zoomMode } from './timelineMath'
import { buildStoryChaptersForViewport } from '../data/buildStoryChapters'
import { timelineAxisY } from './chapterCalloutLayout'
import { resetLandmarkStability } from './landmarkSelectionStability'

describe('timeline space utilization', () => {
  const events = buildFamilyEvents(familyDatabase.people)
  const earliest = familyDatabase.stats.earliestYear
  const present = 2026
  const fullSpan = present - earliest
  const width = 1400
  const height = 700

  it('classifies century views by rate, not raw event count', () => {
    const visible = events.filter((e) => e.year >= earliest && e.year <= present)
    expect(chapterDensity(visible, earliest, present)).not.toBe('very_dense')
  })

  it('spreads far-view landmarks across eras instead of clustering the present', () => {
    const start = earliest
    const end = present
    const span = end - start
    const visible = events.filter((e) => e.year >= start && e.year <= end)
    const chapters = buildStoryChaptersForViewport(
      visible,
      start,
      end,
      span,
      earliest,
      present,
      12,
      fullSpan,
    )
    const density = chapterDensity(visible, start, end)
    const semantic = semanticZoomMode(span, fullSpan)
    expect(semantic).toBe('far')
    const scoreOf = (e: (typeof visible)[0]) =>
      eventImportanceScore(e, chapters, earliest, familyDatabase.root)
    const obstacle = estimateCalloutObstacle(
      chapters,
      start,
      span,
      width,
      timelineAxisY(height, width),
      semantic,
      height,
    )
    const selected = selectDistributedLandmarks(
      visible,
      start,
      end,
      span,
      width,
      semantic,
      scoreOf,
      obstacle,
    )
    const target = targetVisibleEventCount(density, semantic, visible.length, width, span)
    expect(selected.length).toBeGreaterThanOrEqual(Math.min(7, target))

    const years = selected.map((e) => e.year).sort((a, b) => a - b)
    expect(years[years.length - 1] - years[0]).toBeGreaterThan(span * 0.45)

    const left = selected.filter((e) => (e.year - start) / span < 0.33).length
    const right = selected.filter((e) => (e.year - start) / span >= 0.66).length
    expect(left).toBeGreaterThanOrEqual(1)
    expect(right).toBeGreaterThanOrEqual(1)

    const { placed } = placeHybridLandmarks(
      selected,
      visible,
      start,
      span,
      width,
      height,
      obstacle,
      scoreOf,
      semantic,
    )
    expect(placed.length).toBeGreaterThanOrEqual(5)

    const folded = foldSpatiallyConflictingEvents(
      placed.map((p) => ({ event: p.event, x: p.x, y: p.y })),
      span,
      width,
      height,
    )
    expect(folded.events.length + folded.clusters.length).toBeGreaterThanOrEqual(5)
    expect(folded.clusters.every((c) => c.to - c.from < span * 0.2)).toBe(true)
  })

  it('fills independence-range views with more than a handful of family markers', () => {
    const start = 1686
    const end = 1819
    const span = end - start
    const visible = events.filter((e) => e.year >= start && e.year <= end)
    expect(showBirthPeriodClusters(span)).toBe(false)

    const layout = layoutFamilyEventsProgressive(
      visible,
      start,
      end,
      span,
      width,
      height,
      zoomMode(span),
      fullSpan,
      earliest,
      familyDatabase.root,
      present,
      null,
    )
    expect(layout.events.length).toBeGreaterThanOrEqual(5)
    const folded = foldSpatiallyConflictingEvents(
      layout.events.map((e) => ({ ...e })),
      span,
      width,
      height,
    )
    // Same-year stacks may fold into one badge; still need several markers on the axis.
    expect(folded.events.length + folded.clusters.length).toBeGreaterThanOrEqual(4)
  })

  it('fills generation-scale near views with far-like density', () => {
    resetLandmarkStability()
    const start = 1714
    const end = 1791
    const span = end - start
    const visible = events.filter((e) => e.year >= start && e.year <= end)
    const layout = layoutFamilyEventsProgressive(
      visible,
      start,
      end,
      span,
      width,
      height,
      zoomMode(span),
      fullSpan,
      earliest,
      familyDatabase.root,
      present,
      null,
    )
    const folded = foldSpatiallyConflictingEvents(
      layout.events.map((e) => ({ ...e })),
      span,
      width,
      height,
    )
    const markers = folded.events.length + folded.clusters.length
    expect(markers).toBeGreaterThanOrEqual(5)
    const years = [
      ...folded.events.map((e) => e.event.year),
      ...folded.clusters.map((c) => (c.from + c.to) / 2),
    ]
    expect(Math.max(...years) - Math.min(...years)).toBeGreaterThan(span * 0.35)
  })

  it('fills decade-scale views instead of leaving a nearly empty axis', () => {
    resetLandmarkStability()
    const start = 1740
    const end = 1780
    const span = end - start
    const visible = events.filter((e) => e.year >= start && e.year <= end)
    const layout = layoutFamilyEventsProgressive(
      visible,
      start,
      end,
      span,
      width,
      height,
      zoomMode(span),
      fullSpan,
      earliest,
      familyDatabase.root,
      present,
      null,
    )
    const folded = foldSpatiallyConflictingEvents(
      layout.events.map((e) => ({ ...e })),
      span,
      width,
      height,
    )
    expect(folded.events.length + folded.clusters.length).toBeGreaterThanOrEqual(4)
  })

  it('renders multiple landmarks on the default full-span far layout', () => {
    const start = earliest
    const end = present
    const span = end - start
    const visible = events.filter((e) => e.year >= start && e.year <= end)
    const bc = buildBirthClusters(
      familyDatabase.people.filter((p) => p.birthYear),
      start,
      end,
      span,
      width,
      height,
      present,
    )
    const layout = layoutBirthClustersProgressive(
      bc,
      visible,
      start,
      end,
      span,
      width,
      height,
      fullSpan,
      earliest,
      familyDatabase.root,
      present,
      null,
    )
    const folded = foldSpatiallyConflictingEvents(
      layout.events.map((e) => ({ ...e })),
      span,
      width,
      height,
    )
    expect(folded.events.length + folded.clusters.length).toBeGreaterThanOrEqual(5)
    const years = [
      ...folded.events.map((e) => e.event.year),
      ...folded.clusters.map((c) => (c.from + c.to) / 2),
    ]
    expect(Math.max(...years) - Math.min(...years)).toBeGreaterThan(span * 0.4)
  })
})
