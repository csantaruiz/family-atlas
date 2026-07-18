import { useLayoutEffect, useRef, useState } from 'react'
import type { AppView } from '../types/navigation'

export const ATLAS_PAGE_TRANSITION_MS = 680
export const ATLAS_PAGE_BLUR_PX = 11

export type ViewLayerState = {
  present: boolean
  opacity: number
  blur: number
  interactive: boolean
  stack: number
}

export type ViewLayerMap = Record<AppView, ViewLayerState>

const ALL_VIEWS: AppView[] = ['journey', 'people', 'tree', 'map', 'about']

function buildLayers(active: AppView): ViewLayerMap {
  const idle = (isActive: boolean): ViewLayerState => ({
    present: isActive,
    opacity: isActive ? 1 : 0,
    blur: 0,
    interactive: isActive,
    stack: isActive ? 2 : 0,
  })

  return {
    journey: idle(active === 'journey'),
    people: idle(active === 'people'),
    tree: idle(active === 'tree'),
    map: idle(active === 'map'),
    about: idle(active === 'about'),
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useAtlasPageTransition(activeView: AppView) {
  const currentViewRef = useRef(activeView)
  const isFirstRenderRef = useRef(true)
  const rafRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const [layers, setLayers] = useState<ViewLayerMap>(() => buildLayers(activeView))
  const [transitionMs, setTransitionMs] = useState(ATLAS_PAGE_TRANSITION_MS)

  useLayoutEffect(() => {
    const clearScheduled = () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      currentViewRef.current = activeView
      setLayers(buildLayers(activeView))
      return clearScheduled
    }

    const outgoing = currentViewRef.current
    if (outgoing === activeView) return clearScheduled

    currentViewRef.current = activeView
    clearScheduled()

    if (prefersReducedMotion()) {
      setTransitionMs(0)
      setLayers(buildLayers(activeView))
      return clearScheduled
    }

    setTransitionMs(ATLAS_PAGE_TRANSITION_MS)

    setLayers((prev) => ({
      ...prev,
      [outgoing]: {
        present: true,
        opacity: 1,
        blur: 0,
        interactive: false,
        stack: 1,
      },
      [activeView]: {
        present: true,
        opacity: 0,
        blur: ATLAS_PAGE_BLUR_PX,
        interactive: false,
        stack: 2,
      },
    }))

    rafRef.current = requestAnimationFrame(() => {
      setLayers((prev) => ({
        ...prev,
        [outgoing]: {
          ...prev[outgoing],
          opacity: 0,
          blur: ATLAS_PAGE_BLUR_PX,
          interactive: false,
          stack: 1,
        },
        [activeView]: {
          ...prev[activeView],
          opacity: 1,
          blur: 0,
          interactive: true,
          stack: 2,
        },
      }))
    })

    timerRef.current = window.setTimeout(() => {
      setLayers(buildLayers(activeView))
      timerRef.current = null
    }, ATLAS_PAGE_TRANSITION_MS)

    return clearScheduled
  }, [activeView])

  return { layers, transitionMs, views: ALL_VIEWS }
}
