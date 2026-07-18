import { PLOT_EDGE } from './timelineMath'
import type { CalloutLayoutProfile } from './chapterPresentation'
import type { SemanticZoomMode } from './semanticZoom'

/** Shared ratio for the primary timeline axis within the stage. */
export const TIMELINE_AXIS_RATIO = 0.54

/** Minimum top offset to preserve separation from upper story panels. */
export const STORY_PANEL_SAFE_TOP = 20

/** Matches `--story-layer-align-top` in index.css (story-layer-top + 6px). */
export function storyLayerAlignTop(viewportWidth: number): number {
  if (viewportWidth <= 760) return 20
  if (viewportWidth <= 1100) return 28
  return 34
}

/** Side gutter when clamping brace width inside the visible timeline canvas. */
export const TIMELINE_VIEWPORT_GUTTER = 20

export type VisibleTimelineViewport = {
  left: number
  right: number
  width: number
  centerX: number
}

export type ChapterVerticalLayout = {
  timelineAxisY: number
  chapterCenterX: number
  visibleTimeline: VisibleTimelineViewport
  cardTop: number
  rangeBracketAxisOffset: number
  minConnectorHeight: number
  maxConnectorHeight: number
  minCardBottomToAxis: number
  maxCardBottomToAxis: number
  minCardBottomToBrace: number
  showEraBrace: boolean
  braceCapDrop: number
}

type ZoomVerticalSpec = {
  cardTopPreferred: number
  cardTopFloor: number
  cardBottomToAxisMin: number
  cardBottomToAxisTarget: number
  cardBottomToAxisMax: number
  cardBottomToBraceMin: number
  cardBottomToBraceTarget: number
  rangeBracketAxisOffset: number
  rangeBracketAxisOffsetMin: number
  minConnectorHeight: number
  maxConnectorHeight: number
  showEraBrace: boolean
  braceCapDrop: number
}

type BraceWidthSpec = {
  min: number
  preferredRatio: number
  maxRatio: number
  maxPx: number
}

export type EraBraceGeometry = {
  centerX: number
  left: number
  right: number
  displayWidth: number
  bracketY: number
  capDrop: number
  clipLeft: boolean
  clipRight: boolean
}

const ZOOM_VERTICAL: Record<SemanticZoomMode, ZoomVerticalSpec> = {
  far: {
    cardTopPreferred: 36,
    cardTopFloor: 28,
    cardBottomToAxisMin: 170,
    cardBottomToAxisTarget: 225,
    cardBottomToAxisMax: 300,
    cardBottomToBraceMin: 100,
    cardBottomToBraceTarget: 140,
    rangeBracketAxisOffset: 48,
    rangeBracketAxisOffsetMin: 36,
    minConnectorHeight: 125,
    maxConnectorHeight: 290,
    showEraBrace: true,
    braceCapDrop: 18,
  },
  medium: {
    cardTopPreferred: 86,
    cardTopFloor: 72,
    cardBottomToAxisMin: 150,
    cardBottomToAxisTarget: 190,
    cardBottomToAxisMax: 220,
    cardBottomToBraceMin: 90,
    cardBottomToBraceTarget: 120,
    rangeBracketAxisOffset: 56,
    rangeBracketAxisOffsetMin: 44,
    minConnectorHeight: 115,
    maxConnectorHeight: 250,
    showEraBrace: true,
    braceCapDrop: 16,
  },
  near: {
    cardTopPreferred: 48,
    cardTopFloor: 38,
    cardBottomToAxisMin: 118,
    cardBottomToAxisTarget: 142,
    cardBottomToAxisMax: 175,
    cardBottomToBraceMin: 70,
    cardBottomToBraceTarget: 90,
    rangeBracketAxisOffset: 36,
    rangeBracketAxisOffsetMin: 28,
    minConnectorHeight: 92,
    maxConnectorHeight: 185,
    showEraBrace: true,
    braceCapDrop: 14,
  },
  detail: {
    cardTopPreferred: 68,
    cardTopFloor: 56,
    cardBottomToAxisMin: 98,
    cardBottomToAxisTarget: 112,
    cardBottomToAxisMax: 132,
    cardBottomToBraceMin: 0,
    cardBottomToBraceTarget: 0,
    rangeBracketAxisOffset: 0,
    rangeBracketAxisOffsetMin: 0,
    minConnectorHeight: 78,
    maxConnectorHeight: 145,
    showEraBrace: false,
    braceCapDrop: 0,
  },
}

