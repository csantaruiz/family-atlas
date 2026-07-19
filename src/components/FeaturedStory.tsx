import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { storySeeds } from '../data'
import { useTimeline } from '../context/TimelineContext'
import { viewport } from '../utils/timelineMath'

const SWIPE_THRESHOLD_PX = 48

export function FeaturedStory() {
  const { center, span, openPerson, setHighlightedStoryPersonId, timelineFilters } = useTimeline()
  const [index, setIndex] = useState(0)
  const candidatesKeyRef = useRef('')
  const swipeStartX = useRef<number | null>(null)
  const prefersReducedMotion = useReducedMotion()

  const candidates = useMemo(() => {
    const { start, end } = viewport(center, span)
    const paddedStart = start - span * 0.22
    const paddedEnd = end + span * 0.22
    let items = storySeeds.filter((s) => s.year >= paddedStart && s.year <= paddedEnd)
    if (!items.length) {
      items = [...storySeeds]
        .sort((a, b) => Math.abs(a.year - center) - Math.abs(b.year - center))
        .slice(0, 1)
    }
    return items
      .sort((a, b) => Math.abs(a.year - center) - Math.abs(b.year - center))
      .slice(0, 7)
      .sort((a, b) => a.year - b.year)
  }, [center, span])

  const candidatesKey = candidates.map((s) => `${s.personId}:${s.year}`).join('|')
  const story = candidates[index]

  useEffect(() => {
    if (candidatesKey === candidatesKeyRef.current) return
    candidatesKeyRef.current = candidatesKey
    setIndex((prev) => Math.min(prev, Math.max(0, candidates.length - 1)))
  }, [candidatesKey, candidates.length])

  useEffect(() => {
    if (!timelineFilters.stories) {
      setHighlightedStoryPersonId(null)
      return
    }
    setHighlightedStoryPersonId(story?.personId ?? null)
  }, [story, timelineFilters.stories, setHighlightedStoryPersonId])

  const move = useCallback(
    (delta: number) => {
      if (candidates.length < 2) return
      setIndex((prev) => (prev + delta + candidates.length) % candidates.length)
    },
    [candidates.length],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select')) return
      event.preventDefault()
      move(event.key === 'ArrowLeft' ? -1 : 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [move])

  const handleSwipeEnd = (clientX: number) => {
    if (swipeStartX.current == null) return
    const delta = clientX - swipeStartX.current
    swipeStartX.current = null
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return
    move(delta > 0 ? -1 : 1)
  }

  if (!timelineFilters.stories || !story) return null

  const fade = prefersReducedMotion
    ? { duration: 0.01 }
    : { duration: 0.65, ease: [0.22, 0.8, 0.2, 1] as const }

  return (
    <section
      className="featured-story"
      aria-label="Featured story"
      onPointerDown={(e) => {
        if (e.pointerType === 'touch' || e.pointerType === 'pen') {
          swipeStartX.current = e.clientX
        }
      }}
      onPointerUp={(e) => {
        if (e.pointerType === 'touch' || e.pointerType === 'pen') {
          handleSwipeEnd(e.clientX)
        }
      }}
      onPointerCancel={() => {
        swipeStartX.current = null
      }}
    >
      <div className="editorial-cloud-vapor editorial-cloud-vapor--warm" aria-hidden="true" />
      <div className="featured-story-panel">
        <div className="featured-story-header">
          <p className="featured-story-kicker">Featured Story</p>
          <div className="featured-story-nav">
            <button
              type="button"
              className="featured-story-arrow"
              aria-label="Previous featured story"
              onClick={(e) => {
                e.stopPropagation()
                move(-1)
              }}
            >
              ‹
            </button>
            <div className="featured-story-dots" role="tablist" aria-label="Featured stories">
              {candidates.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  className={`featured-story-dot ${i === index ? 'is-active' : ''}`}
                  aria-label={`Featured story ${i + 1}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setIndex(i)
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              className="featured-story-arrow"
              aria-label="Next featured story"
              onClick={(e) => {
                e.stopPropagation()
                move(1)
              }}
            >
              ›
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${story.personId}-${story.year}`}
            className="featured-story-body"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fade}
          >
            <h2 className="featured-story-headline">{story.title}</h2>
            <p className="featured-story-narrative">{story.blurb}</p>
            <button
              type="button"
              className="featured-story-read"
              onClick={(e) => {
                e.stopPropagation()
                openPerson(story.personId)
              }}
            >
              Read story →
            </button>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}
