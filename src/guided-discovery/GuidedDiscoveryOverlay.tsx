import { useAppNavigation } from '../context/AppNavigationContext'
import { useGuidedDiscovery } from './GuidedDiscoveryContext'
import type { AppView } from '../types/navigation'

const EXIT_CHOICES: { view: AppView; label: string }[] = [
  { view: 'journey', label: 'Timeline' },
  { view: 'map', label: 'Journeys' },
  { view: 'tree', label: 'Tree' },
  { view: 'people', label: 'People' },
]

export function GuidedDiscoveryOverlay() {
  const {
    status,
    chapter,
    chapterIndex,
    chapterCount,
    pausedForDetail,
    captionReady,
    next,
    back,
    skip,
  } = useGuidedDiscovery()
  const { navigateToView } = useAppNavigation()

  if (status !== 'active' || !chapter) return null

  const isLast = chapterIndex >= chapterCount - 1
  const progressLabel = `${String(chapterIndex + 1).padStart(2, '0')} / ${String(chapterCount).padStart(2, '0')}`

  return (
    <div
      className={[
        'guided-caption',
        captionReady ? 'is-ready' : 'is-settling',
        pausedForDetail ? 'is-paused' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="region"
      aria-label="Guided family story"
    >
      <div className="guided-caption-inner">
        <div className="guided-caption-meta">
          <span className="guided-caption-progress" aria-live="polite">
            {progressLabel}
          </span>
          {chapter.focusLabel ? (
            <span className="guided-caption-focus">{chapter.focusLabel}</span>
          ) : null}
        </div>
        <h2 className="guided-caption-title">{chapter.title}</h2>
        <p className="guided-caption-narration">{chapter.narration}</p>
        {chapter.evidenceNote ? (
          <p className="guided-caption-evidence">{chapter.evidenceNote}</p>
        ) : null}

        {isLast ? (
          <div className="guided-caption-exit" role="group" aria-label="Continue exploring">
            <p className="guided-caption-exit-prompt">Now explore the stories that brought us here.</p>
            <div className="guided-caption-exit-buttons">
              {EXIT_CHOICES.map(({ view, label }) => (
                <button
                  key={view}
                  type="button"
                  className="guided-caption-exit-btn"
                  onClick={() => {
                    skip()
                    navigateToView(view)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="guided-caption-controls">
          <button
            type="button"
            className="guided-caption-btn"
            onClick={back}
            disabled={chapterIndex === 0}
          >
            Previous
          </button>
          <button type="button" className="guided-caption-btn" onClick={skip}>
            Exit
          </button>
          <button type="button" className="guided-caption-btn guided-caption-btn--primary" onClick={next}>
            {isLast ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
