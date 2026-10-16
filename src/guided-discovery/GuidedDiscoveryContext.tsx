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
import { useFamilyData } from '../family-data/FamilyDataProvider'
import { useAppNavigation } from '../context/AppNavigationContext'
import { useTimeline } from '../context/TimelineContext'
import { useJourneyIntro } from '../context/JourneyIntroContext'
import { useFollowPerson } from '../context/FollowPersonContext'
import { useAmbientSoundtrack } from '../soundtrack/AmbientSoundtrackContext'
import { selectGuidedChapters } from './selectGuidedChapters'
import {
  clearGuidedPending,
  consumeGuidedPending,
  writeGuidedSeen,
} from './session'
import type { GuidedChapter, GuidedDiscoveryStatus, GuidedMapIntent } from './types'

export const GUIDED_CLOSING_LINE =
  'Five centuries. Hundreds of lives. One connected family story.'

type GuidedDiscoveryValue = {
  status: GuidedDiscoveryStatus
  chapters: GuidedChapter[]
  chapterIndex: number
  chapter: GuidedChapter | null
  chapterCount: number
  pausedForDetail: boolean
  captionReady: boolean
  /** Closing epilogue line visible after the full-history zoom settles. */
  closingLineVisible: boolean
  mapIntent: GuidedMapIntent | null
  start: () => void
  next: () => void
  back: () => void
  /** Exit early — no cinematic closing zoom. */
  skip: () => void
  clearMapIntent: () => void
  /** Interrupt the closing zoom and enter free exploration immediately. */
  interruptClosing: () => void
}

const GuidedDiscoveryContext = createContext<GuidedDiscoveryValue | null>(null)

function motionDuration(preferredMs: number): number {
  if (typeof window === 'undefined') return preferredMs
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : preferredMs
}

