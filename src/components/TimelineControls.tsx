import { useTimeline } from '../context/TimelineContext'

export function TimelineControls() {
  const { zoomValue, historyEnabled, setHistoryEnabled, setZoom, returnToCraig } = useTimeline()

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
        <button type="button" id="homeBtn" className="pill ghost" onClick={returnToCraig}>
          Return to Craig
        </button>
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
