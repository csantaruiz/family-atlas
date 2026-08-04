import { describe, expect, it } from 'vitest'
import {
  DESKTOP_PLOT_EDGE,
  NARROW_PLOT_EDGE,
  isNarrowStage,
  plotEdgeForWidth,
  stageLayoutProfile,
  timelineAxisRatioForStage,
} from './stageBreakpoints'
import { yearX } from './timelineMath'
import { maxFamilyEventsForSpan, targetVisibleEventCount } from './landmarkSelection'
import { timelineAxisY } from './chapterCalloutLayout'

describe('stageBreakpoints', () => {
  it('treats ≤760 as narrow', () => {
    expect(isNarrowStage(760)).toBe(true)
    expect(isNarrowStage(761)).toBe(false)
  })

  it('shrinks plot edge and axis ratio on narrow/short stages', () => {
    expect(plotEdgeForWidth(1400)).toBe(DESKTOP_PLOT_EDGE)
    expect(plotEdgeForWidth(390)).toBe(NARROW_PLOT_EDGE)
    expect(timelineAxisRatioForStage(1400, 800)).toBeGreaterThan(
      timelineAxisRatioForStage(390, 700),
    )
  })

  it('keeps yearX inside the narrow canvas', () => {
    const width = 390
    const edge = plotEdgeForWidth(width)
    const xStart = yearX(1800, 1800, 100, width)
    const xEnd = yearX(1900, 1800, 100, width)
    expect(xStart).toBeCloseTo(edge, 5)
    expect(xEnd).toBeCloseTo(width - edge, 5)
  })

  it('lowers density budgets on narrow stages', () => {
    expect(maxFamilyEventsForSpan(100, 1400)).toBeGreaterThan(
      maxFamilyEventsForSpan(100, 390),
    )
    expect(targetVisibleEventCount('dense', 'near', 20, 1400)).toBeGreaterThan(
      targetVisibleEventCount('dense', 'near', 20, 390),
    )
    expect(stageLayoutProfile(390, 800).familyEventCap(6)).toBeLessThanOrEqual(4)
  })

  it('moves the axis slightly on narrow stages', () => {
    expect(timelineAxisY(700, 390)).toBeLessThan(timelineAxisY(700, 1400))
  })
})