export function GuidedDiscoveryProvider({ children }: { children: ReactNode }) {
  const { database } = useFamilyData()
  const {
    familyEvents,
    animateView,
    closeDetail,
    detail,
    minYear,
    maxYear,
    fullSpan,
    setHighlightedStoryPersonId,
    setMapHighlightYears,
    setThinkingFocusRange,
  } = useTimeline()
  const { navigateToView, setTreeFocus } = useAppNavigation()
  const { completeIntro } = useJourneyIntro()
  const { active: followActive, exit: exitFollow } = useFollowPerson()
  const { enableSoundFromGesture } = useAmbientSoundtrack()

  const [status, setStatus] = useState<GuidedDiscoveryStatus>('idle')
  const [chapterIndex, setChapterIndex] = useState(0)
  const [mapIntent, setMapIntent] = useState<GuidedMapIntent | null>(null)
  const [captionReady, setCaptionReady] = useState(true)
  const [closingLineVisible, setClosingLineVisible] = useState(false)
  const appliedChapterRef = useRef<string | null>(null)
  const applyGenRef = useRef(0)
  const closingGenRef = useRef(0)
  const autoStartedRef = useRef(false)
  const closingTimersRef = useRef<number[]>([])

  const chapters = useMemo(
    () => selectGuidedChapters({ database, familyEvents }),
    [database, familyEvents],
  )

  const chapter = status === 'active' ? chapters[chapterIndex] ?? null : null
  const pausedForDetail = status === 'active' && detail !== null

  const clearClosingTimers = useCallback(() => {
    for (const id of closingTimersRef.current) window.clearTimeout(id)
    closingTimersRef.current = []
  }, [])

  const clearHighlights = useCallback(() => {
    setHighlightedStoryPersonId(null)
    setMapHighlightYears(null)
    setThinkingFocusRange(null)
  }, [setHighlightedStoryPersonId, setMapHighlightYears, setThinkingFocusRange])

  /** Immediate exit to free exploration (Skip / interrupt). No closing epilogue. */
  const exitToExploration = useCallback(() => {
    applyGenRef.current += 1
    closingGenRef.current += 1
    clearClosingTimers()
    writeGuidedSeen()
    clearGuidedPending()
    setStatus('completed')
    setMapIntent(null)
    setCaptionReady(true)
    setClosingLineVisible(false)
    appliedChapterRef.current = null
    clearHighlights()
    closeDetail()
    navigateToView('journey')
  }, [clearClosingTimers, clearHighlights, closeDetail, navigateToView])

  const finishWithClosing = useCallback(() => {
    const gen = ++closingGenRef.current
    applyGenRef.current += 1
    clearClosingTimers()
    writeGuidedSeen()
    clearGuidedPending()
    completeIntro()
    if (followActive) exitFollow()
    closeDetail()
    clearHighlights()
    setCaptionReady(false)
    setClosingLineVisible(false)
    setMapIntent(null)
    appliedChapterRef.current = null
    setStatus('closing')
    navigateToView('journey')

    const rangeStart = minYear
    const rangeEnd = maxYear
    const span = Math.max(40, fullSpan > 0 ? fullSpan : rangeEnd - rangeStart)
    const center = (rangeStart + rangeEnd) / 2
    const zoomMs = motionDuration(1600)
    const lineInDelay = zoomMs
    const lineHoldMs = motionDuration(2800)
    const lineOutMs = motionDuration(900)

    animateView(center, span, zoomMs)
    setMapHighlightYears({ start: rangeStart, end: rangeEnd })

    const showLine = window.setTimeout(() => {
      if (gen !== closingGenRef.current) return
      setClosingLineVisible(true)
    }, lineInDelay)

    const hideLine = window.setTimeout(() => {
      if (gen !== closingGenRef.current) return
      setClosingLineVisible(false)
    }, lineInDelay + lineHoldMs)

    const complete = window.setTimeout(() => {
      if (gen !== closingGenRef.current) return
      clearHighlights()
      setClosingLineVisible(false)
      setStatus('completed')
    }, lineInDelay + lineHoldMs + lineOutMs)

    closingTimersRef.current = [showLine, hideLine, complete]
  }, [
    animateView,
    clearClosingTimers,
    clearHighlights,
    closeDetail,
    completeIntro,
    exitFollow,
    followActive,
    fullSpan,
    maxYear,
    minYear,
    navigateToView,
    setMapHighlightYears,
  ])

  const applyChapter = useCallback(
    (next: GuidedChapter) => {
      const gen = ++applyGenRef.current
      if (followActive) exitFollow()
      completeIntro()
      closeDetail()
      clearHighlights()
      setCaptionReady(false)
      setClosingLineVisible(false)

      if (next.highlightPersonIds[0]) {
        setHighlightedStoryPersonId(next.highlightPersonIds[0])
      }

      const historyYear = next.focusHistory?.year
      if (next.camera) {
        setMapHighlightYears({
          start: next.camera.center - next.camera.span / 2,
          end: next.camera.center + next.camera.span / 2,
        })
      } else if (historyYear != null) {
        setMapHighlightYears({ start: historyYear - 12, end: historyYear + 12 })
      }

      navigateToView(next.view)

      if (next.view === 'journey' && next.camera) {
        // Bias the subject slightly above vertical center so the bottom caption
        // does not cover the focal markers (camera is year-based; span leaves room).
        animateView(next.camera.center, next.camera.span, motionDuration(920))
      }

      if (next.view === 'tree' && next.openPersonId) {
        setTreeFocus(next.openPersonId)
      }

      setMapIntent(next.view === 'map' ? next.mapIntent : null)

      window.setTimeout(() => {
        if (gen !== applyGenRef.current) return
        setCaptionReady(true)
      }, motionDuration(640))
    },
    [
      animateView,
      clearHighlights,
      closeDetail,
      completeIntro,
      exitFollow,
      followActive,
      navigateToView,
      setHighlightedStoryPersonId,
      setMapHighlightYears,
      setTreeFocus,
    ],
  )

  const start = useCallback(() => {
    if (chapters.length === 0) {
      writeGuidedSeen()
      setStatus('completed')
      navigateToView('journey')
      return
    }
    // Explicit guided start is a user gesture — attempt a gentle ambient fade-in.
    enableSoundFromGesture()
    completeIntro()
    if (followActive) exitFollow()
    setChapterIndex(0)
    setStatus('active')
    setCaptionReady(false)
    setClosingLineVisible(false)
    appliedChapterRef.current = null
  }, [
    chapters.length,
    completeIntro,
    enableSoundFromGesture,
    exitFollow,
    followActive,
    navigateToView,
  ])

  useEffect(() => {
    if (status !== 'active') return
    const current = chapters[chapterIndex]
    if (!current) {
      exitToExploration()
      return
    }
    if (appliedChapterRef.current === current.id) return
    appliedChapterRef.current = current.id
    applyChapter(current)
  }, [applyChapter, chapterIndex, chapters, exitToExploration, status])

  useEffect(() => {
    if (autoStartedRef.current) return
    if (!consumeGuidedPending()) return
    autoStartedRef.current = true
    const timer = window.setTimeout(() => start(), 120)
    return () => window.clearTimeout(timer)
  }, [start])

  // Allow visitor to interrupt the closing zoom after the Finish click settles.
  useEffect(() => {
    if (status !== 'closing') return
    let armed = false
    const armTimer = window.setTimeout(() => {
      armed = true
    }, 450)
    const onInterrupt = () => {
      if (!armed) return
      closingGenRef.current += 1
      clearClosingTimers()
      clearHighlights()
      setClosingLineVisible(false)
      setStatus('completed')
    }
    window.addEventListener('pointerdown', onInterrupt, { capture: true })
    window.addEventListener('wheel', onInterrupt, { capture: true, passive: true })
    window.addEventListener('keydown', onInterrupt, { capture: true })
    return () => {
      window.clearTimeout(armTimer)
      window.removeEventListener('pointerdown', onInterrupt, { capture: true })
      window.removeEventListener('wheel', onInterrupt, { capture: true })
      window.removeEventListener('keydown', onInterrupt, { capture: true })
    }
  }, [clearClosingTimers, clearHighlights, status])

  useEffect(() => () => clearClosingTimers(), [clearClosingTimers])

  const next = useCallback(() => {
    if (status !== 'active') return
    if (chapterIndex >= chapters.length - 1) {
      finishWithClosing()
      return
    }
    appliedChapterRef.current = null
    setChapterIndex((i) => i + 1)
  }, [chapterIndex, chapters.length, finishWithClosing, status])

  const back = useCallback(() => {
    if (status !== 'active' || chapterIndex <= 0) return
    appliedChapterRef.current = null
    setChapterIndex((i) => Math.max(0, i - 1))
  }, [chapterIndex, status])

  const skip = useCallback(() => {
    exitToExploration()
  }, [exitToExploration])

  const interruptClosing = useCallback(() => {
    if (status !== 'closing') return
    exitToExploration()
  }, [exitToExploration, status])

  const clearMapIntent = useCallback(() => setMapIntent(null), [])

  const value = useMemo<GuidedDiscoveryValue>(
    () => ({
      status,
      chapters,
      chapterIndex,
      chapter,
      chapterCount: chapters.length,
      pausedForDetail,
      captionReady,
      closingLineVisible,
      mapIntent,
      start,
      next,
      back,
      skip,
      clearMapIntent,
      interruptClosing,
    }),
    [
      back,
      captionReady,
      chapter,
      chapterIndex,
      chapters,
      clearMapIntent,
      closingLineVisible,
      interruptClosing,
      mapIntent,
      next,
      pausedForDetail,
      skip,
      start,
      status,
    ],
  )

  return (
    <GuidedDiscoveryContext.Provider value={value}>{children}</GuidedDiscoveryContext.Provider>
  )
}

export function useGuidedDiscovery(): GuidedDiscoveryValue {
  const ctx = useContext(GuidedDiscoveryContext)
  if (!ctx) {
    return {
      status: 'idle',
      chapters: [],
      chapterIndex: 0,
      chapter: null,
      chapterCount: 0,
      pausedForDetail: false,
      captionReady: true,
      closingLineVisible: false,
      mapIntent: null,
      start: () => {},
      next: () => {},
      back: () => {},
      skip: () => {},
      clearMapIntent: () => {},
      interruptClosing: () => {},
    }
  }
  return ctx
}
