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
  mapIntent: GuidedMapIntent | null
  start: () => void
  next: () => void
  back: () => void
  skip: () => void
  /** Clear a consumed map intent after MapView applies it. */
  clearMapIntent: () => void
}

const GuidedDiscoveryContext = createContext<GuidedDiscoveryValue | null>(null)

function motionDuration(preferredMs: number): number {
  if (typeof window === 'undefined') return preferredMs
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : preferredMs
}

export function GuidedDiscoveryProvider({ children }: { children: ReactNode }) {
  const { database } = useFamilyData()
  const { familyEvents, animateView, openPerson, openHistory, closeDetail, detail, setHighlightedStoryPersonId, setMapHighlightYears, setThinkingFocusRange } =
    useTimeline()
  const { navigateToView, setTreeFocus } = useAppNavigation()
  const { completeIntro } = useJourneyIntro()
  const { active: followActive, exit: exitFollow } = useFollowPerson()

  const [status, setStatus] = useState<GuidedDiscoveryStatus>('idle')
  const [chapterIndex, setChapterIndex] = useState(0)
  const [mapIntent, setMapIntent] = useState<GuidedMapIntent | null>(null)
  const appliedChapterRef = useRef<string | null>(null)
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
    writeGuidedSeen()
    clearGuidedPending()
    setStatus('completed')
    setMapIntent(null)
    appliedChapterRef.current = null
    clearHighlights()
    closeDetail()
    navigateToView('journey')
  }, [clearHighlights, closeDetail, navigateToView])

  const applyChapter = useCallback(
    (next: GuidedChapter) => {
      if (followActive) exitFollow()
      completeIntro()
      closeDetail()
      clearHighlights()

      if (next.highlightPersonIds[0]) {
        setHighlightedStoryPersonId(next.highlightPersonIds[0])
      }
      if (next.camera) {
        setMapHighlightYears({
          start: next.camera.center - next.camera.span / 2,
          end: next.camera.center + next.camera.span / 2,
        })
      }

      navigateToView(next.view)

      if (next.view === 'journey' && next.camera) {
        animateView(next.camera.center, next.camera.span, motionDuration(900))
      }

      if (next.view === 'tree' && next.openPersonId) {
        setTreeFocus(next.openPersonId)
      }

      setMapIntent(next.view === 'map' ? next.mapIntent : null)

      // Defer panel opens so camera/view transitions begin first.
      window.setTimeout(() => {
        if (next.openHistory) {
          openHistory(next.openHistory)
          return
        }
        if (next.openPersonId && next.kind !== 'branches') {
          // Branches keep multiple highlights without locking one panel.
          if (next.kind === 'origins' || next.kind === 'present' || next.kind === 'world_in_change') {
            if (next.kind === 'world_in_change') return
            openPerson(next.openPersonId)
          }
        }
      }, motionDuration(700))
    },
    [
      animateView,
      clearHighlights,
      closeDetail,
      completeIntro,
      exitFollow,
      followActive,
      navigateToView,
      openHistory,
      openPerson,
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
    appliedChapterRef.current = null
  }, [chapters.length, completeIntro, exitFollow, followActive, navigateToView])

  // Apply chapter when index/status changes.
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

  // Auto-start after Explore Our Family Story for first-time visitors.
  useEffect(() => {
    if (autoStartedRef.current) return
    if (!consumeGuidedPending()) return
    autoStartedRef.current = true
    // Wait a tick so Atlas shell + Journey intro mount cleanly.
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
      mapIntent,
      start,
      next,
      back,
      skip,
      clearMapIntent,
    }),
    [
      back,
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
