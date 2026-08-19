import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from 'react'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { resolveChapterPlaqueBackground } from '../data/chapterPlaqueImagery'
import {
  getChapterPresentation,
  type CalloutLayoutProfile,
} from '../utils/chapterPresentation'
import {
  buildCalloutFrameBorderPath,
  buildConnectorSegmentPaths,
  buildEraBraceHalfPaths,
  computeEraBraceGeometry,
  isCalloutCenterDebugEnabled,
  type ChapterVerticalLayout,
} from '../utils/chapterCalloutLayout'
import type { PlacedSpanCluster, SemanticZoomMode } from '../utils/clustering'
import { useJourneyIntro } from '../context/JourneyIntroContext'
import { TimelineHint } from './TimelineHint'

const motionEase = [0.22, 0.8, 0.2, 1] as const
const CALLOUT_CROSSFADE_S = 0.58
/** Target opacity for plaque scenery images (matches CSS resting state). */
const CALLOUT_SCENERY_OPACITY = 0.32

const calloutCrossfadeTransition = { duration: CALLOUT_CROSSFADE_S, ease: motionEase }

/** Content/scenery only — never fade the plaque chrome or --callout-vivid. */
const calloutContentCrossfade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
} as const

const calloutSceneryCrossfade = {
  initial: { opacity: 0 },
  animate: { opacity: CALLOUT_SCENERY_OPACITY },
  exit: { opacity: 0 },
} as const

const connectorCrossfade = {
  initial: { opacity: 0, '--connector-vivid': 0 },
  animate: { opacity: 1, '--connector-vivid': 1 },
  exit: { opacity: 0, '--connector-vivid': 0 },
} as const

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

type CalloutFrameBorderProps = {
  frameRef: RefObject<HTMLDivElement | null>
}

function ChapterCalloutFrameBorder({ frameRef }: CalloutFrameBorderProps) {
  const [border, setBorder] = useState<{
    width: number
    height: number
    outer: string
    inner: string
  } | null>(null)

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    const measure = () => {
      const rect = frame.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        setBorder(null)
        return
      }

      const width = snapPx(rect.width)
      const height = snapPx(rect.height)
      const bevel = Number.parseFloat(getComputedStyle(frame).getPropertyValue('--bevel')) || 12

      setBorder({
        width,
        height,
        outer: buildCalloutFrameBorderPath(width, height, 0.5, bevel),
        inner: buildCalloutFrameBorderPath(width, height, 1.5, bevel),
      })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [frameRef])

  if (!border) return null

  return (
    <svg
      className="chapter-callout-frame-border"
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox={`0 0 ${border.width} ${border.height}`}
      preserveAspectRatio="none"
    >
      <path className="chapter-callout-frame-border-outer" d={border.outer} vectorEffect="non-scaling-stroke" />
      <path className="chapter-callout-frame-border-inner" d={border.inner} vectorEffect="non-scaling-stroke" />
    </svg>
  )
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
  if (!isCalloutCenterDebugEnabled()) return null

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
  onZoomIn: (cluster: PlacedSpanCluster) => void
  onZoomOut: (cluster: PlacedSpanCluster) => void
  canZoomIn: boolean
  canZoomOut: boolean
  isWideTimelineView: boolean
  onScrollPrev: () => void
  onScrollNext: () => void
  canScrollPrev: boolean
  canScrollNext: boolean
  showScrollChevrons: boolean
  motionEnabled?: boolean
  frameRef?: RefObject<HTMLDivElement | null>
}

