import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { TimeLayerState } from '../../types/choreography'

const TIMELINE_TEXT_FADE_S = 2.8
const timelineTextFade = { duration: TIMELINE_TEXT_FADE_S, ease: [0.4, 0, 0.2, 1] as const }

type TimeLayerProps = {
  state: TimeLayerState
}

/** Subtle family-span indicator — static endpoints with a filling progress line. */
export function TimeLayer({ state }: TimeLayerProps) {
  const prefersReducedMotion = useReducedMotion()

  if (state.mode === 'hidden' || state.opacity <= 0) return null

  const endLabel = 'Present'
  const fillRatio = state.playheadRatio ?? 0
  const rangeKey = `${state.rangeStart}-${endLabel}`
  const fadeTransition = prefersReducedMotion ? { duration: 0.01 } : { opacity: timelineTextFade }

  return (
    <div className="de-time-layer" style={{ opacity: state.opacity }} aria-hidden={state.opacity < 0.2}>
      <div className="de-time-layer__range">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={`start-${rangeKey}`}
            className="de-timeline-text-drift"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeTransition}
          >
            {state.rangeStart}
          </motion.span>
        </AnimatePresence>
        <span className="de-time-layer__line" aria-hidden="true">
          <span
            className="de-time-layer__line-fill"
            style={{ transform: `scaleX(${fillRatio})` }}
          />
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={`end-${rangeKey}`}
            className="de-timeline-text-drift"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeTransition}
          >
            {endLabel}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  )
}
