import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useReducedMotion } from 'framer-motion'
import { useAppNavigation } from './AppNavigationContext'
import { useJourneyIntro } from './JourneyIntroContext'
import { useTimeline } from './TimelineContext'
import { buildLifeJourney } from '../utils/lifeJourney/buildLifeJourney'
import { canonicalEventId } from '../utils/canonicalEvent'
import type { LifeJourney, LifeJourneyBeat } from '../types/lifeJourney'

type SavedViewport = { center: number; span: number }

type FollowPersonContextValue = {
  active: boolean
  journey: LifeJourney | null
  beat: LifeJourneyBeat | null
  beatIndex: number
  playing: boolean
  startFollow: (personId: string) => boolean
  play: () => void
  pause: () => void
  togglePlay: () => void
  next: () => void
  prev: () => void
  goToBeat: (index: number) => void
  exit: () => void
  exploreHere: () => void
  journeyForPerson: (personId: string) => LifeJourney | null
}

const FollowPersonContext = createContext<FollowPersonContextValue | null>(null)

function spanForBeat(beat: LifeJourneyBeat, fullSpan: number): number {
  const base = beat.type === 'epilogue' ? 52 : 32
  return Math.max(18, Math.min(64, Math.min(base, fullSpan)))
}

export function FollowPersonProvider({ children }: { children: ReactNode }) {
  const {
    peopleById,
    familyEvents,
    center,
    span,
    fullSpan,
    animateView,
    openPerson,
    openFamilyEvent,
    closeDetail,
    setHighlightedStoryPersonId,
    setMapHighlightYears,
    isDragging,
    isZooming,
  } = useTimeline()
  const { activeView, navigateToView } = useAppNavigation()
  const { completeIntro } = useJourneyIntro()
  const prefersReducedMotion = useReducedMotion()

  const [journey, setJourney] = useState<LifeJourney | null>(null)
  const [beatIndex, setBeatIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const savedViewportRef = useRef<SavedViewport | null>(null)
  const advanceTimerRef = useRef(0)
  const ignoreViewExitRef = useRef(false)

  const journeyForPerson = useCallback(
    (personId: string) => {
      const person = peopleById[personId]
      if (!person) return null
      return buildLifeJourney(person, familyEvents)
    },
    [familyEvents, peopleById],
  )

  const beat = journey?.beats[beatIndex] ?? null
  const active = journey != null

  const applyBeatView = useCallback(
    (next: LifeJourneyBeat) => {
      animateView(next.year, spanForBeat(next, fullSpan), prefersReducedMotion ? 0 : 720)
      setMapHighlightYears({ start: next.year - 1, end: next.year + 1 })
    },
    [animateView, fullSpan, prefersReducedMotion, setMapHighlightYears],
  )

  const startFollow = useCallback(
    (personId: string) => {
      const next = journeyForPerson(personId)
      if (!next?.eligible || next.beats.length === 0) return false

      savedViewportRef.current = { center, span }
      completeIntro()
      closeDetail()
      ignoreViewExitRef.current = true
      if (activeView !== 'journey') navigateToView('journey')

      setJourney(next)
      setBeatIndex(0)
      setPlaying(!prefersReducedMotion)
      setHighlightedStoryPersonId(personId)
      applyBeatView(next.beats[0])
      return true
    },
    [
      activeView,
      applyBeatView,
      center,
      closeDetail,
      completeIntro,
      journeyForPerson,
      navigateToView,
      prefersReducedMotion,
      setHighlightedStoryPersonId,
      span,
    ],
  )

  const clearFollow = useCallback(() => {
    window.clearTimeout(advanceTimerRef.current)
    setJourney(null)
    setBeatIndex(0)
    setPlaying(false)
    setHighlightedStoryPersonId(null)
    setMapHighlightYears(null)
  }, [setHighlightedStoryPersonId, setMapHighlightYears])

  const exit = useCallback(() => {
    const personId = journey?.personId
    const saved = savedViewportRef.current
    savedViewportRef.current = null
    clearFollow()
    if (saved) animateView(saved.center, saved.span, prefersReducedMotion ? 0 : 560)
    if (personId) openPerson(personId)
  }, [animateView, clearFollow, journey?.personId, openPerson, prefersReducedMotion])

  const goToBeat = useCallback(
    (index: number) => {
      if (!journey) return
      const nextIndex = Math.max(0, Math.min(journey.beats.length - 1, index))
      setBeatIndex(nextIndex)
      const nextBeat = journey.beats[nextIndex]
      if (nextBeat) applyBeatView(nextBeat)
    },
    [applyBeatView, journey],
  )

  const next = useCallback(() => {
    if (!journey) return
    if (beatIndex >= journey.beats.length - 1) {
      setPlaying(false)
      return
    }
    goToBeat(beatIndex + 1)
  }, [beatIndex, goToBeat, journey])

  const prev = useCallback(() => {
    if (!journey) return
    goToBeat(beatIndex - 1)
  }, [beatIndex, goToBeat, journey])

  const play = useCallback(() => setPlaying(true), [])
  const pause = useCallback(() => setPlaying(false), [])
  const togglePlay = useCallback(() => setPlaying((value) => !value), [])

  const exploreHere = useCallback(() => {
    if (!journey || !beat) return
    setPlaying(false)
    const event = beat.eventId
      ? familyEvents.find((item) => canonicalEventId(item) === beat.eventId)
      : null
    if (event && (event.kind === 'service' || event.kind === 'move' || event.kind === 'marriage')) {
      openFamilyEvent(event)
      return
    }
    openPerson(journey.personId)
  }, [beat, familyEvents, journey, openFamilyEvent, openPerson])

  useEffect(() => {
    if (!active || !playing || !beat || prefersReducedMotion) return
    advanceTimerRef.current = window.setTimeout(() => {
      if (beatIndex >= (journey?.beats.length ?? 1) - 1) {
        setPlaying(false)
        return
      }
      goToBeat(beatIndex + 1)
    }, beat.durationMs)
    return () => window.clearTimeout(advanceTimerRef.current)
  }, [active, beat, beatIndex, goToBeat, journey?.beats.length, playing, prefersReducedMotion])

  useEffect(() => {
    if (active && (isDragging || isZooming)) setPlaying(false)
  }, [active, isDragging, isZooming])

  useEffect(() => {
    if (ignoreViewExitRef.current) {
      ignoreViewExitRef.current = false
      return
    }
    if (active && activeView !== 'journey') exit()
  }, [active, activeView, exit])

  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select')) return
      if (event.key === 'Escape') {
        event.preventDefault()
        exit()
        return
      }
      if (event.key === ' ') {
        event.preventDefault()
        togglePlay()
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        next()
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        prev()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, exit, next, prev, togglePlay])

  const value = useMemo<FollowPersonContextValue>(
    () => ({
      active,
      journey,
      beat,
      beatIndex,
      playing,
      startFollow,
      play,
      pause,
      togglePlay,
      next,
      prev,
      goToBeat,
      exit,
      exploreHere,
      journeyForPerson,
    }),
    [
      active,
      beat,
      beatIndex,
      exit,
      exploreHere,
      goToBeat,
      journey,
      journeyForPerson,
      next,
      pause,
      play,
      playing,
      prev,
      startFollow,
      togglePlay,
    ],
  )

  return <FollowPersonContext.Provider value={value}>{children}</FollowPersonContext.Provider>
}

export function useFollowPerson(): FollowPersonContextValue {
  const ctx = useContext(FollowPersonContext)
  if (!ctx) {
    return {
      active: false,
      journey: null,
      beat: null,
      beatIndex: 0,
      playing: false,
      startFollow: () => false,
      play: () => {},
      pause: () => {},
      togglePlay: () => {},
      next: () => {},
      prev: () => {},
      goToBeat: () => {},
      exit: () => {},
      exploreHere: () => {},
      journeyForPerson: () => null,
    }
  }
  return ctx
}
