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
import { getDocumentaryStats } from '../../data/documentaryStats'
import { writeDocumentarySeen } from '../../constants/documentarySession'
import { useAppNavigation } from '../../context/AppNavigationContext'
import { useJourneyIntro } from '../../context/JourneyIntroContext'
import { DOCUMENTARY_MANIFEST } from '../data/documentaryManifest'
import { finalizeManifest } from '../utils/migrationPaths'
import { AUDIO_ANALYZED_DURATION_MS } from '../core/audioSyncDirector'
import { resetDisplayRevealRegistry } from '../core/displayRevealRegistry'
import {
  DOCUMENTARY_ENTER_ATLAS_OUT_MS,
  DOCUMENTARY_ENTER_ATLAS_BLACK_MS,
  DOCUMENTARY_ENTER_PLAYBACK_TOTAL_MS,
  DOCUMENTARY_UI_FADE_MS,
} from '../data/playbackConfig'
import { resolveSceneAtTime } from '../core/SceneDirector'
import { useNarrationClock } from '../core/useNarrationClock'
import type { ResolvedScene, SceneManifestEntry } from '../types/manifest'
import type { DocumentaryStats } from '../../types/documentary'

export type DocumentaryEnginePhase = 'welcome' | 'playing' | 'ending' | 'complete'

export type DocumentaryTransition = 'idle' | 'enter-playback' | 'enter-atlas' | 'enter-ending'

type DocumentaryEngineContextValue = {
  phase: DocumentaryEnginePhase
  transition: DocumentaryTransition
  atlasHandoff: boolean
  stats: DocumentaryStats
  manifest: SceneManifestEntry[]
  currentTimeMs: number
  durationMs: number
  progress: number
  isPlaying: boolean
  isReady: boolean
  resolved: ResolvedScene | null
  begin: () => void
  exploreAtlas: () => void
  skip: () => void
  togglePause: () => void
  seek: (timeMs: number) => void
  seekGeneration: number
}

const DocumentaryEngineContext = createContext<DocumentaryEngineContextValue | null>(null)

