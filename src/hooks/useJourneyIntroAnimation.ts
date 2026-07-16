import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { DetailContent } from '../types'
import type { TimelineFilters } from '../types/timelineFilters'
import { DEFAULT_TIMELINE_FILTERS } from '../types/timelineFilters'
import { viewFromPath } from '../types/navigation'

export const JOURNEY_INTRO_SESSION_KEY = 'family-atlas-journey-intro-seen'

const CARD_EASE = (t: number) => 1 - Math.pow(1 - t, 3.2)

const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 2.4)

export type JourneyIntroProgress = {
  card: number
  connector: number
  brace: number
  events: number
  junction: number
}

export type JourneyIntroPhase = 'idle' | 'running' | 'complete'

export type JourneyIntroControls = {
  shouldAnimateIntro: boolean
  isIntroActive: boolean
  introPhase: JourneyIntroPhase
  introProgress: JourneyIntroProgress
  completeIntro: () => void
  eventIntroDelayMs: (eventX: number, chapterCenterX: number, orderIndex: number) => number
  eventIntroDurationMs: number
}

const TIMING = {
  card: { start: 0, duration: 480 },
  connector: { start: 300, duration: 600 },
  brace: { start: 700, duration: 450 },
  events: { start: 950, duration: 450 },
  total: 1450,
} as const

const COMPLETE_PROGRESS: JourneyIntroProgress = {
  card: 1,
  connector: 1,
  brace: 1,
  events: 1,
  junction: 1,
}

let introPlaybackCommitted = false

