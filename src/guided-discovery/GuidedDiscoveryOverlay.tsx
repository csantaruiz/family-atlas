import { GUIDED_CLOSING_LINE, useGuidedDiscovery } from './GuidedDiscoveryContext'
import type { GuidedChapter } from './types'

const SERIES_LABEL = 'THE FAMILY STORY'

function chapterAttribution(chapter: GuidedChapter): string | null {
  if (chapter.subtitle) return chapter.subtitle
  if (chapter.focusHistory) {
    const year = chapter.focusHistory.year
    const place = chapter.focusHistory.country?.trim()
    if (place) return `${year} · ${place}`
    return String(year)
  }
  return chapter.focusLabel
}

export function GuidedDiscoveryOverlay() {
  const {
    status,
    chapter,
    chapterIndex,
    chapterCount,
    pausedForDetail,
    captionPhase,
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
  const progressLabel = `${String(chapterIndex + 1).padStart(2, '0')} / ${String(chapterCount).padStart(2, '0')} · ${SERIES_LABEL}`
  const attribution = chapterAttribution(chapter)

  return (
    <div
      className={[
        'guided-caption',
        `guided-caption--${chapter.view}`,
        captionPhase === 'shown' ? 'is-ready' : captionPhase === 'exiting' ? 'is-exiting' : 'is-settling',
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
        </div>
        <h2 className="guided-caption-title">{chapter.title}</h2>
        <div className="guided-caption-rule" aria-hidden="true" />
        {attribution ? (
          <p className="guided-caption-attribution">{attribution}</p>
        ) : null}
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
          <button type="button" className="guided-caption-btn" onClick={skip}>
            Exit
          </button>
          <button
            type="button"
            className="guided-caption-btn guided-caption-btn--primary"
            onClick={next}
          >
            {isLast ? 'Explore the Atlas →' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
