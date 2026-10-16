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
import { selectGuidedChapters } from './selectGuidedChapters'
import {
  clearGuidedPending,
  consumeGuidedPending,
  writeGuidedSeen,
} from './session'
import type { GuidedChapter, GuidedDiscoveryStatus, GuidedMapIntent } from './types'

type GuidedDiscoveryValue = {
  status: GuidedDiscoveryStatus
  chapters: GuidedChapter[]
  chapterIndex: number
  chapter: GuidedChapter | null
  chapterCount: number
  /** True while a detail panel is open mid-guide (visitor exploring). */
  pausedForDetail: boolean
  /** Caption visible after camera settles (false during chapter transition). */
  captionReady: boolean
  mapIntent: GuidedMapIntent | null
  start: () => void
  next: () => void
  back: () => void
  skip: () => void
  clearMapIntent: () => void
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
    setHighlightedStoryPersonId,
    setMapHighlightYears,
    setThinkingFocusRange,
  } = useTimeline()
  const { navigateToView, setTreeFocus } = useAppNavigation()
  const { completeIntro } = useJourneyIntro()
  const { active: followActive, exit: exitFollow } = useFollowPerson()

  const [status, setStatus] = useState<GuidedDiscoveryStatus>('idle')
  const [chapterIndex, setChapterIndex] = useState(0)
  const [mapIntent, setMapIntent] = useState<GuidedMapIntent | null>(null)
  const [captionReady, setCaptionReady] = useState(true)
  const appliedChapterRef = useRef<string | null>(null)
  const applyGenRef = useRef(0)
  const autoStartedRef = useRef(false)

  const chapters = useMemo(
    () => selectGuidedChapters({ database, familyEvents }),
    [database, familyEvents],
  )

  const chapter = status === 'active' ? chapters[chapterIndex] ?? null : null
  const pausedForDetail = status === 'active' && detail !== null

  const clearHighlights = useCallback(() => {
    setHighlightedStoryPersonId(null)
    setMapHighlightYears(null)
    setThinkingFocusRange(null)
  }, [setHighlightedStoryPersonId, setMapHighlightYears, setThinkingFocusRange])

  const finish = useCallback(() => {
    applyGenRef.current += 1
    writeGuidedSeen()
    clearGuidedPending()
    setStatus('completed')
    setMapIntent(null)
    setCaptionReady(true)
    appliedChapterRef.current = null
    clearHighlights()
    closeDetail()
    navigateToView('journey')
  }, [clearHighlights, closeDetail, navigateToView])

  const applyChapter = useCallback(
    (next: GuidedChapter) => {
      const gen = ++applyGenRef.current
      if (followActive) exitFollow()
      completeIntro()
      closeDetail()
      clearHighlights()
      setCaptionReady(false)

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
        animateView(next.camera.center, next.camera.span, motionDuration(920))
      }

      if (next.view === 'tree' && next.openPersonId) {
        setTreeFocus(next.openPersonId)
      }

      setMapIntent(next.view === 'map' ? next.mapIntent : null)

      // Reveal caption after the camera/view has begun to settle — no auto drawers.
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
    completeIntro()
    if (followActive) exitFollow()
    setChapterIndex(0)
    setStatus('active')
    setCaptionReady(false)
    appliedChapterRef.current = null
  }, [chapters.length, completeIntro, exitFollow, followActive, navigateToView])

  useEffect(() => {
    if (status !== 'active') return
    const current = chapters[chapterIndex]
    if (!current) {
      finish()
      return
    }
    if (appliedChapterRef.current === current.id) return
    appliedChapterRef.current = current.id
    applyChapter(current)
  }, [applyChapter, chapterIndex, chapters, finish, status])

  useEffect(() => {
    if (autoStartedRef.current) return
    if (!consumeGuidedPending()) return
    autoStartedRef.current = true
    const timer = window.setTimeout(() => start(), 120)
    return () => window.clearTimeout(timer)
  }, [start])

  const next = useCallback(() => {
    if (status !== 'active') return
    if (chapterIndex >= chapters.length - 1) {
      finish()
      return
    }
    appliedChapterRef.current = null
    setChapterIndex((i) => i + 1)
  }, [chapterIndex, chapters.length, finish, status])

  const back = useCallback(() => {
    if (status !== 'active' || chapterIndex <= 0) return
    appliedChapterRef.current = null
    setChapterIndex((i) => Math.max(0, i - 1))
  }, [chapterIndex, status])

  const skip = useCallback(() => {
    finish()
  }, [finish])

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
      mapIntent,
      start,
      next,
      back,
      skip,
      clearMapIntent,
    }),
    [
      back,
      captionReady,
      chapter,
      chapterIndex,
      chapters,
      clearMapIntent,
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
      mapIntent: null,
      start: () => {},
      next: () => {},
      back: () => {},
      skip: () => {},
      clearMapIntent: () => {},
    }
  }
  return ctx
}