export function DocumentaryEngineProvider({ children }: { children: ReactNode }) {
  const stats = useMemo(() => getDocumentaryStats(), [])
  const { navigateToView } = useAppNavigation()
  const { completeIntro } = useJourneyIntro()
  // Always show the fork/welcome screen on cold load and hard reload.
  // sessionStorage is only for Journey intro after the user enters Atlas.
  const [phase, setPhase] = useState<DocumentaryEnginePhase>('welcome')
  const [transition, setTransition] = useState<DocumentaryTransition>('idle')
  const [atlasHandoff, setAtlasHandoff] = useState(false)
  const exploreOutTimerRef = useRef<number | null>(null)
  const exploreDoneTimerRef = useRef<number | null>(null)

  // Back-forward cache can restore a prior "complete" tree; force the road screen again.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      setPhase('welcome')
      setTransition('idle')
      setAtlasHandoff(false)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  const clockActive = phase === 'playing'
  const { state, play, pause, toggle, seek: seekClock, reset } = useNarrationClock(clockActive)
  const [seekGeneration, setSeekGeneration] = useState(0)
  const seekRef = useRef(seekClock)
  seekRef.current = seekClock

  const seek = useCallback((timeMs: number) => {
    seekRef.current(timeMs)
    setSeekGeneration((value) => value + 1)
  }, [])

  const durationMs = state.durationMs > 0 ? state.durationMs : AUDIO_ANALYZED_DURATION_MS
  const manifest = useMemo(
    () => finalizeManifest(DOCUMENTARY_MANIFEST, durationMs),
    [durationMs],
  )

  const currentTimeMs = state.currentTimeMs
  const resolved = resolveSceneAtTime(manifest, currentTimeMs, durationMs)
  const progress = durationMs > 0 ? Math.min(1, currentTimeMs / durationMs) : 0

  const finish = useCallback(() => {
    pause()
    setTransition('enter-ending')
    window.setTimeout(() => {
      setPhase('ending')
      setTransition('idle')
    }, DOCUMENTARY_UI_FADE_MS)
  }, [pause])

  const prepareAtlasEntry = useCallback(() => {
    writeDocumentarySeen()
    pause()
    reset()
    navigateToView('journey')
    completeIntro()
  }, [completeIntro, navigateToView, pause, reset])

  const begin = useCallback(() => {
    resetDisplayRevealRegistry()
    setTransition('enter-playback')
    reset()
    setPhase('playing')
    window.setTimeout(() => {
      setTransition('idle')
    }, DOCUMENTARY_ENTER_PLAYBACK_TOTAL_MS)
  }, [reset])

  useEffect(() => {
    if (phase === 'playing') {
      void play()
    }
  }, [phase, play])

  useEffect(() => {
    if (phase === 'playing' && state.hasEnded) {
      finish()
    }
  }, [finish, phase, state.hasEnded])

  useEffect(() => {
    return () => {
      if (exploreOutTimerRef.current != null) {
        window.clearTimeout(exploreOutTimerRef.current)
      }
      if (exploreDoneTimerRef.current != null) {
        window.clearTimeout(exploreDoneTimerRef.current)
      }
    }
  }, [])

  const exploreAtlas = useCallback(() => {
    if (transition === 'enter-atlas' || phase === 'complete') return

    // Phase 1: fade welcome/ending to black only (cheap — do NOT mount Atlas yet).
    setTransition('enter-atlas')
    setAtlasHandoff(false)

    // Warm Atlas chunks during fade-to-black so events are ready when Journey mounts.
    void import('../../components/FamilyLayer')
    void import('../../components/WorldHistoryLayer')
    void import('../../components/FeaturedStory')
    void import('../../components/AtlasThinkingPanel')
    void import('../../components/AtlasMapBackdropInner')

    if (exploreOutTimerRef.current != null) {
      window.clearTimeout(exploreOutTimerRef.current)
    }
    if (exploreDoneTimerRef.current != null) {
      window.clearTimeout(exploreDoneTimerRef.current)
    }

    exploreOutTimerRef.current = window.setTimeout(() => {
      exploreOutTimerRef.current = null
      prepareAtlasEntry()
      // Phase 2: swap to Atlas on black; Atlas fades in via CSS (no overlay handoff).
      setPhase('complete')
      setTransition('idle')
      setAtlasHandoff(false)
    }, DOCUMENTARY_ENTER_ATLAS_OUT_MS + DOCUMENTARY_ENTER_ATLAS_BLACK_MS)
  }, [phase, prepareAtlasEntry, transition])

  const skip = useCallback(() => {
    seek(durationMs)
    finish()
  }, [durationMs, finish, seek])

  const value = useMemo<DocumentaryEngineContextValue>(
    () => ({
      phase,
      transition,
      atlasHandoff,
      stats,
      manifest,
      currentTimeMs,
      durationMs,
      progress,
      isPlaying: state.isPlaying,
      isReady: state.isReady,
      resolved,
      begin,
      exploreAtlas,
      skip,
      togglePause: toggle,
      seek,
      seekGeneration,
    }),
    [
      atlasHandoff,
      begin,
      currentTimeMs,
      durationMs,
      exploreAtlas,
      manifest,
      progress,
      phase,
      transition,
      resolved,
      seek,
      seekGeneration,
      skip,
      state.isPlaying,
      state.isReady,
      stats,
      toggle,
    ],
  )

  return (
    <DocumentaryEngineContext.Provider value={value}>{children}</DocumentaryEngineContext.Provider>
  )
}

export function useDocumentaryEngine(): DocumentaryEngineContextValue {
  const ctx = useContext(DocumentaryEngineContext)
  if (!ctx) {
    throw new Error('useDocumentaryEngine must be used within DocumentaryEngineProvider')
  }
  return ctx
}

export function formatEngineTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
