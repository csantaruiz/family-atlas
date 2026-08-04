import { useMemo } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { chapterMarkersFromManifest } from '../core/chapterMarkers'
import {
  formatEngineTime,
  useDocumentaryEngine,
} from '../context/DocumentaryEngineContext'

const CHAPTER_LABEL_FADE_IN_S = 2.2
const CHAPTER_LABEL_FADE_OUT_S = 4.5
const CHAPTER_LABEL_DRIFT_S = 28
const chapterLabelEaseIn = [0.4, 0, 0.2, 1] as const
const chapterLabelEaseOut = [0.4, 0, 1, 1] as const

export function EngineControls() {
  const {
    phase,
    progress,
    currentTimeMs,
    durationMs,
    isPlaying,
    togglePause,
    skip,
    seek,
    resolved,
    manifest,
  } = useDocumentaryEngine()

  const chapterMarkers = useMemo(() => chapterMarkersFromManifest(manifest), [manifest])
  const currentChapter = resolved?.chapter ?? null
  const prefersReducedMotion = useReducedMotion()

  const startedChapterMarkers = useMemo(
    () => chapterMarkers.filter((marker) => currentTimeMs >= marker.startMs),
    [chapterMarkers, currentTimeMs],
  )

  if (phase !== 'playing') return null

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    seek(Math.max(0, Math.min(1, ratio)) * durationMs)
  }

  const handleChapterSeek = (startMs: number) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    seek(startMs)
  }

  return (
    <div className="documentary-controls de-controls" aria-live="polite">
      <div className="de-controls__progress-wrap">
        <div
          className="documentary-controls__progress de-controls__progress"
          aria-hidden="true"
          onClick={handleProgressClick}
          role="presentation"
        >
          <div
            className="documentary-controls__progress-fill"
            style={{ transform: `scaleX(${progress})` }}
          />

          {startedChapterMarkers.map((marker) => {
            const ratio = durationMs > 0 ? marker.startMs / durationMs : 0
            if (ratio <= 0 || ratio >= 1) return null
            const isActive = marker.chapter === currentChapter
            const isPast = !isActive
            return (
              <button
                key={marker.chapter}
                type="button"
                className={[
                  'de-controls__chapter-mark',
                  isActive ? 'de-controls__chapter-mark--active' : '',
                  isPast ? 'de-controls__chapter-mark--past' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ left: `${ratio * 100}%` }}
                onClick={handleChapterSeek(marker.startMs)}
                title={`${marker.label} · ${formatEngineTime(marker.startMs)}`}
                aria-label={`Jump to ${marker.label}`}
                aria-current={isActive ? 'true' : undefined}
              >
                {isActive ? (
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={marker.chapter}
                      className="de-controls__chapter-label"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{
                        opacity: 0,
                        transition: {
                          opacity: {
                            duration: prefersReducedMotion ? 0.01 : CHAPTER_LABEL_FADE_OUT_S,
                            ease: chapterLabelEaseOut,
                          },
                        },
                      }}
                      transition={
                        prefersReducedMotion
                          ? { duration: 0.01 }
                          : {
                              opacity: {
                                duration: CHAPTER_LABEL_FADE_IN_S,
                                ease: chapterLabelEaseIn,
                              },
                            }
                      }
                    >
                      <motion.span
                        className="de-controls__chapter-label-drift"
                        animate={{ x: prefersReducedMotion ? 0 : [-4, 4] }}
                        transition={
                          prefersReducedMotion
                            ? { duration: 0.01 }
                            : {
                                duration: CHAPTER_LABEL_DRIFT_S,
                                repeat: Infinity,
                                ease: 'easeInOut',
                                repeatType: 'mirror',
                              }
                        }
                      >
                        {marker.label}
                      </motion.span>
                    </motion.span>
                  </AnimatePresence>
                ) : (
                  <span className="de-controls__chapter-label de-controls__chapter-label--past">
                    {marker.label}
                  </span>
                )}
                <span className="de-controls__chapter-tick" aria-hidden="true" />
              </button>
            )
          })}
        </div>
      </div>

      <div className="documentary-controls__bar">
        <span className="documentary-controls__timing de-timeline-ui-text">
          {formatEngineTime(currentTimeMs)}
        </span>
        <div className="documentary-controls__actions">
          <button type="button" className="documentary-controls__btn" onClick={togglePause}>
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button type="button" className="documentary-controls__btn" onClick={skip}>
            Skip
          </button>
        </div>
        <span className="documentary-controls__duration de-timeline-ui-text">
          {formatEngineTime(durationMs)}
        </span>
      </div>
    </div>
  )
}
