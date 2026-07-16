import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useTimeline } from './TimelineContext'
import type { AppView } from '../types/navigation'
import { VIEW_PATHS, viewFromPath } from '../types/navigation'

type SavedViewport = { center: number; span: number }

type AppNavigationContextValue = {
  activeView: AppView
  navigateToView: (view: AppView) => void
  viewOnTimeline: (personId: string, yearRange?: { start: number; end: number }) => void
}

const AppNavigationContext = createContext<AppNavigationContextValue | null>(null)

function initialView(): AppView {
  if (typeof window === 'undefined') return 'journey'
  return viewFromPath(window.location.hash.replace('#', '') || window.location.pathname)
}

export function AppNavigationProvider({ children }: { children: ReactNode }) {
  const { center, span, animateView, openPerson, peopleById } = useTimeline()
  const [activeView, setActiveView] = useState<AppView>(initialView)

  const savedViewportRef = useRef<SavedViewport | null>(null)
  const pendingViewportRef = useRef<SavedViewport | null>(null)
  const isRestoringRef = useRef(false)

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState({ view: 'journey' }, '', '#/journey')
    }
  }, [])

  useEffect(() => {
    const onPopState = () => {
      const path = window.location.hash.replace('#', '') || '/journey'
      const view = viewFromPath(path)
      if (view === 'journey' && !pendingViewportRef.current) {
        isRestoringRef.current = true
      }
      setActiveView(view)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (activeView !== 'journey') return

    const pending = pendingViewportRef.current
    if (pending) {
      pendingViewportRef.current = null
      animateView(pending.center, pending.span, 720)
      return
    }

    if (isRestoringRef.current && savedViewportRef.current) {
      const saved = savedViewportRef.current
      isRestoringRef.current = false
      animateView(saved.center, saved.span, 480)
    }
  }, [activeView, animateView])

  const navigateToView = useCallback(
    (view: AppView) => {
      if (view !== 'journey' && activeView === 'journey') {
        savedViewportRef.current = { center, span }
      }

      const path = VIEW_PATHS[view]
      const hash = `#${path}`
      if (window.location.hash !== hash) {
        window.history.pushState({ view }, '', hash)
      }
      setActiveView(view)
    },
    [activeView, center, span],
  )

  const viewOnTimeline = useCallback(
    (personId: string, yearRange?: { start: number; end: number }) => {
      openPerson(personId)

      if (yearRange) {
        const mid = (yearRange.start + yearRange.end) / 2
        const targetSpan = Math.max(18, Math.min(90, yearRange.end - yearRange.start + 12))
        pendingViewportRef.current = { center: mid, span: targetSpan }
      } else {
        const p = peopleById[personId]
        if (p?.birthYear != null) {
          const end = p.deathYear ?? p.birthYear + 60
          const mid = (p.birthYear + end) / 2
          const targetSpan = Math.max(24, Math.min(80, end - p.birthYear + 16))
          pendingViewportRef.current = { center: mid, span: targetSpan }
        }
      }

      navigateToView('journey')
    },
    [navigateToView, openPerson, peopleById],
  )

  const value: AppNavigationContextValue = {
    activeView,
    navigateToView,
    viewOnTimeline,
  }

  return <AppNavigationContext.Provider value={value}>{children}</AppNavigationContext.Provider>
}

export function useAppNavigation() {
  const ctx = useContext(AppNavigationContext)
  if (!ctx) throw new Error('useAppNavigation must be used within AppNavigationProvider')
  return ctx
}
