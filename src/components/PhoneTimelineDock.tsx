import { lazy, Suspense, useEffect, useState } from 'react'
import { usePhoneTimelineUi } from '../context/PhoneTimelineUiContext'
import { TimelineFiltersPanel } from './TimelineFiltersPanel'
import { TimelineHint } from './TimelineHint'
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
          Story
        </button>
        <button
          type="button"
          className={`phone-toolbar-btn${ui.sheet === 'thinking' ? ' is-active' : ''}`}
          aria-expanded={ui.sheet === 'thinking'}
          onClick={() => toggleSheet('thinking')}
        >
          Thinking
        </button>
        <button
          type="button"
          className={`phone-toolbar-btn${ui.sheet === 'filters' ? ' is-active' : ''}`}
          aria-expanded={ui.sheet === 'filters'}
          onClick={() => toggleSheet('filters')}
        >
          Filters
        </button>
        <button
          type="button"
          className={`phone-toolbar-btn phone-toolbar-btn--icon${helpOpen ? ' is-active' : ''}`}
          aria-expanded={helpOpen}
          aria-label="How to explore the timeline"
          onClick={() => {
            ui.openSheet(null)
            setHelpOpen((open) => !open)
          }}
        >
          ?
        </button>
      </div>
      {helpOpen ? (
        <div className="phone-popover" role="note">
          <TimelineHint />
        </div>
      ) : null}
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
        title="Atlas Thinking"
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
