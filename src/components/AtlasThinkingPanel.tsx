import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'
import { placeholderAtlasThinking } from '../data/placeholderAtlasThinking'
import { useTimeline } from '../context/TimelineContext'
import { selectAtlasThinking } from '../utils/selectAtlasThinking'

export function AtlasThinkingPanel() {
  const {
    center,
    span,
    detail,
    highlightedStoryPersonId,
    thinkingFocusRange,
    openThinking,
  } = useTimeline()
  const prefersReducedMotion = useReducedMotion()

  const thinking = useMemo(
    () =>
      selectAtlasThinking({
        observations: placeholderAtlasThinking,
        center,
        span,
        detail,
        highlightedStoryPersonId,
        thinkingFocusRange,
      }),
    [center, span, detail, highlightedStoryPersonId, thinkingFocusRange],
  )

  if (!thinking) return null

  const transition = prefersReducedMotion
    ? { duration: 0.01 }
    : { duration: 0.75, ease: [0.22, 0.8, 0.2, 1] as const }

  return (
    <aside className="atlas-thinking" aria-label="Atlas thinking" aria-live="polite">
      <p className="atlas-thinking-label">✦ Atlas Thinking</p>
      <AnimatePresence mode="wait">
        <motion.div
          key={thinking.id}
          className="atlas-thinking-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
        >
          <blockquote className="atlas-thinking-quote">
            &ldquo;{thinking.observation}&rdquo;
          </blockquote>
          <p className="atlas-thinking-meta">— Based on {thinking.recordCount} records</p>
          <p className="atlas-thinking-confidence">{thinking.confidence} confidence</p>
          <button
            type="button"
            className="atlas-thinking-action"
            onClick={(e) => {
              e.stopPropagation()
              openThinking(thinking)
            }}
          >
            View evidence →
          </button>
        </motion.div>
      </AnimatePresence>
    </aside>
  )
}
