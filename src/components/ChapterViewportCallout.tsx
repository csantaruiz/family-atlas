import { useId, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { Search } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  getChapterPresentation,
  type CalloutLayoutProfile,
} from '../utils/chapterPresentation'
import {
  buildConnectorSegmentPaths,
  buildEraBraceHalfPaths,
  computeEraBraceGeometry,
  isCalloutCenterDebugEnabled,
  type ChapterVerticalLayout,
} from '../utils/chapterCalloutLayout'
import type { PlacedSpanCluster, SemanticZoomMode } from '../utils/clustering'
import { useJourneyIntro } from '../context/JourneyIntroContext'

const motionEase = [0.22, 0.8, 0.2, 1] as const

/** Fallback connector start when layout has not been measured yet. */
export const CHAPTER_CALLOUT_ANCHOR_Y = 228

export type CalloutLayoutAnchor = {
  centerX: number
  bottomY: number
  width: number
}

function snapPx(value: number): number {
  return Math.round(value * 2) / 2
}

type PrimaryConnectorProps = {
  cardBottomY: number
  cluster: PlacedSpanCluster
  verticalLayout: ChapterVerticalLayout
  zoomMode: SemanticZoomMode
  braceGradId: string
}

function PrimaryChapterConnector({
  cardBottomY,
  cluster,
  verticalLayout,
  zoomMode,
  braceGradId,
}: PrimaryConnectorProps) {
  const {
    timelineAxisY: axisY,
    chapterCenterX,
    visibleTimeline,
    rangeBracketAxisOffset,
    showEraBrace,
    braceCapDrop,
  } = verticalLayout

  const brace = computeEraBraceGeometry(
    cluster,
    visibleTimeline,
    zoomMode,
    axisY,
    rangeBracketAxisOffset,
    braceCapDrop,
  )

  const bracketY = brace?.bracketY ?? snapPx(axisY - rangeBracketAxisOffset)
  const segments = buildConnectorSegmentPaths(chapterCenterX, cardBottomY, bracketY)
  const { introProgress, isIntroActive } = useJourneyIntro()
  const connectorOffset = isIntroActive ? 1 - introProgress.connector : 0
  const braceOffset = isIntroActive ? 1 - introProgress.brace : 0
  const braceHalves =
    brace && showEraBrace
      ? buildEraBraceHalfPaths(brace.left, brace.right, segments.centerX, brace.bracketY, brace.capDrop)
      : null

  return (
    <g className="chapter-connector-primary">
      <defs>
        {brace && showEraBrace ? (
          <linearGradient
            id={braceGradId}
            gradientUnits="userSpaceOnUse"
            x1={brace.left}
            y1={brace.bracketY}
            x2={brace.right}
            y2={brace.bracketY}
          >
            <stop offset="0%" stopColor="rgb(205, 178, 122)" stopOpacity="0.08" />
            <stop offset="15%" stopColor="rgb(205, 178, 122)" stopOpacity="0.22" />
            <stop offset="40%" stopColor="rgb(205, 178, 122)" stopOpacity="0.48" />
            <stop offset="50%" stopColor="rgb(205, 178, 122)" stopOpacity="0.58" />
            <stop offset="60%" stopColor="rgb(205, 178, 122)" stopOpacity="0.48" />
            <stop offset="85%" stopColor="rgb(205, 178, 122)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="rgb(205, 178, 122)" stopOpacity="0.08" />
          </linearGradient>
        ) : null}
      </defs>

      <path
        className="chapter-connector-upper"
        d={segments.upper}
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={connectorOffset}
        vectorEffect="non-scaling-stroke"
      />

      {brace && showEraBrace && braceHalves ? (
        <>
          <path
            className="chapter-era-brace"
            d={braceHalves.leftHalf}
            stroke={`url(#${braceGradId})`}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={braceOffset}
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="chapter-era-brace"
            d={braceHalves.rightHalf}
            stroke={`url(#${braceGradId})`}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={braceOffset}
            vectorEffect="non-scaling-stroke"
          />
          <circle
            className="chapter-connector-junction-node"
            cx={segments.centerX}
            cy={segments.bracketY}
            r={1.75}
            opacity={isIntroActive ? introProgress.junction : 1}
            vectorEffect="non-scaling-stroke"
          />
        </>
      ) : null}

      {isCalloutCenterDebugEnabled() ? (
        <g className="chapter-center-debug" aria-hidden="true">
          <line
            x1={visibleTimeline.centerX}
            y1={0}
            x2={visibleTimeline.centerX}
            y2={axisY + 24}
            className="chapter-center-debug-line"
          />
          <line
            x1={chapterCenterX}
            y1={cardBottomY - 8}
            x2={chapterCenterX}
            y2={segments.bracketY + 24}
            className="chapter-center-debug-line"
            style={{ stroke: 'rgba(255, 140, 180, 0.75)' }}
          />
          <line
            x1={visibleTimeline.left}
            y1={axisY}
            x2={visibleTimeline.right}
            y2={axisY}
            className="chapter-center-debug-bounds"
          />
          {brace ? (
            <>
              <line
                x1={chapterCenterX - 6}
                y1={brace.bracketY}
                x2={chapterCenterX + 6}
                y2={brace.bracketY}
                className="chapter-center-debug-bounds"
              />
              <line
                x1={chapterCenterX}
                y1={brace.bracketY - 6}
                x2={chapterCenterX}
                y2={brace.bracketY + 6}
                className="chapter-center-debug-bounds"
              />
            </>
          ) : null}
        </g>
      ) : null}
    </g>
  )
}

