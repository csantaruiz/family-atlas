import { lazy, Suspense, useEffect, useState } from 'react'
import { usePhoneTimelineUi } from '../context/PhoneTimelineUiContext'
import { TimelineFiltersPanel } from './TimelineFiltersPanel'
import { PhoneSheet } from './phone/PhoneSheet'

const FeaturedStory = lazy(() =>
  import('./FeaturedStory').then((m) => ({ default: m.FeaturedStory })),
)
const AtlasThinkingPanel = lazy(() =>
  import('./AtlasThinkingPanel').then((m) => ({ default: m.AtlasThinkingPanel })),
)

export function PhoneTimelineDock() {
  const ui = usePhoneTimelineUi()
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

  const toggleSheet = (sheet: 'story' | 'thinking' | 'filters') => {
    setHelpOpen(false)
    ui.openSheet(ui.sheet === sheet ? null : sheet)
  }

  return (
    <div className="phone-timeline-dock">
      <div className="phone-toolbar" role="toolbar" aria-label="Timeline">
        <button
          type="button"
          className={`phone-toolbar-btn${ui.sheet === 'story' ? ' is-active' : ''}`}
          aria-expanded={ui.sheet === 'story'}
          onClick={() => toggleSheet('story')}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M3 3.5h7.5L13 6v7.5H3z" />
            <path d="M10.5 3.5V6H13" />
          </svg>
          Story
        </button>
        <button
          type="button"
          className={`phone-toolbar-btn${ui.sheet === 'thinking' ? ' is-active' : ''}`}
          aria-expanded={ui.sheet === 'thinking'}
          onClick={() => toggleSheet('thinking')}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="8" cy="7" r="3.2" />
            <path d="M5.5 11.5 4 14h8l-1.5-2.5" />
          </svg>
          AI Insights
        </button>
        <button
          type="button"
          className={`phone-toolbar-btn${ui.sheet === 'filters' ? ' is-active' : ''}`}
          aria-expanded={ui.sheet === 'filters'}
          onClick={() => toggleSheet('filters')}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M2 4h12M4 8h8M6 12h4" />
          </svg>
          Filters
        </button>
        <button
          type="button"
          className={`phone-toolbar-btn${helpOpen ? ' is-active' : ''}`}
          aria-expanded={helpOpen}
          onClick={() => {
            ui.openSheet(null)
            setHelpOpen((open) => !open)
          }}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="8" cy="8" r="5.5" />
            <path d="M6.4 6.2a1.7 1.7 0 0 1 3.2.8c0 1.1-1.6 1.3-1.6 2.4" />
            <path d="M8 11.6h.01" />
          </svg>
          Help
        </button>
      </div>
      <PhoneSheet open={helpOpen} title="How to explore" onClose={() => setHelpOpen(false)} size="compact">
        <div className="phone-help">
          <p>
            Gold marks family lives. Teal diamonds mark world history. They never share the same
            side of the axis.
          </p>
          <dl>
            <div>
              <dt>Zoom</dt>
              <dd>Pinch the canvas, or use + and − on the chapter plaque.</dd>
            </div>
            <div>
              <dt>Pan</dt>
              <dd>Drag to move through years. The chapter header stays put.</dd>
            </div>
            <div>
              <dt>Open a record</dt>
              <dd>Tap a named family event, then choose Explore, Tree, or Follow.</dd>
            </div>
            <div>
              <dt>Grouped events</dt>
              <dd>A numbered circle is several lives in one year-band. Tap it to list them.</dd>
            </div>
          </dl>
        </div>
      </PhoneSheet>
      <PhoneSheet
        open={ui.sheet === 'story'}
        title="Featured Story"
        onClose={() => ui.openSheet(null)}
      >
        <Suspense fallback={null}>
          <FeaturedStory presentation="sheet" />
        </Suspense>
      </PhoneSheet>
      <PhoneSheet
        open={ui.sheet === 'thinking'}
        title="AI Insights"
        onClose={() => ui.openSheet(null)}
      >
        <Suspense fallback={null}>
          <AtlasThinkingPanel presentation="sheet" />
        </Suspense>
      </PhoneSheet>
      <PhoneSheet
        open={ui.sheet === 'filters'}
        title="Filters"
        onClose={() => ui.openSheet(null)}
      >
        <TimelineFiltersPanel onClose={() => ui.openSheet(null)} hideHeader />
      </PhoneSheet>
    </div>
  )
}