const BRACE_WIDTH: Record<SemanticZoomMode, BraceWidthSpec> = {
  far: { min: 200, preferredRatio: 0.42, maxRatio: 0.55, maxPx: 800 },
  medium: { min: 260, preferredRatio: 0.42, maxRatio: 0.55, maxPx: 720 },
  near: { min: 140, preferredRatio: 0.32, maxRatio: 0.42, maxPx: 520 },
  detail: { min: 0, preferredRatio: 0, maxRatio: 0, maxPx: 0 },
}

function snapPx(value: number): number {
  return Math.round(value * 2) / 2
}

function viewportHeightScale(viewportHeight: number): number {
  return Math.min(1, Math.max(0.55, (viewportHeight - 560) / 420))
}

function scaledValue(min: number, target: number, viewportHeight: number): number {
  const scale = viewportHeightScale(viewportHeight)
  return min + (target - min) * scale
}

/** Visible plot canvas inside the stage (excludes PLOT_EDGE padding). */
export function visibleTimelineViewport(stageWidth: number): VisibleTimelineViewport {
  const left = PLOT_EDGE
  const right = stageWidth - PLOT_EDGE
  const width = Math.max(1, right - left)
  return {
    left,
    right,
    width,
    centerX: snapPx(left + width / 2),
  }
}

/** Single horizontal anchor shared by card, connector, brace, and axis junction. */
export function chapterCenterX(stageWidth: number): number {
  return visibleTimelineViewport(stageWidth).centerX
}

/** Estimate rendered card frame height from layout profile (content-driven). */
export function estimateCardFrameHeight(layout: CalloutLayoutProfile): number {
  let content = 58
  if (layout.tier === 'sparse') content += 4
  if (layout.showNarrative) content += 40
  if (layout.showMeta) content += 20
  if (layout.showCta) content += 28
  return content + 26
}

export function timelineAxisY(viewportHeight: number): number {
  return snapPx(viewportHeight * TIMELINE_AXIS_RATIO)
}

export function resolveChapterVerticalLayout(
  zoomMode: SemanticZoomMode,
  viewportWidth: number,
  viewportHeight: number,
  layout: CalloutLayoutProfile,
): ChapterVerticalLayout {
  const spec = ZOOM_VERTICAL[zoomMode]
  const visibleTimeline = visibleTimelineViewport(viewportWidth)
  const axisY = timelineAxisY(viewportHeight)
  const cardHeight = estimateCardFrameHeight(layout)

  const bracketOffset = snapPx(
    Math.max(
      spec.rangeBracketAxisOffsetMin,
      scaledValue(spec.rangeBracketAxisOffsetMin, spec.rangeBracketAxisOffset, viewportHeight),
    ),
  )

  const targetGap = scaledValue(spec.cardBottomToAxisMin, spec.cardBottomToAxisTarget, viewportHeight)
  const topFromGap = axisY - targetGap - cardHeight
  let cardTop = storyLayerAlignTop(viewportWidth)
  cardTop = Math.min(cardTop, topFromGap)
  cardTop = Math.max(cardTop, STORY_PANEL_SAFE_TOP)

  const maxTop = axisY - spec.cardBottomToAxisMin - cardHeight
  cardTop = Math.min(cardTop, maxTop)

  const shortViewport = viewportHeight < 640
  const resolvedBracketOffset = shortViewport
    ? Math.max(32, bracketOffset - 8)
    : bracketOffset

  return {
    timelineAxisY: axisY,
    chapterCenterX: visibleTimeline.centerX,
    visibleTimeline,
    cardTop: snapPx(cardTop),
    rangeBracketAxisOffset: resolvedBracketOffset,
    minConnectorHeight: spec.minConnectorHeight,
    maxConnectorHeight: spec.maxConnectorHeight,
    minCardBottomToAxis: spec.cardBottomToAxisMin,
    maxCardBottomToAxis: spec.cardBottomToAxisMax,
    minCardBottomToBrace: spec.cardBottomToBraceMin,
    showEraBrace: spec.showEraBrace,
    braceCapDrop: spec.braceCapDrop,
  }
}

