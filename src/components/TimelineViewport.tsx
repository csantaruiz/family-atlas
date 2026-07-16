import { useTimeline } from '../context/TimelineContext'
import { tickStep, viewport, yearX } from '../utils/timelineMath'
import { useStageDimensions } from '../hooks/useStageDimensions'
import { FamilyLayer } from './FamilyLayer'
import { HighlightCarousel } from './HighlightCarousel'
import { TimelineControls } from './TimelineControls'
import { WorldHistoryLayer } from './WorldHistoryLayer'

export function TimelineViewport() {
  const {
    center,
    span,
    presentYear,
    historyEnabled,
    isDragging,
    isZooming,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useTimeline()

  const { ref, width, height } = useStageDimensions()
  const { start, end } = viewport(center, span)
  const step = tickStep(span)
  const ticks: number[] = []
  for (let y = Math.ceil(start / step) * step; y <= end; y += step) {
    ticks.push(y)
  }

  const presentX = yearX(presentYear, start, span, width)
  const showPresentEdge = end >= presentYear - 1

  return (
    <section id="timeline" className="view active">
      <div
        ref={ref}
        className={`stage ${isDragging ? 'dragging' : ''} ${isZooming ? 'zooming' : ''}`}
        onWheel={(e) => {
          e.preventDefault()
          const rect = e.currentTarget.getBoundingClientRect()
          handleWheel(e.clientX - rect.left, e.deltaY, rect.width)
        }}
        onPointerDown={(e) => {
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
        <HighlightCarousel />
        <div className="context-key">Historical context</div>
        <WorldHistoryLayer start={start} end={end} width={width} height={height} enabled={historyEnabled} />
        <div id="worldline" className="worldline" style={{ left: 0, width }} />
        <FamilyLayer start={start} end={end} width={width} height={height} />
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
        {showPresentEdge && (
          <div
            id="presentEdge"
            className="present-edge"
            style={{ left: Math.max(0, Math.min(width, presentX)) }}
          />
        )}
      </div>
      <p className="hint">Scroll to zoom · drag to pan · click a marker to open the record</p>
      <TimelineControls />
    </section>
  )
}