export function ChapterViewportCallout({
  cluster,
  zoomMode,
  totalTimelineStart,
  totalTimelineEnd,
  layout,
  verticalLayout,
  onZoomIn,
  onZoomOut,
  canZoomIn,
  canZoomOut,
  isWideTimelineView,
  onScrollPrev,
  onScrollNext,
  canScrollPrev,
  canScrollNext,
  showScrollChevrons,
  motionEnabled = false,
  frameRef: externalFrameRef,
}: ChapterViewportCalloutProps) {
  const localFrameRef = useRef<HTMLDivElement>(null)
  const frameRef = externalFrameRef ?? localFrameRef
  const layerRef = useRef<HTMLDivElement>(null)
  const { chapterCenterX } = verticalLayout
  const { isIntroActive } = useJourneyIntro()
  const prefersReducedMotion = useReducedMotion()
  const [zoomCtaPulseReady, setZoomCtaPulseReady] = useState(false)

  useEffect(() => {
    if (!isWideTimelineView || isIntroActive || prefersReducedMotion === true) {
      setZoomCtaPulseReady(false)
      return
    }
    const timer = window.setTimeout(() => setZoomCtaPulseReady(true), 320)
    return () => window.clearTimeout(timer)
  }, [isWideTimelineView, isIntroActive, prefersReducedMotion])

  const handleScrollPrev = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canScrollPrev) return
    onScrollPrev()
  }

  const handleScrollNext = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canScrollNext) return
    onScrollNext()
  }

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

  const plaqueBackground = useMemo(
    () =>
      resolveChapterPlaqueBackground({
        title: presentation.title,
        summary: presentation.summary,
      }),
    [presentation.title, presentation.summary],
  )

  const accessibleLabel = presentation.hiddenCountLabel
    ? `${presentation.title} · ${presentation.yearRange} · ${presentation.hiddenCountLabel}`
    : `${presentation.title} · ${presentation.yearRange}`

  const handleZoomIn = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canZoomIn) return
    onZoomIn(cluster)
  }

  const showZoomCtaPulse = isWideTimelineView && zoomCtaPulseReady && !isIntroActive

  const handleZoomOut = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canZoomOut) return
    onZoomOut(cluster)
  }

  const zoomInIconSize = isWideTimelineView ? 24 : 20

  const copyBlock = (
    <div className="chapter-callout" aria-label={accessibleLabel}>
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
    </div>
  )

  const zoomActions = layout.showCta ? (
    <div
      className={`chapter-callout-zoom-actions${isWideTimelineView ? ' chapter-callout-zoom-actions--wide' : ''}${showScrollChevrons ? ' chapter-callout-zoom-actions--scroll-ready' : ''}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {showScrollChevrons ? (
        <button
          type="button"
          className="chapter-callout-nav chapter-callout-nav--prev"
          aria-label="Scroll timeline earlier"
          title="Scroll earlier"
          disabled={!canScrollPrev}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleScrollPrev}
        >
          <ChevronLeft size={22} strokeWidth={2.15} aria-hidden="true" />
        </button>
      ) : null}
      {!isWideTimelineView ? (
        <button
          type="button"
          className="chapter-callout-zoom-btn chapter-callout-zoom-btn--out"
          aria-label="Zoom out"
          title="Zoom out"
          disabled={!canZoomOut}
          onClick={handleZoomOut}
        >
          <ZoomOut size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      ) : null}
      <button
        type="button"
        className={`chapter-callout-zoom-btn chapter-callout-zoom-btn--in${isWideTimelineView ? ' chapter-callout-zoom-btn--wide' : ''}${showZoomCtaPulse ? ' chapter-callout-zoom-btn--cta-pulse' : ''}`}
        aria-label={isWideTimelineView ? 'Zoom into timeline' : 'Zoom in'}
        title={isWideTimelineView ? 'Zoom into timeline' : 'Zoom in'}
        disabled={!canZoomIn}
        onClick={handleZoomIn}
      >
        <ZoomIn size={zoomInIconSize} strokeWidth={2} aria-hidden="true" />
        {isWideTimelineView ? (
          <span className="chapter-callout-zoom-label">Zoom into timeline</span>
        ) : null}
      </button>
      {showScrollChevrons ? (
        <button
          type="button"
          className="chapter-callout-nav chapter-callout-nav--next"
          aria-label="Scroll timeline later"
          title="Scroll later"
          disabled={!canScrollNext}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleScrollNext}
        >
          <ChevronRight size={22} strokeWidth={2.15} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  ) : null

  const sceneryImgProps = {
    className: 'chapter-callout-scenery-img',
    src: plaqueBackground.src,
    alt: '',
    draggable: false as const,
    decoding: 'async' as const,
    style: { objectPosition: plaqueBackground.position ?? 'center center' },
  }

  return (
    <div
      ref={layerRef}
      className={`chapter-callout-layer chapter-callout-layer--${layout.tier} chapter-callout-layer--${zoomMode}`}
      style={{
        top: verticalLayout.cardTop,
        left: chapterCenterX,
        width: layout.maxWidthPx,
        minWidth: layout.maxWidthPx,
        maxWidth: layout.maxWidthPx,
        transform: 'translateX(-50%)',
      }}
    >
      <div className="chapter-callout-halo" aria-hidden="true" />
      <div
        ref={frameRef}
        className="chapter-callout-frame"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="chapter-callout-scenery" aria-hidden="true">
          {motionEnabled ? (
            <AnimatePresence initial={false}>
              <motion.img
                key={plaqueBackground.key}
                {...sceneryImgProps}
                initial={calloutSceneryCrossfade.initial}
                animate={calloutSceneryCrossfade.animate}
                exit={calloutSceneryCrossfade.exit}
                transition={calloutCrossfadeTransition}
              />
            </AnimatePresence>
          ) : (
            <img key={plaqueBackground.key} {...sceneryImgProps} />
          )}
        </div>
        <ChapterCalloutFrameBorder frameRef={frameRef} />
        <div className="chapter-callout-inner">
          {motionEnabled ? (
            <AnimatePresence initial={false}>
              <motion.div
                key={cluster.chapterId}
                className="chapter-callout-swap"
                initial={calloutContentCrossfade.initial}
                animate={calloutContentCrossfade.animate}
                exit={calloutContentCrossfade.exit}
                transition={calloutCrossfadeTransition}
              >
                {copyBlock}
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="chapter-callout-swap">{copyBlock}</div>
          )}
          {zoomActions}
        </div>
      </div>
      <div className="timeline-plaque-hint">
        <TimelineHint />
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
  onZoomIn,
  onZoomOut,
  canZoomIn,
  canZoomOut,
  isWideTimelineView,
  onScrollPrev,
  onScrollNext,
  canScrollPrev,
  canScrollNext,
  showScrollChevrons,
  onPlaqueAnchorChange,
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
  onZoomIn: (cluster: PlacedSpanCluster) => void
  onZoomOut: (cluster: PlacedSpanCluster) => void
  canZoomIn: boolean
  canZoomOut: boolean
  isWideTimelineView: boolean
  onScrollPrev: () => void
  onScrollNext: () => void
  canScrollPrev: boolean
  canScrollNext: boolean
  showScrollChevrons: boolean
  onPlaqueAnchorChange?: (anchor: CalloutLayoutAnchor | null) => void
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [cardAnchor, setCardAnchor] = useState<CalloutLayoutAnchor | null>(null)
  const { introProgress, isIntroActive, completeIntro } = useJourneyIntro()

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame || !primary) {
      setCardAnchor(null)
      onPlaqueAnchorChange?.(null)
      return
    }

    const measure = () => {
      const anchor = measureFrameAnchor(frame, verticalLayout.chapterCenterX)
      if (anchor) {
        setCardAnchor(anchor)
        onPlaqueAnchorChange?.(anchor)
      }
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => {
      observer.disconnect()
      onPlaqueAnchorChange?.(null)
    }
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
    onPlaqueAnchorChange,
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
      motionEnabled={motionEnabled}
      onZoomIn={(c) => {
        completeIntro()
        onZoomIn(c)
      }}
      onZoomOut={(c) => {
        completeIntro()
        onZoomOut(c)
      }}
      canZoomIn={canZoomIn}
      canZoomOut={canZoomOut}
      isWideTimelineView={isWideTimelineView}
      onScrollPrev={() => {
        completeIntro()
        onScrollPrev()
      }}
      onScrollNext={() => {
        completeIntro()
        onScrollNext()
      }}
      canScrollPrev={canScrollPrev}
      canScrollNext={canScrollNext}
      showScrollChevrons={showScrollChevrons}
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
      <div className="chapter-callout-presence-stack">
        <div className="chapter-callout-presence" style={cardMotionStyle}>
          {callout}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {motionEnabled ? (
          <motion.div
            key={`connector-${primary.chapterId}`}
            className="chapter-connector-presence"
            initial={connectorCrossfade.initial}
            animate={connectorCrossfade.animate}
            exit={connectorCrossfade.exit}
            transition={calloutCrossfadeTransition}
          >
            <ChapterConnectorLayer
              clusters={clusters}
              primaryCluster={primary}
              verticalLayout={verticalLayout}
              zoomMode={zoomMode}
              cardAnchor={cardAnchor}
            />
          </motion.div>
        ) : (
          <ChapterConnectorLayer
            clusters={clusters}
            primaryCluster={primary}
            verticalLayout={verticalLayout}
            zoomMode={zoomMode}
            cardAnchor={cardAnchor}
          />
        )}
      </AnimatePresence>
    </>
  )
}