export function computeEraBraceGeometry(
  cluster: { leftX: number; rightX: number },
  visibleTimeline: VisibleTimelineViewport,
  zoomMode: SemanticZoomMode,
  axisY: number,
  bracketAxisOffset: number,
  capDrop: number,
): EraBraceGeometry | null {
  const spec = BRACE_WIDTH[zoomMode]
  if (!ZOOM_VERTICAL[zoomMode].showEraBrace || spec.min <= 0) return null

  const centerX = visibleTimeline.centerX
  const trueWidth = Math.abs(cluster.rightX - cluster.leftX)
  const gutter = TIMELINE_VIEWPORT_GUTTER

  let displayWidth = Math.max(spec.min, trueWidth > 1 ? trueWidth : spec.min)
  displayWidth = Math.max(displayWidth, visibleTimeline.width * spec.preferredRatio)
  displayWidth = Math.min(displayWidth, visibleTimeline.width * spec.maxRatio, spec.maxPx)

  const maxSymmetric = visibleTimeline.width - gutter * 2
  displayWidth = Math.min(displayWidth, maxSymmetric)

  const half = displayWidth / 2
  const left = snapPx(centerX - half)
  const right = snapPx(centerX + half)
  const bracketY = snapPx(axisY - bracketAxisOffset)

  return {
    centerX,
    left,
    right,
    displayWidth,
    bracketY,
    capDrop,
    clipLeft: left <= visibleTimeline.left + gutter,
    clipRight: right >= visibleTimeline.right - gutter,
  }
}

/** Curved-end era brace path — horizontal span with downward end caps. */
export function buildEraBracePath(
  left: number,
  right: number,
  bracketY: number,
  capDrop: number,
): string {
  const y = snapPx(bracketY)
  const drop = snapPx(capDrop)
  const capW = snapPx(Math.min(22, Math.max(12, (right - left) * 0.04)))
  const l = snapPx(left)
  const r = snapPx(right)

  return [
    `M ${l} ${y + drop}`,
    `Q ${l} ${y} ${l + capW} ${y}`,
    `L ${r - capW} ${y}`,
    `Q ${r} ${y} ${r} ${y + drop}`,
  ].join(' ')
}

/** Symmetric left/right brace halves for center-outward reveal. */
export function buildEraBraceHalfPaths(
  left: number,
  right: number,
  centerX: number,
  bracketY: number,
  capDrop: number,
): { leftHalf: string; rightHalf: string } {
  const y = snapPx(bracketY)
  const drop = snapPx(capDrop)
  const capW = snapPx(Math.min(22, Math.max(12, (right - left) * 0.04)))
  const cx = snapPx(centerX)
  const l = snapPx(left)
  const r = snapPx(right)

  const leftHalf = [`M ${cx} ${y}`, `L ${l + capW} ${y}`, `Q ${l} ${y} ${l} ${y + drop}`].join(' ')
  const rightHalf = [`M ${cx} ${y}`, `L ${r - capW} ${y}`, `Q ${r} ${y} ${r} ${y + drop}`].join(' ')

  return { leftHalf, rightHalf }
}

export type ConnectorSegmentPaths = {
  upper: string
  centerX: number
  bracketY: number
}

export function buildConnectorSegmentPaths(
  centerX: number,
  cardBottomY: number,
  bracketY: number,
): ConnectorSegmentPaths {
  const cx = snapPx(centerX)
  const cy = snapPx(cardBottomY - 1)
  const by = snapPx(bracketY)

  return {
    upper: `M ${cx} ${cy} L ${cx} ${by}`,
    centerX: cx,
    bracketY: by,
  }
}

export function isCalloutCenterDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('calloutDebug') === '1'
}

/** Legacy export — medium-zoom default before layout resolver. */
export const CHAPTER_CALLOUT_TOP_LEGACY = 76
