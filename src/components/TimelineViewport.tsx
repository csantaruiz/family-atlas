import { useMemo } from 'react'
import { useTimeline } from '../context/TimelineContext'
import { useJourneyIntro } from '../context/JourneyIntroContext'
import { tickStep, viewport, yearX } from '../utils/timelineMath'
import { useStageDimensions } from '../hooks/useStageDimensions'
import { AtlasThinkingPanel } from './AtlasThinkingPanel'
import { FamilyLayer } from './FamilyLayer'
import { FeaturedStory } from './FeaturedStory'
import { TimelineControls } from './TimelineControls'
import { TimelineHint } from './TimelineHint'
import { WorldHistoryLayer } from './WorldHistoryLayer'

type TimelineViewportProps = {
  active: boolean
}

export function TimelineViewport({ active }: TimelineViewportProps) {
  const {
    center,
    span,
    presentYear,
    historyEnabled,
    isDragging,
    isZooming,
    mapHighlightYears,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useTimeline()

  const { completeIntro, isIntroActive } = useJourneyIntro()

  const { ref, width, height } = useStageDimensions()
  const { start, end } = viewport(center, span)
  const step = tickStep(span)
  const ticks: number[] = []
  for (let y = Math.ceil(start / step) * step; y <= end; y += step) {
    ticks.push(y)
  }

  const presentX = yearX(presentYear, start, span, width)
  const showPresentEdge = end >= presentYear - 1

  const mapHighlightStyle = useMemo(() => {
    if (!mapHighlightYears || width <= 0) return null
    const left = yearX(mapHighlightYears.start, start, span, width)
    const right = yearX(mapHighlightYears.end, start, span, width)
    const hlWidth = Math.max(4, right - left)
    if (right < 0 || left > width) return null
    return { left: Math.max(0, left), width: Math.min(width, hlWidth) }
  }, [mapHighlightYears, start, span, width])

  return (
    <section id="timeline" className={`view${active ? ' active' : ''}`} aria-hidden={!active}>
      <div className="timeline-edge-vignette" aria-hidden="true" />
      <div
        ref={ref}
        className={`stage ${isDragging ? 'dragging' : ''} ${isZooming ? 'zooming' : ''}`}
        onWheel={(e) => {
          e.preventDefault()
          if (isIntroActive) completeIntro()
          const rect = e.currentTarget.getBoundingClientRect()
          handleWheel(e.clientX - rect.left, e.deltaY, rect.width)
        }}
        onPointerDown={(e) => {
          if (isIntroActive) completeIntro()
          if (handlePointerDown(e.clientX, e.target)) {
            e.currentTarget.setPointerCapture(e.pointerId)
          }
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            handlePointerMove(e.clientX, e.currentTarget.clientWidth)
          }
        }}
        onPointerUp={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId)
          }
          handlePointerUp()
        }}
        onPointerCancel={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId)
          }
          handlePointerUp()
        }}
      >
        <div className="stage-atmosphere" aria-hidden="true" />
        <FeaturedStory />
        <AtlasThinkingPanel />
        <div className="context-key">Historical context</div>
        <WorldHistoryLayer start={start} end={end} width={width} height={height} enabled={historyEnabled} />
        <div id="worldline" className="worldline" style={{ left: 0, width }} />
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
        {mapHighlightStyle && (
          <div
            className="timeline-map-highlight"
            style={{ left: mapHighlightStyle.left, width: mapHighlightStyle.width }}
            aria-hidden="true"
          />
        )}
        <FamilyLayer start={start} end={end} width={width} height={height} />
        {showPresentEdge && (
          <div
            id="presentEdge"
            className="present-edge"
            style={{ left: Math.max(0, Math.min(width, presentX)) }}
          />
        )}
      </div>
      <TimelineHint />
      <TimelineControls />
    </section>
  )
}
