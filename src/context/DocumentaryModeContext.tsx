import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAppNavigation } from './AppNavigationContext'
import { useJourneyIntro } from './JourneyIntroContext'
import { useTimeline } from './TimelineContext'
import { getDocumentaryStats } from '../data/documentaryStats'
import {
  DOCUMENTARY_SCENES,
  DOCUMENTARY_TOTAL_MS,
  DOCUMENTARY_CHAPTERS,
  chapterIndexForScene,
  formatDocumentaryDuration,
} from '../data/documentaryScript'
import { sceneShowsAtlas, shouldShowNarration } from '../data/cinemaGrammar'
import { useDocumentaryPlayback } from '../hooks/useDocumentaryPlayback'
import type { DocumentaryPhase, DocumentaryScene, DocumentaryStats } from '../types/documentary'
import { readDocumentarySeen, writeDocumentarySeen } from '../constants/documentarySession'

type DocumentaryModeContextValue = {
  phase: DocumentaryPhase
  stats: DocumentaryStats
  sceneIndex: number
  sceneElapsedMs: number
  currentScene: DocumentaryScene | null
  sectionIndex: number
  sections: typeof DOCUMENTARY_CHAPTERS
  totalDurationMs: number
  elapsedMs: number
  remainingMs: number
  progress: number
  isPaused: boolean
  isPlaybackActive: boolean
  isDocumentaryStage: boolean
  /** True only during brief atlas-orientation beats. */
  showsAtlas: boolean
  /** True during full-screen Ken Burns scenes (maps, documents, portraits, titles). */
  isCinematicScene: boolean
  narrationVisible: boolean
  beginDocumentary: () => void
  skipToAtlas: () => void
  exploreAtlas: () => void
  continueDocumentary: () => void
  togglePause: () => void
  skipOpening: () => void
}

const DocumentaryModeContext = createContext<DocumentaryModeContextValue | null>(null)

function elapsedBeforeScene(sceneIndex: number): number {
  return DOCUMENTARY_SCENES.slice(0, sceneIndex).reduce((sum, scene) => sum + scene.durationMs, 0)
}

