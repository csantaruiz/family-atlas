/** Shared stage layout breakpoints — keep in sync with media queries in index.css. */

export const NARROW_STAGE_MAX_WIDTH = 760
/** iPad portrait/landscape and similar tablets (above phone, below desktop). */
export const TABLET_STAGE_MAX_WIDTH = 1180
export const SHORT_STAGE_MAX_HEIGHT = 640

/** Desktop plot gutter (yearX / visible canvas). */
export const DESKTOP_PLOT_EDGE = 72
/** Narrow gutter so markers can reflow without a mobile redesign. */
export const NARROW_PLOT_EDGE = 36
/** Tablet keeps a middle gutter — room for sidenotes without phone compression. */
export const TABLET_PLOT_EDGE = 48

export const DESKTOP_AXIS_RATIO = 0.62
/** Slightly higher family band on short/narrow stages. */
export const NARROW_AXIS_RATIO = 0.58
export const TABLET_AXIS_RATIO = 0.6

export function isNarrowStage(width: number): boolean {
  return width <= NARROW_STAGE_MAX_WIDTH
}

export function isTabletStage(width: number): boolean {
  return width > NARROW_STAGE_MAX_WIDTH && width <= TABLET_STAGE_MAX_WIDTH
}

/** Phone or tablet — use compact labels and tighter density budgets. */
export function isCompactStage(width: number): boolean {
  return isNarrowStage(width) || isTabletStage(width)
}

export function isShortStage(height: number): boolean {
  return height < SHORT_STAGE_MAX_HEIGHT
}

export function plotEdgeForWidth(width: number): number {
  if (isNarrowStage(width)) return NARROW_PLOT_EDGE
  if (isTabletStage(width)) return TABLET_PLOT_EDGE
  return DESKTOP_PLOT_EDGE
}

export function timelineAxisRatioForStage(width: number, height: number): number {
  if (isNarrowStage(width) || isShortStage(height)) return NARROW_AXIS_RATIO
  if (isTabletStage(width)) return TABLET_AXIS_RATIO
  return DESKTOP_AXIS_RATIO
}

/** Floor for family label anchors so short stages keep markers below chrome. */
export function familyLabelFloorY(width: number, height: number): number {
  if (isNarrowStage(width) || isShortStage(height)) return 112
  if (isTabletStage(width)) return 140
  return 168
}

export type StageLayoutProfile = {
  isNarrow: boolean
  isTablet: boolean
  isShort: boolean
  plotEdge: number
  axisRatio: number
  forceCompactLabels: boolean
  maxHybridLanes: number
  familyEventCap: (spanCap: number) => number
  historyEventCap: (spanCap: number) => number
}

export function stageLayoutProfile(width: number, height: number): StageLayoutProfile {
  const isNarrow = isNarrowStage(width)
  const isTablet = isTabletStage(width)
  const isShort = isShortStage(height)
  return {
    isNarrow,
    isTablet,
    isShort,
    plotEdge: plotEdgeForWidth(width),
    axisRatio: timelineAxisRatioForStage(width, height),
    forceCompactLabels: isNarrow || isTablet,
    maxHybridLanes: isNarrow ? 4 : isTablet ? 5 : 7,
    familyEventCap: (spanCap) => {
      if (isNarrow) return Math.max(3, Math.min(spanCap, spanCap > 5 ? spanCap - 2 : spanCap - 1))
      if (isTablet) return Math.max(4, Math.min(spanCap, spanCap > 6 ? spanCap - 2 : spanCap - 1))
      return spanCap
    },
    historyEventCap: (spanCap) => {
      if (isNarrow) return Math.max(3, Math.min(spanCap, Math.round(spanCap * 0.55)))
      if (isTablet) return Math.max(4, Math.min(spanCap, Math.round(spanCap * 0.7)))
      return spanCap
    },
  }
}
