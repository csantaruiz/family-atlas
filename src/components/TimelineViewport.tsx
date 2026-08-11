import { lazy, Suspense, useCallback, useEffect, useMemo } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useTimeline } from '../context/TimelineContext'
import { useJourneyIntro } from '../context/JourneyIntroContext'
import { tickStep, viewport, yearX } from '../utils/timelineMath'
import { isNarrowStage } from '../utils/stageBreakpoints'
import { useStageDimensions } from '../hooks/useStageDimensions'
import { usePinchZoom } from '../hooks/usePinchZoom'
import { FamilyLayer } from './FamilyLayer'
import { WorldHistoryLayer } from './WorldHistoryLayer'
import { TimelineMountainSilhouette } from './TimelineMountainSilhouette'
import { TimelineAxisPulse } from './TimelineAxisPulse'
import { TimelineControls } from './TimelineControls'
import { TimelinePulseProvider } from '../context/TimelinePulseContext'

const FeaturedStory = lazy(() =>
  import('./FeaturedStory').then((m) => ({ default: m.FeaturedStory })),
)
const AtlasThinkingPanel = lazy(() =>
  import('./AtlasThinkingPanel').then((m) => ({ default: m.AtlasThinkingPanel })),
)

type TimelineViewportProps = {
  active: boolean
}

export function TimelineViewport({ active }: TimelineViewportProps) {
  const {
    center,
    span,
    presentYear,
    isDragging,
    isZooming,
    isInertialScrolling,
    mapHighlightYears,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useTimeline()

  const { completeIntro, isIntroActive } = useJourneyIntro()

  const { ref, width, height } = useStageDimensions()
  const prefersReducedMotion = useReducedMotion()
  const { start, end } = viewport(center, span)
  const step = tickStep(span)
  const ticks: number[] = []
  for (let y = Math.ceil(start / step) * step; y <= end; y += step) {
    ticks.push(y)
  }

  const mapHighlightStyle = useMemo(() => {
    if (!mapHighlightYears || width <= 0) return null
    const left = yearX(mapHighlightYears.start, start, span, width)
    const right = yearX(mapHighlightYears.end, start, span, width)
    const hlWidth = Math.max(4, right - left)
    if (right < 0 || left > width) return null
    return { left: Math.max(0, left), width: Math.min(width, hlWidth) }
  }, [mapHighlightYears, start, span, width])

  const handleStagePinch = useCallback(
    ({ centerX, delta, width: stageWidth }: { centerX: number; delta: number; width: number }) => {
      if (isIntroActive) completeIntro()
      handleWheel(centerX, delta, stageWidth)
    },
    [completeIntro, handleWheel, isIntroActive],
  )

  usePinchZoom(ref, active, handleStagePinch)

  // Warm secondary panels while the stage is already interactive.
  useEffect(() => {
    void import('./FeaturedStory')
    void import('./AtlasThinkingPanel')
  }, [])

  return (
    <TimelinePulseProvider active={active}>
      <section id="timeline" className={`view${active ? ' active' : ''}`} aria-hidden={!active}>
        <svg className="chapter-plaque-filter-defs" aria-hidden="true" width="0" height="0">
          <defs>
            <filter
              id="chapter-plaque-illustration"
              x="-8%"
              y="-8%"
              width="116%"
              height="116%"
              colorInterpolationFilters="sRGB"
            >
              <feColorMatrix in="SourceGraphic" type="saturate" values="0.38" result="desat" />
              <feComponentTransfer in="desat" result="poster">
                <feFuncR type="discrete" tableValues="0 .16 .3 .44 .58 .72 .86 1" />
                <feFuncG type="discrete" tableValues="0 .16 .3 .44 .58 .72 .86 1" />
                <feFuncB type="discrete" tableValues="0 .16 .3 .44 .58 .72 .86 1" />
              </feComponentTransfer>
              <feColorMatrix
                in="poster"
                type="matrix"
                values="0.46 0.34 0.2 0 0.05
                        0.34 0.28 0.17 0 0.04
                        0.24 0.2 0.13 0 0.03
                        0 0 0 1 0"
                result="tint"
              />
              <feBlend in="SourceGraphic" in2="tint" mode="multiply" />
            </filter>
          </defs>
        </svg>
        <div className="timeline-edge-vignette" aria-hidden="true" />
        <div
          ref={ref}
          className={`stage${isNarrowStage(width) ? ' stage--narrow' : ''}${isDragging ? ' dragging' : ''}${isInertialScrolling ? ' coasting' : ''}${isZooming ? ' zooming' : ''}`}
          data-stage-layout={isNarrowStage(width) ? 'narrow' : 'desktop'}
          onWheel={(e) => {
            e.preventDefault()
            if (isIntroActive) completeIntro()
            const rect = e.currentTarget.getBoundingClientRect()
            handleWheel(e.clientX - rect.left, e.deltaY, rect.width)
          }}
          onPointerDown={(e) => {
            if (isIntroActive) completeIntro()
            if (e.button !== 0) return
            if (handlePointerDown(e.clientX, e.target)) {
              e.preventDefault()
              e.currentTarget.setPointerCapture(e.pointerId)
            }
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.preventDefault()
              handlePointerMove(e.clientX, e.currentTarget.clientWidth)
            }
          }}
          onPointerUp={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId)
            }
            handlePointerUp()
            window.getSelection()?.removeAllRanges()
          }}
          onPointerCancel={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId)
            }
            handlePointerUp()
            window.getSelection()?.removeAllRanges()
          }}
          onDragStart={(e) => e.preventDefault()}
        >
          <div className="stage-atmosphere" aria-hidden="true" />
          <FamilyLayer start={start} end={end} width={width} height={height} />
          <Suspense fallback={null}>
            <FeaturedStory />
          </Suspense>
          <Suspense fallback={null}>
            <AtlasThinkingPanel />
          </Suspense>
          <WorldHistoryLayer start={start} end={end} width={width} height={height} />
          <TimelineMountainSilhouette
            start={start}
            end={end}
            span={span}
            width={width}
            height={height}
          />
          <div id="worldline" className="worldline" style={{ left: 0, width }} />
          <TimelineAxisPulse width={width} height={height} />
          <div id="ticks">
            {ticks.map((y) => (
              <div key={y}>
                <div className="century" style={{ left: yearX(y, start, span, width) }} />
                <div className="year-label" style={{ left: yearX(y, start, span, width) }}>
                  {y === presentYear ? 'Present' : y}
                </div>
              </div>
            ))}
          </div>
          <AnimatePresence>
            {mapHighlightStyle ? (
              <motion.div
                key="timeline-map-highlight"
                className="timeline-map-highlight"
                style={{ left: mapHighlightStyle.left, width: mapHighlightStyle.width }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0.01 }
                    : { duration: 0.45, ease: [0.22, 0.8, 0.2, 1] }
                }
                aria-hidden="true"
              />
            ) : null}
          </AnimatePresence>
        </div>
        <TimelineControls />
      </section>
    </TimelinePulseProvider>
  )
}
