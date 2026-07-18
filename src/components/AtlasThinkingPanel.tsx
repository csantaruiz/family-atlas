import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'
import { familyDatabase } from '../data/familyDatabase'
import { placeholderAtlasThinking } from '../data/placeholderAtlasThinking'
import { useTimeline } from '../context/TimelineContext'
import { buildAtlasThinkingObservations } from '../utils/buildAtlasThinkingObservations'
import { selectAtlasThinking } from '../utils/selectAtlasThinking'
import { viewport } from '../utils/timelineMath'

export function AtlasThinkingPanel() {
  const {
    center,
    span,
    presentYear,
    detail,
    highlightedStoryPersonId,
    thinkingFocusRange,
    birthPeople,
    filteredFamilyEvents,
    openThinking,
  } = useTimeline()
  const prefersReducedMotion = useReducedMotion()

  const observations = useMemo(() => {
    const { start, end } = viewport(center, span)
    const generated = buildAtlasThinkingObservations({
      people: birthPeople,
      events: filteredFamilyEvents,
      start,
      end,
      span,
      center,
      presentYear,
      stats: familyDatabase.stats,
    })
    return [...generated, ...placeholderAtlasThinking]
  }, [birthPeople, center, filteredFamilyEvents, presentYear, span])

  const thinking = useMemo(
    () =>
      selectAtlasThinking({
        observations,
        center,
        span,
        detail,
        highlightedStoryPersonId,
        thinkingFocusRange,
      }),
    [observations, center, span, detail, highlightedStoryPersonId, thinkingFocusRange],
  )

  if (!thinking) return null

  const transition = prefersReducedMotion
    ? { duration: 0.01 }
    : { duration: 0.75, ease: [0.22, 0.8, 0.2, 1] as const }

  return (
    <aside className="atlas-thinking" aria-label="Atlas thinking" aria-live="polite">
      <div className="atlas-thinking-panel">
        <div className="atlas-thinking-header">
          <p className="atlas-thinking-kicker">Atlas Thinking</p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={thinking.id}
            className="atlas-thinking-body"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
          >
            <p className="atlas-thinking-headline">&ldquo;{thinking.observation}&rdquo;</p>
            <p className="atlas-thinking-narrative">
              Based on {thinking.recordCount} records · {thinking.confidence} confidence
            </p>
            <button
              type="button"
              className="atlas-thinking-read"
              onClick={(e) => {
                e.stopPropagation()
                openThinking(thinking)
              }}
            >
              View evidence →
            </button>
          </motion.div>
        </AnimatePresence>
      </div>
    </aside>
  )
}
