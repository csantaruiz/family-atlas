import { useState } from 'react'
import { useTimeline } from '../context/TimelineContext'
import { TimelineFiltersControl } from './TimelineFiltersPanel'

export function TimelineControls() {
  const { zoomValue, setZoom } = useTimeline()
  const [filtersOpen, setFiltersOpen] = useState(false)

  return (
    <div className="controls">
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
        />
        <span>Years</span>
      </label>
    </div>
  )
}