export function pickPrimaryCluster(
  clusters: PlacedSpanCluster[],
  start: number,
  span: number,
): PlacedSpanCluster | null {
  if (!clusters.length) return null
  const centerYear = start + span / 2

  const containing = clusters.filter((c) => centerYear >= c.from && centerYear <= c.to)
  if (containing.length === 1) return containing[0]
  if (containing.length > 1) {
    return [...containing].sort(
      (a, b) =>
        b.hiddenCount - a.hiddenCount ||
        b.to - b.from - (a.to - a.from) ||
        b.totalCount - a.totalCount,
    )[0]
  }

  return clusters.reduce((best, c) => {
    const mid = (c.from + c.to) / 2
    const bestMid = (best.from + best.to) / 2
    return Math.abs(mid - centerYear) < Math.abs(bestMid - centerYear) ? c : best
  })
}

function measureFrameAnchor(frame: HTMLElement, chapterCenterX: number): CalloutLayoutAnchor | null {
  const stage = frame.closest('.stage')
  if (!stage) return null
  const frameRect = frame.getBoundingClientRect()
  const stageRect = stage.getBoundingClientRect()
  return {
    centerX: snapPx(chapterCenterX),
    bottomY: snapPx(frameRect.bottom - stageRect.top),
    width: snapPx(frameRect.width),
  }
}

type ChapterViewportCalloutProps = {
  cluster: PlacedSpanCluster
  zoomMode: SemanticZoomMode
  totalTimelineStart: number
  totalTimelineEnd: number
  viewportWidth: number
  layout: CalloutLayoutProfile
  verticalLayout: ChapterVerticalLayout
  onZoom: (cluster: PlacedSpanCluster) => void
  frameRef?: RefObject<HTMLDivElement | null>
}

export function ChapterViewportCallout({
  cluster,
  zoomMode,
  totalTimelineStart,
  totalTimelineEnd,
  layout,
  verticalLayout,
  onZoom,
  frameRef: externalFrameRef,
}: ChapterViewportCalloutProps) {
  const localFrameRef = useRef<HTMLDivElement>(null)
  const frameRef = externalFrameRef ?? localFrameRef
  const layerRef = useRef<HTMLDivElement>(null)
  const { chapterCenterX } = verticalLayout

  const presentation = getChapterPresentation({
    title: cluster.title,
    subtitle: cluster.subtitle,
    yearStart: cluster.from,
    yearEnd: cluster.to,
    summary: cluster.summary,
    hiddenCount: cluster.hiddenCount,
    totalCount: cluster.totalCount,
    totalTimelineStart,
    totalTimelineEnd,
    zoomMode,
  })

  const accessibleLabel = presentation.hiddenCountLabel
    ? `${presentation.title} · ${presentation.yearRange} · ${presentation.hiddenCountLabel}`
    : `${presentation.title} · ${presentation.yearRange}`

  const content = (
    <button
      type="button"
      className="chapter-callout"
      title={accessibleLabel}
      aria-label={accessibleLabel}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onZoom(cluster)
      }}
    >
      <span className="chapter-callout-title">{presentation.title}</span>
      <span className="chapter-callout-divider" aria-hidden="true">
        <span className="chapter-callout-divider-rule" />
        <span className="chapter-callout-divider-ornament" />
      </span>
      <span className="chapter-callout-years">{presentation.yearRange}</span>
      {layout.showNarrative && presentation.summary ? (
        <span className="chapter-callout-narrative">{presentation.summary}</span>
      ) : null}
      {layout.showMeta && presentation.hiddenCountLabel ? (
        <span className="chapter-callout-meta">{presentation.hiddenCountLabel}</span>
      ) : null}
      {layout.showCta ? (
        <span className="chapter-callout-cta">
          <Search className="chapter-callout-cta-icon" size={13} strokeWidth={1.75} aria-hidden="true" />
          <span className="chapter-callout-cta-text">{presentation.ctaLabel}</span>
          <span className="chapter-callout-cta-arrow" aria-hidden="true">
            →
          </span>
        </span>
      ) : null}
    </button>
  )

  return (
    <div
      ref={layerRef}
      className={`chapter-callout-layer chapter-callout-layer--${layout.tier} chapter-callout-layer--${zoomMode}`}
      style={{
        top: verticalLayout.cardTop,
        left: chapterCenterX,
        maxWidth: layout.maxWidthPx,
        transform: 'translateX(-50%)',
      }}
    >
      <div className="chapter-callout-halo" aria-hidden="true" />
      <div ref={frameRef} className="chapter-callout-frame">
        <div className="chapter-callout-inner" style={{ opacity: cluster.dissolve }}>
          {content}
        </div>
      </div>
      {isCalloutCenterDebugEnabled() ? (
        <div
          className="chapter-center-debug-card"
          aria-hidden="true"
          style={{ left: '50%' }}
        />
      ) : null}
    </div>
  )
}

