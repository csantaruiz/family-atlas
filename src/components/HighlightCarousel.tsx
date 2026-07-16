import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { storySeeds } from '../data'
import { useTimeline } from '../context/TimelineContext'
import { viewport } from '../utils/timelineMath'

const AUTO_ADVANCE_MS = 5200

export function HighlightCarousel() {
  const { center, span, peopleById, openPerson } = useTimeline()
  const [index, setIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const timerRef = useRef<number | null>(null)
  const carouselKeyRef = useRef('')

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
      .map((s) => ({
        ...s,
        personName: peopleById[s.personId]?.name ?? 'Unknown',
      }))
  }, [center, span, peopleById])

  const key = candidates.map((s) => `${s.personId}:${s.year}`).join('|')

  useEffect(() => {
    if (key === carouselKeyRef.current) return
    carouselKeyRef.current = key
    setIndex((prev) => Math.min(prev, Math.max(0, candidates.length - 1)))
  }, [key, candidates.length])

  const scheduleAdvance = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      if (candidates.length > 1) {
        setIndex((prev) => (prev + 1) % candidates.length)
        scheduleAdvance()
      }
    }, AUTO_ADVANCE_MS)
  }, [candidates.length])

  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      return
    }
    scheduleAdvance()
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [isPaused, scheduleAdvance, index])

  const move = (delta: number) => {
    if (candidates.length < 2) return
    setIndex((prev) => (prev + delta + candidates.length) % candidates.length)
    scheduleAdvance()
  }

  if (!candidates.length) return null

  return (
    <div
      className="story-rail"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <button
        type="button"
        className="story-nav prev"
        aria-label="Previous highlight"
        onClick={(e) => {
          e.stopPropagation()
          move(-1)
        }}
      >
        ‹
      </button>
      <div className="story-carousel">
        {candidates.map((story, i) => (
          <button
            key={`${story.personId}-${story.year}`}
            type="button"
            className={`story-card ${i === index ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              openPerson(story.personId)
            }}
          >
            <span className="story-year">{story.year}</span>
            <div className="story-kicker">{story.kicker}</div>
            <strong>{story.title}</strong>
            <span>{story.blurb}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="story-nav next"
        aria-label="Next highlight"
        onClick={(e) => {
          e.stopPropagation()
          move(1)
        }}
      >
        ›
      </button>
      <div className="story-dots">
        {candidates.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`story-dot ${i === index ? 'active' : ''}`}
            aria-label={`Show highlight ${i + 1}`}
            onClick={(e) => {
              e.stopPropagation()
              setIndex(i)
              scheduleAdvance()
            }}
          />
        ))}
      </div>
    </div>
  )
}
