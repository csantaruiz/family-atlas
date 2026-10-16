import { GUIDED_CLOSING_LINE, useGuidedDiscovery } from './GuidedDiscoveryContext'

export function GuidedDiscoveryOverlay() {
  const {
    status,
    chapter,
    chapterIndex,
    chapterCount,
    pausedForDetail,
    captionReady,
    closingLineVisible,
    next,
    back,
    skip,
  } = useGuidedDiscovery()

  if (status === 'closing') {
    return (
      <div
        className={`guided-closing${closingLineVisible ? ' is-visible' : ''}`}
        role="status"
        aria-live="polite"
      >
        <p className="guided-closing-line">{GUIDED_CLOSING_LINE}</p>
      </div>
    )
  }

  if (status !== 'active' || !chapter) return null

  const isLast = chapterIndex >= chapterCount - 1
  const progressLabel = `${String(chapterIndex + 1).padStart(2, '0')} / ${String(chapterCount).padStart(2, '0')}`

  return (
    <div
      className={[
        'guided-caption',
        captionReady ? 'is-ready' : 'is-settling',
        pausedForDetail ? 'is-paused' : '',
        isLast ? 'is-finale' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="region"
      aria-label="Guided family story"
    >
      <div className="guided-caption-scrim" aria-hidden="true" />
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

        <div className="guided-caption-controls">
          <button
            type="button"
            className="guided-caption-btn"
            onClick={back}
            disabled={chapterIndex === 0}
          >
            Previous
          </button>
          {isLast ? (
            <>
              <button type="button" className="guided-caption-btn" onClick={skip}>
                Exit
              </button>
              <button
                type="button"
                className="guided-caption-btn guided-caption-btn--primary"
                onClick={next}
              >
                Explore the Atlas →
              </button>
            </>
          ) : (
            <>
              <button type="button" className="guided-caption-btn" onClick={skip}>
                Exit
              </button>
              <button
                type="button"
                className="guided-caption-btn guided-caption-btn--primary"
                onClick={next}
              >
                Next
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