export function DocumentaryModeProvider({ children }: { children: ReactNode }) {
  const { activeView, navigateToView } = useAppNavigation()
  const {
    animateView,
    setHighlightedStoryPersonId,
    setThinkingFocusRange,
    setMapHighlightYears,
  } = useTimeline()
  const { completeIntro } = useJourneyIntro()
  const stats = useMemo(() => getDocumentaryStats(), [])

  const [phase, setPhase] = useState<DocumentaryPhase>(() =>
    readDocumentarySeen() ? 'complete' : 'welcome',
  )
  const [sceneIndex, setSceneIndex] = useState(0)
  const [sceneElapsedMs, setSceneElapsedMs] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [narrationVisible, setNarrationVisible] = useState(false)

  const currentScene = DOCUMENTARY_SCENES[sceneIndex] ?? null
  const showsAtlas = phase === 'playing' && currentScene !== null && sceneShowsAtlas(currentScene)
  const isCinematicScene = phase === 'playing' && currentScene !== null && !sceneShowsAtlas(currentScene)
  const sectionIndex = chapterIndexForScene(sceneIndex)
  const elapsedMs = elapsedBeforeScene(sceneIndex) + sceneElapsedMs
  const remainingMs = Math.max(0, DOCUMENTARY_TOTAL_MS - elapsedMs)
  const progress = DOCUMENTARY_TOTAL_MS > 0 ? Math.min(1, elapsedMs / DOCUMENTARY_TOTAL_MS) : 0
  const isPlaybackActive = phase === 'playing' || phase === 'transition'
  const isDocumentaryStage = isPlaybackActive

  const markComplete = useCallback(() => {
    writeDocumentarySeen()
    setHighlightedStoryPersonId(null)
    setThinkingFocusRange(null)
    setMapHighlightYears(null)
    setPhase('complete')
    setIsPaused(false)
    setNarrationVisible(false)
  }, [setHighlightedStoryPersonId, setMapHighlightYears, setThinkingFocusRange])

  const finishOpening = useCallback(() => {
    const lastScene = DOCUMENTARY_SCENES[DOCUMENTARY_SCENES.length - 1]
    const camera = lastScene?.visualConfig?.camera
    if (camera) {
      animateView(camera.center, camera.span, 1400)
    }
    setPhase('ending')
    setNarrationVisible(false)
  }, [animateView])

  const { runFromScene, stopPlayback, clearAtlasFocus } = useDocumentaryPlayback({
    isPaused,
    onSceneStart: (index, scene) => {
      setSceneIndex(index)
      setSceneElapsedMs(0)
      setNarrationVisible(false)

      const hasNarration = shouldShowNarration(scene)
      const delay =
        scene.visual === 'title-card'
          ? 400
          : scene.visual === 'atlas-orientation'
            ? 800
            : hasNarration
              ? 650
              : 0

      if (hasNarration) {
        window.setTimeout(() => setNarrationVisible(true), delay)
      }
    },
    onSceneProgress: (elapsedInSceneMs) => {
      setSceneElapsedMs(elapsedInSceneMs)
    },
    onComplete: finishOpening,
  })

  useEffect(() => {
    if (isDocumentaryStage && activeView !== 'journey') {
      navigateToView('journey')
    }
  }, [activeView, isDocumentaryStage, navigateToView])

  const beginDocumentary = useCallback(() => {
    clearAtlasFocus()
    navigateToView('journey')
    setSceneIndex(0)
    setSceneElapsedMs(0)
    setIsPaused(false)
    setPhase('transition')
    window.setTimeout(() => {
      setPhase('playing')
      void runFromScene(0)
    }, 1800)
  }, [clearAtlasFocus, navigateToView, runFromScene])

  const skipToAtlas = useCallback(() => {
    stopPlayback()
    clearAtlasFocus()
    completeIntro()
    navigateToView('journey')
    markComplete()
  }, [clearAtlasFocus, completeIntro, markComplete, navigateToView, stopPlayback])

  const exploreAtlas = useCallback(() => {
    stopPlayback()
    completeIntro()
    navigateToView('journey')
    markComplete()
  }, [completeIntro, markComplete, navigateToView, stopPlayback])

  const continueDocumentary = useCallback(() => {}, [])

  const togglePause = useCallback(() => {
    setIsPaused((paused) => !paused)
  }, [])

  const skipOpening = useCallback(() => {
    stopPlayback()
    setIsPaused(false)
    finishOpening()
  }, [finishOpening, stopPlayback])

  const value = useMemo<DocumentaryModeContextValue>(
    () => ({
      phase,
      stats,
      sceneIndex,
      sceneElapsedMs,
      currentScene,
      sectionIndex,
      sections: DOCUMENTARY_CHAPTERS,
      totalDurationMs: DOCUMENTARY_TOTAL_MS,
      elapsedMs,
      remainingMs,
      progress,
      isPaused,
      isPlaybackActive,
      isDocumentaryStage,
      showsAtlas,
      isCinematicScene,
      narrationVisible,
      beginDocumentary,
      skipToAtlas,
      exploreAtlas,
      continueDocumentary,
      togglePause,
      skipOpening,
    }),
    [
      beginDocumentary,
      continueDocumentary,
      currentScene,
      elapsedMs,
      exploreAtlas,
      isCinematicScene,
      isDocumentaryStage,
      isPaused,
      isPlaybackActive,
      narrationVisible,
      phase,
      progress,
      remainingMs,
      sceneElapsedMs,
      sceneIndex,
      sectionIndex,
      showsAtlas,
      skipOpening,
      skipToAtlas,
      stats,
      togglePause,
    ],
  )

  return <DocumentaryModeContext.Provider value={value}>{children}</DocumentaryModeContext.Provider>
}

export function useDocumentaryMode(): DocumentaryModeContextValue {
  const ctx = useContext(DocumentaryModeContext)
  if (!ctx) {
    return {
      phase: 'complete',
      stats: getDocumentaryStats(),
      sceneIndex: 0,
      sceneElapsedMs: 0,
      currentScene: null,
      sectionIndex: 0,
      sections: DOCUMENTARY_CHAPTERS,
      totalDurationMs: DOCUMENTARY_TOTAL_MS,
      elapsedMs: 0,
      remainingMs: DOCUMENTARY_TOTAL_MS,
      progress: 0,
      isPaused: false,
      isPlaybackActive: false,
      isDocumentaryStage: false,
      showsAtlas: false,
      isCinematicScene: false,
      narrationVisible: false,
      beginDocumentary: () => {},
      skipToAtlas: () => {},
      exploreAtlas: () => {},
      continueDocumentary: () => {},
      togglePause: () => {},
      skipOpening: () => {},
    }
  }
  return ctx
}

export { formatDocumentaryDuration }
