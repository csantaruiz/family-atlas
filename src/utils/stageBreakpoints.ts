/** Shared stage layout breakpoints — keep in sync with `@media (max-width: 760px)` in index.css. */

export const NARROW_STAGE_MAX_WIDTH = 760
export const SHORT_STAGE_MAX_HEIGHT = 640

/** Desktop plot gutter (yearX / visible canvas). */
export const DESKTOP_PLOT_EDGE = 72
/** Narrow gutter so markers can reflow without a mobile redesign. */
export const NARROW_PLOT_EDGE = 36

export const DESKTOP_AXIS_RATIO = 0.62
/** Slightly higher family band on short/narrow stages. */
export const NARROW_AXIS_RATIO = 0.58

export function isNarrowStage(width: number): boolean {
  return width <= NARROW_STAGE_MAX_WIDTH
}

export function isShortStage(height: number): boolean {
  return height < SHORT_STAGE_MAX_HEIGHT
}

export function plotEdgeForWidth(width: number): number {
  return isNarrowStage(width) ? NARROW_PLOT_EDGE : DESKTOP_PLOT_EDGE
}

export function timelineAxisRatioForStage(width: number, height: number): number {
  if (isNarrowStage(width) || isShortStage(height)) return NARROW_AXIS_RATIO
  return DESKTOP_AXIS_RATIO
}

/** Floor for family label anchors so short stages keep markers below chrome. */
export function familyLabelFloorY(width: number, height: number): number {
  if (isNarrowStage(width) || isShortStage(height)) return 112
  return 168
}

export type StageLayoutProfile = {
  isNarrow: boolean
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
  const isShort = isShortStage(height)
  return {
    isNarrow,
    isShort,
    plotEdge: plotEdgeForWidth(width),
    axisRatio: timelineAxisRatioForStage(width, height),
    forceCompactLabels: isNarrow,
    maxHybridLanes: isNarrow ? 4 : 7,
    familyEventCap: (spanCap) =>
      isNarrow ? Math.max(3, Math.min(spanCap, spanCap > 5 ? spanCap - 2 : spanCap - 1)) : spanCap,
    historyEventCap: (spanCap) =>
      isNarrow ? Math.max(3, Math.min(spanCap, Math.round(spanCap * 0.55))) : spanCap,
  }
}