function readSessionSeen(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(JOURNEY_INTRO_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function writeSessionSeen(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(JOURNEY_INTRO_SESSION_KEY, '1')
  } catch {
    /* ignore quota / privacy mode */
  }
}

function filtersAreDefault(filters: TimelineFilters): boolean {
  return (Object.keys(DEFAULT_TIMELINE_FILTERS) as (keyof TimelineFilters)[]).every(
    (key) => filters[key] === DEFAULT_TIMELINE_FILTERS[key],
  )
}

function initialViewWasJourney(): boolean {
  if (typeof window === 'undefined') return true
  const path = window.location.hash.replace('#', '') || window.location.pathname
  return viewFromPath(path) === 'journey'
}

function isDefaultTimelineView(
  center: number,
  span: number,
  fullSpan: number,
  minYear: number,
  maxYear: number,
  zoomValue: number,
): boolean {
  const defaultCenter = (minYear + maxYear) / 2
  return (
    Math.abs(center - defaultCenter) < 0.5 &&
    Math.abs(span - fullSpan) < 0.5 &&
    zoomValue === 0
  )
}

type UseJourneyIntroAnimationArgs = {
  isJourneyActive: boolean
  center: number
  span: number
  fullSpan: number
  minYear: number
  maxYear: number
  zoomValue: number
  detail: DetailContent
  timelineFilters: TimelineFilters
  thinkingFocusRange: { start: number; end: number } | null
  mapHighlightYears: { start: number; end: number } | null
  isDragging: boolean
  isZooming: boolean
}

function progressAt(elapsed: number, start: number, duration: number, ease = EASE_OUT): number {
  if (elapsed <= start) return 0
  if (elapsed >= start + duration) return 1
  return ease((elapsed - start) / duration)
}

export function useJourneyIntroAnimation({
  isJourneyActive,
  center,
  span,
  fullSpan,
  minYear,
  maxYear,
  zoomValue,
  detail,
  timelineFilters,
  thinkingFocusRange,
  mapHighlightYears,
  isDragging,
  isZooming,
}: UseJourneyIntroAnimationArgs): JourneyIntroControls {
  const prefersReducedMotion = useReducedMotion()
  const [introPhase, setIntroPhase] = useState<JourneyIntroPhase>('idle')
  const [introProgress, setIntroProgress] = useState<JourneyIntroProgress>(COMPLETE_PROGRESS)

  const rafRef = useRef<number | null>(null)
  const startedRef = useRef(false)
  const baselineViewRef = useRef<{ center: number; span: number } | null>(null)
  const eligibleRef = useRef(false)

  const shouldAnimateIntro = useMemo(() => {
    if (!isJourneyActive) return false
    if (!initialViewWasJourney()) return false
    if (readSessionSeen()) return false
    if (introPlaybackCommitted) return false
    if (detail !== null) return false
    if (thinkingFocusRange !== null) return false
    if (mapHighlightYears !== null) return false
    if (!filtersAreDefault(timelineFilters)) return false
    if (!isDefaultTimelineView(center, span, fullSpan, minYear, maxYear, zoomValue)) return false
    return true
  }, [
    isJourneyActive,
    detail,
    thinkingFocusRange,
    mapHighlightYears,
    timelineFilters,
    center,
    span,
    fullSpan,
    minYear,
    maxYear,
    zoomValue,
  ])

  eligibleRef.current = shouldAnimateIntro

  const completeIntro = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setIntroProgress(COMPLETE_PROGRESS)
    setIntroPhase('complete')
    startedRef.current = true
    if (eligibleRef.current && !introPlaybackCommitted) {
      introPlaybackCommitted = true
      writeSessionSeen()
    }
  }, [])

  const startIntro = useCallback(() => {
    if (startedRef.current || introPlaybackCommitted) return
    startedRef.current = true
    introPlaybackCommitted = true
    writeSessionSeen()
    baselineViewRef.current = { center, span }
    setIntroPhase('running')
    setIntroProgress({
      card: 0,
      connector: 0,
      brace: 0,
      events: 0,
      junction: 0,
    })

    const start = performance.now()

    const tick = (now: number) => {
      const elapsed = now - start
      const card = progressAt(elapsed, TIMING.card.start, TIMING.card.duration, CARD_EASE)
      const connector = progressAt(elapsed, TIMING.connector.start, TIMING.connector.duration)
      const brace = progressAt(elapsed, TIMING.brace.start, TIMING.brace.duration)
      const events = progressAt(elapsed, TIMING.events.start, TIMING.events.duration)
      const junction = Math.min(1, connector * 0.85 + brace * 0.15)

      setIntroProgress({ card, connector, brace, events, junction })

      if (elapsed >= TIMING.total) {
        setIntroProgress(COMPLETE_PROGRESS)
        setIntroPhase('complete')
        rafRef.current = null
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [center, span])

  useEffect(() => {
    if (!shouldAnimateIntro || startedRef.current) return

    if (prefersReducedMotion) {
      introPlaybackCommitted = true
      writeSessionSeen()
      startedRef.current = true
      setIntroPhase('running')
      setIntroProgress({
        card: 0,
        connector: 0,
        brace: 0,
        events: 0,
        junction: 0,
      })

      const start = performance.now()
      const fade = (now: number) => {
        const t = Math.min(1, (now - start) / 150)
        setIntroProgress({
          card: t,
          connector: t,
          brace: t,
          events: t,
          junction: t,
        })
        if (t < 1) {
          rafRef.current = requestAnimationFrame(fade)
        } else {
          setIntroProgress(COMPLETE_PROGRESS)
          setIntroPhase('complete')
          rafRef.current = null
        }
      }
      rafRef.current = requestAnimationFrame(fade)
      return
    }

    setIntroProgress({
      card: 0,
      connector: 0,
      brace: 0,
      events: 0,
      junction: 0,
    })
    startIntro()
  }, [shouldAnimateIntro, prefersReducedMotion, startIntro])

  useEffect(() => {
    if (introPhase !== 'running') return

    if (isDragging || isZooming) {
      completeIntro()
      return
    }

    const baseline = baselineViewRef.current
    if (baseline) {
      if (Math.abs(center - baseline.center) > 0.5 || Math.abs(span - baseline.span) > 0.5) {
        completeIntro()
      }
    }
  }, [introPhase, isDragging, isZooming, center, span, completeIntro])

  useEffect(() => {
    if (introPhase !== 'running') return
    if (detail !== null) completeIntro()
  }, [introPhase, detail, completeIntro])

  useEffect(() => {
    if (introPhase !== 'running') return
    if (!filtersAreDefault(timelineFilters)) completeIntro()
  }, [introPhase, timelineFilters, completeIntro])

  useEffect(() => {
    if (introPhase !== 'running') return
    if (!isJourneyActive) completeIntro()
  }, [introPhase, isJourneyActive, completeIntro])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const eventIntroDurationMs = 300

  const eventIntroDelayMs = useCallback(
    (eventX: number, chapterCenterX: number, orderIndex: number) => {
      if (introPhase !== 'running') return 0
      const distanceWeight = Math.min(1, Math.abs(eventX - chapterCenterX) / 420)
      const orderWeight = Math.min(orderIndex * 0.06, 0.32)
      return Math.round((distanceWeight * 0.45 + orderWeight) * 320)
    },
    [introPhase],
  )

  const isIntroActive = introPhase === 'running'

  return {
    shouldAnimateIntro,
    isIntroActive,
    introPhase,
    introProgress: isIntroActive ? introProgress : COMPLETE_PROGRESS,
    completeIntro,
    eventIntroDelayMs,
    eventIntroDurationMs,
  }
}
