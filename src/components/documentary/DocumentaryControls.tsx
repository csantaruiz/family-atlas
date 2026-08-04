import { motion } from 'framer-motion'
import {
  useDocumentaryMode,
  formatDocumentaryDuration,
} from '../../context/DocumentaryModeContext'

export function DocumentaryControls() {
  const { phase, progress, elapsedMs, totalDurationMs, isPaused, togglePause, skipOpening } =
    useDocumentaryMode()

  if (phase !== 'playing') return null

  return (
    <div className="documentary-controls documentary-controls--stage" aria-live="polite">
      <div className="documentary-controls__progress" aria-hidden="true">
        <motion.div
          className="documentary-controls__progress-fill"
          animate={{ scaleX: progress }}
          initial={false}
          transition={{ duration: 0.35, ease: [0.22, 0.8, 0.2, 1] }}
        />
      </div>

      <div className="documentary-controls__bar">
        <span className="documentary-controls__timing">
          {formatDocumentaryDuration(elapsedMs)} · Opening
        </span>
        <div className="documentary-controls__actions">
          <button type="button" className="documentary-controls__btn" onClick={togglePause}>
            {isPaused ? 'Play' : 'Pause'}
          </button>
          <button type="button" className="documentary-controls__btn" onClick={skipOpening}>
            Skip
          </button>
        </div>
        <span className="documentary-controls__duration">
          {formatDocumentaryDuration(totalDurationMs)}
        </span>
      </div>
    </div>
  )
}
