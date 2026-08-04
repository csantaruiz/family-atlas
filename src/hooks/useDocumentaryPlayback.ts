import { useCallback, useEffect, useRef } from 'react'
import { useJourneyIntro } from '../context/JourneyIntroContext'
import { useTimeline } from '../context/TimelineContext'
import { sceneShowsAtlas } from '../data/cinemaGrammar'
import { DOCUMENTARY_SCENES } from '../data/documentaryScript'
import type { DocumentaryScene } from '../types/documentary'

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      window.clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort)
  })
}

type PlaybackOptions = {
  isPaused: boolean
  onSceneStart: (index: number, scene: DocumentaryScene) => void
  onSceneProgress: (elapsedInSceneMs: number) => void
  onComplete: () => void
}

export function useDocumentaryPlayback({
  isPaused,
  onSceneStart,
  onSceneProgress,
  onComplete,
}: PlaybackOptions) {
  const {
    animateView,
    closeDetail,
    setHighlightedStoryPersonId,
    setThinkingFocusRange,
    setMapHighlightYears,
    setTimelineFilters,
  } = useTimeline()
  const { completeIntro } = useJourneyIntro()

  const abortRef = useRef<AbortController | null>(null)
  const pauseRef = useRef(isPaused)
  const atlasPreparedRef = useRef(false)

  pauseRef.current = isPaused

  const prepareAtlas = useCallback(() => {
    if (atlasPreparedRef.current) return
    atlasPreparedRef.current = true
    completeIntro()
    closeDetail()
    setTimelineFilters({
      births: true,
      deaths: true,
      migrations: true,
      stories: true,
      historicalEvents: false,
    })
  }, [closeDetail, completeIntro, setTimelineFilters])

  const clearAtlasFocus = useCallback(() => {
    setHighlightedStoryPersonId(null)
    setThinkingFocusRange(null)
    setMapHighlightYears(null)
    closeDetail()
    atlasPreparedRef.current = false
  }, [closeDetail, setHighlightedStoryPersonId, setMapHighlightYears, setThinkingFocusRange])

  const clearAtlasHighlights = useCallback(() => {
    setHighlightedStoryPersonId(null)
    setThinkingFocusRange(null)
    setMapHighlightYears(null)
  }, [setHighlightedStoryPersonId, setMapHighlightYears, setThinkingFocusRange])

  const applyScene = useCallback(
    (scene: DocumentaryScene) => {
      const config = scene.visualConfig ?? {}

      if (sceneShowsAtlas(scene)) {
        prepareAtlas()
        const camera = config.camera
        if (camera) {
          animateView(camera.center, camera.span, camera.animateMs ?? 4800)
        }
        setHighlightedStoryPersonId(config.highlightPersonId ?? null)
        setThinkingFocusRange(config.thinkingFocusRange ?? null)
        setMapHighlightYears(config.mapHighlightYears ?? null)
        return
      }

      clearAtlasHighlights()
    },
    [
      animateView,
      clearAtlasHighlights,
      prepareAtlas,
      setHighlightedStoryPersonId,
      setMapHighlightYears,
      setThinkingFocusRange,
    ],
  )

  const stopPlayback = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const waitWhilePaused = useCallback(async (signal: AbortSignal) => {
    while (pauseRef.current) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      await sleep(120, signal)
    }
  }, [])

  const runFromScene = useCallback(
    async (startIndex: number) => {
      stopPlayback()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        for (let index = startIndex; index < DOCUMENTARY_SCENES.length; index += 1) {
          if (controller.signal.aborted) return

          const scene = DOCUMENTARY_SCENES[index]
          onSceneStart(index, scene)
          applyScene(scene)

          let elapsed = 0
          onSceneProgress(0)

          while (elapsed < scene.durationMs) {
            if (controller.signal.aborted) return
            await waitWhilePaused(controller.signal)
            const remaining = scene.durationMs - elapsed
            const step = Math.min(200, remaining)
            const tickStarted = performance.now()
            await sleep(step, controller.signal)
            if (!pauseRef.current) {
              elapsed += performance.now() - tickStarted
              onSceneProgress(elapsed)
            }
          }
        }

        if (!controller.signal.aborted) {
          onComplete()
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        throw error
      }
    },
    [applyScene, onComplete, onSceneProgress, onSceneStart, stopPlayback, waitWhilePaused],
  )

  useEffect(() => () => stopPlayback(), [stopPlayback])

  return {
    runFromScene,
    stopPlayback,
    prepareAtlas,
    clearAtlasFocus,
  }
}
