import { AnimatePresence, motion } from 'framer-motion'
import type { NarrativeCue } from '../types'

type NarrativeOverlayProps = {
  cue: NarrativeCue | null
}

/** Single screen-space narrative overlay — never scales with map. */
export function NarrativeOverlay({ cue }: NarrativeOverlayProps) {
  return (
    <div className="dv3-narrative-layer" aria-live="polite">
      <AnimatePresence mode="wait">
        {cue ? (
          <motion.div
            key={cue.id}
            className="dv3-narrative"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            {cue.title ? <h1 className="dv3-narrative__title">{cue.title}</h1> : null}
            {cue.date ? <p className="dv3-narrative__date">{cue.date}</p> : null}
            {cue.subtitle ? <p className="dv3-narrative__subtitle">{cue.subtitle}</p> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
