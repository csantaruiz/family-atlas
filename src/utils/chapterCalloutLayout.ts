import type { CalloutLayoutProfile } from './chapterPresentation'
import type { SemanticZoomMode } from './semanticZoom'
import {
  DESKTOP_AXIS_RATIO,
  plotEdgeForWidth,
  timelineAxisRatioForStage,
} from './stageBreakpoints'

/** Shared ratio for the primary timeline axis within the stage (desktop default). */
export const TIMELINE_AXIS_RATIO = DESKTOP_AXIS_RATIO

/** Raise chapter plaque slightly above layout-derived anchor. */
export const CHAPTER_PLAQUE_TOP_OFFSET_PX = 20

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

const PLAQUE_VERTICAL: ZoomVerticalSpec = {
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
}

/** Plaque chrome stays fixed; only the era brace width still tracks zoom. */
const ZOOM_VERTICAL: Record<SemanticZoomMode, ZoomVerticalSpec> = {
  far: PLAQUE_VERTICAL,
  medium: PLAQUE_VERTICAL,
  near: PLAQUE_VERTICAL,
  detail: {
    ...PLAQUE_VERTICAL,
    // Detail still draws a brace when the chapter spans a readable width.
    showEraBrace: true,
  },
}

const BRACE_WIDTH: Record<SemanticZoomMode, BraceWidthSpec> = {
  far: { min: 200, preferredRatio: 0.42, maxRatio: 0.55, maxPx: 800 },
  medium: { min: 200, preferredRatio: 0.42, maxRatio: 0.55, maxPx: 800 },
  near: { min: 200, preferredRatio: 0.42, maxRatio: 0.55, maxPx: 800 },
  detail: { min: 200, preferredRatio: 0.42, maxRatio: 0.55, maxPx: 800 },
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

/** Visible plot canvas inside the stage (excludes plot-edge padding). */
export function visibleTimelineViewport(stageWidth: number): VisibleTimelineViewport {
  const edge = plotEdgeForWidth(stageWidth)
  const left = edge
  const right = stageWidth - edge
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

/** Generous height used only to keep the plaque clear of the timeline axis. */
export const PLAQUE_LAYOUT_MAX_HEIGHT_PX = 280

/** Estimate rendered card frame height from layout profile (hint fallback only). */
export function estimateCardFrameHeight(layout: CalloutLayoutProfile): number {
  let content = 110
  if (layout.showNarrative) content += 52
  if (layout.showMeta) content += 22
  if (layout.showCta) content += 56
  return content + 40
}

export type MeasuredPlaqueAnchor = {
  centerX: number
  bottomY: number
  width: number
}

export function timelineAxisY(viewportHeight: number, viewportWidth = 1200): number {
  return snapPx(viewportHeight * timelineAxisRatioForStage(viewportWidth, viewportHeight))
}

export function resolveChapterVerticalLayout(
  zoomMode: SemanticZoomMode,
  viewportWidth: number,
  viewportHeight: number,
  _layout?: CalloutLayoutProfile,
): ChapterVerticalLayout {
  const spec = ZOOM_VERTICAL[zoomMode]
  const visibleTimeline = visibleTimelineViewport(viewportWidth)
  const axisY = timelineAxisY(viewportHeight, viewportWidth)

  const bracketOffset = snapPx(
    Math.max(
      spec.rangeBracketAxisOffsetMin,
      scaledValue(spec.rangeBracketAxisOffsetMin, spec.rangeBracketAxisOffset, viewportHeight),
    ),
  )

  const preferredTop = scaledValue(spec.cardTopFloor, spec.cardTopPreferred, viewportHeight)
  let cardTop = Math.max(STORY_PANEL_SAFE_TOP, storyLayerAlignTop(viewportWidth), preferredTop)
  const maxTop = axisY - spec.cardBottomToAxisMin - PLAQUE_LAYOUT_MAX_HEIGHT_PX
  cardTop = Math.min(cardTop, maxTop)

  const shortViewport = viewportHeight < 640
  const resolvedBracketOffset = shortViewport
    ? Math.max(32, bracketOffset - 8)
    : bracketOffset

  return {
    timelineAxisY: axisY,
    chapterCenterX: visibleTimeline.centerX,
    visibleTimeline,
    cardTop: snapPx(Math.max(STORY_PANEL_SAFE_TOP, cardTop - CHAPTER_PLAQUE_TOP_OFFSET_PX)),
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

export function buildCalloutFrameBorderPath(
  width: number,
  height: number,
  inset = 0,
  bevel = 12,
): string {
  const left = inset
  const top = inset
  const right = width - inset
  const bottom = height - inset
  const chamfer = Math.max(0, bevel - inset)

  if (right - left <= chamfer * 2 || bottom - top <= chamfer) {
    return `M ${snapPx(left)} ${snapPx(top)} H ${snapPx(right)} V ${snapPx(bottom)} H ${snapPx(left)} Z`
  }

  return [
    `M ${snapPx(left)} ${snapPx(top)}`,
    `H ${snapPx(right)}`,
    `V ${snapPx(bottom - chamfer)}`,
    `L ${snapPx(right - chamfer)} ${snapPx(bottom)}`,
    `H ${snapPx(left + chamfer)}`,
    `L ${snapPx(left)} ${snapPx(bottom - chamfer)}`,
    'Z',
  ].join(' ')
}

export function isCalloutCenterDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('calloutDebug') === '1'
}

/** Legacy export — medium-zoom default before layout resolver. */
export const CHAPTER_CALLOUT_TOP_LEGACY = 76

/** Matches `--story-sidenote-width` and `--story-plaque-gap` in index.css. */
const STORY_SIDENOTE_WIDTH_PX = 340
const STORY_PLAQUE_GAP_PX = 60

function calloutPlaqueHalfPx(viewportWidth: number): number {
  return Math.min(260, Math.max(160, viewportWidth * 0.29))
}

export type EditorialObstacle = {
  left: number
  right: number
  top: number
  bottom: number
}

/** Reserved screen bands for Featured Story (left) and Atlas Thinking (right). */
export function estimateEditorialSidenoteObstacles(viewportWidth: number): EditorialObstacle[] {
  if (viewportWidth <= 760) return []

  const alignTop = storyLayerAlignTop(viewportWidth)
  const plaqueHalf = calloutPlaqueHalfPx(viewportWidth)
  const sidenoteWidth = Math.min(STORY_SIDENOTE_WIDTH_PX, viewportWidth - 24)
  // Header + title + 2-line narrative + CTA — keep events clear of this band.
  const panelBottom = alignTop + 248

  const featuredRight = viewportWidth / 2 - plaqueHalf - STORY_PLAQUE_GAP_PX
  const featuredLeft = Math.max(12, featuredRight - sidenoteWidth)

  const thinkingLeft = viewportWidth / 2 + plaqueHalf + STORY_PLAQUE_GAP_PX
  const thinkingRight = Math.min(viewportWidth - 12, thinkingLeft + sidenoteWidth)

  return [
    { left: featuredLeft, right: featuredRight, top: alignTop, bottom: panelBottom },
    { left: thinkingLeft, right: thinkingRight, top: alignTop, bottom: panelBottom },
  ]
}