type ChapterConnectorLayerProps = {
  clusters: PlacedSpanCluster[]
  primaryCluster: PlacedSpanCluster | null
  verticalLayout: ChapterVerticalLayout
  zoomMode: SemanticZoomMode
  cardAnchor?: CalloutLayoutAnchor | null
}

export function ChapterConnectorLayer({
  clusters,
  primaryCluster,
  verticalLayout,
  zoomMode,
  cardAnchor = null,
}: ChapterConnectorLayerProps) {
  const braceGradId = useId().replace(/:/g, '')

  if (!clusters.length || !primaryCluster) return null

  const ty = snapPx(verticalLayout.timelineAxisY)
  const cardBottomY = cardAnchor?.bottomY ?? CHAPTER_CALLOUT_ANCHOR_Y

  return (
    <svg className="chapter-connector-layer" aria-hidden="true" width="100%" height="100%">
      <PrimaryChapterConnector
        cardBottomY={cardBottomY}
        cluster={primaryCluster}
        verticalLayout={verticalLayout}
        zoomMode={zoomMode}
        braceGradId={braceGradId}
      />

      {clusters.map((cluster) => {
        if (cluster.chapterId === primaryCluster.chapterId) return null

        return (
          <g key={`span-${cluster.chapterId}`} className="chapter-connector-group">
            {cluster.from !== cluster.to && (
              <>
                <line
                  className="chapter-connector-bracket"
                  x1={snapPx(cluster.leftX)}
                  y1={ty}
                  x2={snapPx(cluster.rightX)}
                  y2={ty}
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  className="chapter-connector-cap"
                  x1={snapPx(cluster.leftX)}
                  y1={ty - 4}
                  x2={snapPx(cluster.leftX)}
                  y2={ty + 4}
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  className="chapter-connector-cap"
                  x1={snapPx(cluster.rightX)}
                  y1={ty - 4}
                  x2={snapPx(cluster.rightX)}
                  y2={ty + 4}
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function ChapterCalloutPresence({
  primary,
  clusters,
  verticalLayout,
  zoomMode,
  totalTimelineStart,
  totalTimelineEnd,
  viewportWidth,
  layout,
  motionEnabled,
  onZoom,
}: {
  primary: PlacedSpanCluster | null
  clusters: PlacedSpanCluster[]
  verticalLayout: ChapterVerticalLayout
  zoomMode: SemanticZoomMode
  totalTimelineStart: number
  totalTimelineEnd: number
  viewportWidth: number
  layout: CalloutLayoutProfile
  motionEnabled: boolean
  onZoom: (cluster: PlacedSpanCluster) => void
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [cardAnchor, setCardAnchor] = useState<CalloutLayoutAnchor | null>(null)
  const { introProgress, isIntroActive, completeIntro } = useJourneyIntro()

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame || !primary) {
      setCardAnchor(null)
      return
    }

    const measure = () => {
      const anchor = measureFrameAnchor(frame, verticalLayout.chapterCenterX)
      if (anchor) setCardAnchor(anchor)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [
    primary?.chapterId,
    viewportWidth,
    layout.tier,
    layout.showNarrative,
    layout.showMeta,
    layout.showCta,
    layout.maxWidthPx,
    verticalLayout.cardTop,
    verticalLayout.chapterCenterX,
  ])

  if (!primary) return null

  const callout = (
    <ChapterViewportCallout
      cluster={primary}
      zoomMode={zoomMode}
      totalTimelineStart={totalTimelineStart}
      totalTimelineEnd={totalTimelineEnd}
      viewportWidth={viewportWidth}
      layout={layout}
      verticalLayout={verticalLayout}
      onZoom={(c) => {
        completeIntro()
        onZoom(c)
      }}
      frameRef={frameRef}
    />
  )

  const cardMotionStyle = isIntroActive
    ? {
        opacity: introProgress.card,
        transform: `translateY(${10 * (1 - introProgress.card)}px) scale(${0.99 + 0.01 * introProgress.card})`,
      }
    : undefined

  return (
    <>
      <AnimatePresence mode="wait">
        {motionEnabled ? (
          <motion.div
            key={primary.chapterId}
            className="chapter-callout-presence"
            initial={isIntroActive ? false : { opacity: 0 }}
            animate={isIntroActive ? undefined : { opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: motionEase }}
            style={cardMotionStyle}
          >
            {callout}
          </motion.div>
        ) : (
          <div className="chapter-callout-presence" style={cardMotionStyle}>
            {callout}
          </div>
        )}
      </AnimatePresence>

      <ChapterConnectorLayer
        clusters={clusters}
        primaryCluster={primary}
        verticalLayout={verticalLayout}
        zoomMode={zoomMode}
        cardAnchor={cardAnchor}
      />
    </>
  )
}
