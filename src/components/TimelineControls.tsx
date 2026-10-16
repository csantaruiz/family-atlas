import { useState } from 'react'
import { useTimeline } from '../context/TimelineContext'
import { TimelineFiltersControl } from './TimelineFiltersPanel'

export function TimelineControls() {
  const { zoomValue, setZoom } = useTimeline()
  const [filtersOpen, setFiltersOpen] = useState(false)

  return (
    <div className="controls">
      <p className="timeline-gesture-hint" aria-hidden="true">
        Drag to pan · Scroll or pinch to zoom · Select a marker for details
      </p>
      <div className="controls-group">
        <TimelineFiltersControl
          open={filtersOpen}
          onToggle={() => setFiltersOpen((o) => !o)}
          onClose={() => setFiltersOpen(false)}
        />
      </div>
      <label className="pill range controls-zoom">
        <span>Centuries</span>
        <input
          id="zoom"
          type="range"
          min={0}
          max={100}
          value={zoomValue}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="Zoom between centuries and years"
        />
        <span>Years</span>
      </label>
    </div>
  )
}
