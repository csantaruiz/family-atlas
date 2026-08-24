import { lazy, Suspense, useEffect, useState } from 'react'
import { usePhoneTimelineUi } from '../context/PhoneTimelineUiContext'
import { useTimeline } from '../context/TimelineContext'
import { TimelineFiltersControl } from './TimelineFiltersPanel'
import { TimelineHint } from './TimelineHint'

const FeaturedStory = lazy(() =>
  import('./FeaturedStory').then((m) => ({ default: m.FeaturedStory })),
)
const AtlasThinkingPanel = lazy(() =>
  import('./AtlasThinkingPanel').then((m) => ({ default: m.AtlasThinkingPanel })),
)

export function PhoneTimelineDock() {
  const ui = usePhoneTimelineUi()
  const { zoomValue, setZoom } = useTimeline()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    if (!ui?.sheet && !helpOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      ui?.openSheet(null)
      setHelpOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [helpOpen, ui])

  if (!ui?.phone) return null

  const closeOverlays = () => {
    setFiltersOpen(false)
    setHelpOpen(false)
    ui.openSheet(null)
  }

  return (
    <div className="phone-timeline-dock">
      <div className="phone-timeline-dock-row">
        <button
          type="button"
          className={`phone-discovery-chip${ui.sheet === 'story' ? ' is-active' : ''}`}
          aria-expanded={ui.sheet === 'story'}
          onClick={() => {
            setFiltersOpen(false)
            setHelpOpen(false)
            ui.openSheet(ui.sheet === 'story' ? null : 'story')
          }}
        >
          Story
        </button>
        <button
          type="button"
          className={`phone-discovery-chip${ui.sheet === 'thinking' ? ' is-active' : ''}`}
          aria-expanded={ui.sheet === 'thinking'}
          onClick={() => {
            setFiltersOpen(false)
            setHelpOpen(false)
            ui.openSheet(ui.sheet === 'thinking' ? null : 'thinking')
          }}
        >
          Thinking
        </button>
        <TimelineFiltersControl
          open={filtersOpen}
          onToggle={() => {
            setHelpOpen(false)
            ui.openSheet(null)
            setFiltersOpen((open) => !open)
          }}
          onClose={() => setFiltersOpen(false)}
        />
        <button
          type="button"
          className={`pill phone-help-toggle${helpOpen ? ' active' : ''}`}
          aria-expanded={helpOpen}
          aria-label="How to explore the timeline"
          onClick={() => {
            setFiltersOpen(false)
            ui.openSheet(null)
            setHelpOpen((open) => !open)
          }}
        >
          ?
        </button>
      </div>
      <div className="phone-timeline-dock-row phone-timeline-dock-row--zoom">
        <label className="pill range controls-zoom">
          <span>Centuries</span>
          <input
            id="zoom-phone"
            type="range"
            min={0}
            max={100}
            value={zoomValue}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
          <span>Years</span>
        </label>
      </div>
      {helpOpen ? (
        <div className="phone-help-popover" role="note">
          <TimelineHint />
        </div>
      ) : null}
      {ui.sheet ? (
        <div className="phone-discovery-layer">
          <button
            type="button"
            className="phone-discovery-scrim"
            aria-label="Close"
            onClick={closeOverlays}
          />
          <div
            className="phone-discovery-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={ui.sheet === 'story' ? 'Featured story' : 'Atlas thinking'}
          >
            <div className="phone-discovery-sheet-head">
              <strong>{ui.sheet === 'story' ? 'Featured Story' : 'Atlas Thinking'}</strong>
              <button type="button" onClick={() => ui.openSheet(null)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="phone-discovery-sheet-body">
              <Suspense fallback={null}>
                {ui.sheet === 'story' ? (
                  <FeaturedStory presentation="sheet" />
                ) : (
                  <AtlasThinkingPanel presentation="sheet" />
                )}
              </Suspense>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
