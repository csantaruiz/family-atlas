import { useState } from 'react'
import { useTimeline } from '../context/TimelineContext'
import { TimelineFiltersControl } from './TimelineFiltersPanel'

export function TimelineControls() {
  const { zoomValue, historyEnabled, setHistoryEnabled, setZoom } = useTimeline()
  const [filtersOpen, setFiltersOpen] = useState(false)

  return (
    <div className="controls">
      <div className="controls-group">
        <button
          type="button"
          id="historyToggle"
          className={`pill layer-toggle ${historyEnabled ? '' : 'off'}`}
          aria-pressed={historyEnabled}
          onClick={() => setHistoryEnabled(!historyEnabled)}
        >
          <i aria-hidden="true" />
          Historical context
        </button>
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
