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
  const { status, chapter, chapterIndex, chapterCount, pausedForDetail, next, back, skip } =
    useGuidedDiscovery()
  const { navigateToView } = useAppNavigation()

  if (status !== 'active' || !chapter) return null

  const isLast = chapterIndex >= chapterCount - 1
  const progressLabel = `${chapterIndex + 1} of ${chapterCount}`

  return (
    <div
      className={`guided-discovery${pausedForDetail ? ' is-paused' : ''}`}
      role="region"
      aria-label="Guided family story"
    >
      <div className="guided-discovery-panel">
        <div className="guided-discovery-meta">
          <span className="guided-discovery-kicker">Guided discovery</span>
          <span className="guided-discovery-progress" aria-live="polite">
            {progressLabel}
          </span>
        </div>
        <h2 className="guided-discovery-title">{chapter.title}</h2>
        <p className="guided-discovery-narration">{chapter.narration}</p>
        {chapter.evidenceNote ? (
          <p className="guided-discovery-evidence">{chapter.evidenceNote}</p>
        ) : null}
        {pausedForDetail ? (
          <p className="guided-discovery-paused">Close the record to continue the guide.</p>
        ) : null}

        {isLast ? (
          <div className="guided-discovery-exit-choices" role="group" aria-label="Continue exploring">
            <p className="guided-discovery-exit-prompt">Now explore the stories that brought us here.</p>
            <div className="guided-discovery-exit-buttons">
              {EXIT_CHOICES.map(({ view, label }) => (
                <button
                  key={view}
                  type="button"
                  className="guided-discovery-exit-btn"
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

        <div className="guided-discovery-controls">
          <button
            type="button"
            className="guided-discovery-btn guided-discovery-btn--ghost"
            onClick={back}
            disabled={chapterIndex === 0}
          >
            Back
          </button>
          <button
            type="button"
            className="guided-discovery-btn guided-discovery-btn--ghost"
            onClick={skip}
          >
            Skip / Explore freely
          </button>
          <button
            type="button"
            className="guided-discovery-btn guided-discovery-btn--primary"
            onClick={next}
          >
            {isLast ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
