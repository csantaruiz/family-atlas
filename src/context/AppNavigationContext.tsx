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
  viewOnTree: (personId: string) => void
  returnToTimeline: () => void
  treeReturnViewport: SavedViewport | null
  /** null = household focus (Craig & Leah). */
  focusedTreePersonId: string | null
  /** Genealogical focus trail from home → current (clickable). */
  treeFocusTrail: (string | null)[]
  setTreeFocus: (personId: string | null, options?: { pushHistory?: boolean }) => void
  jumpTreeFocusTrail: (index: number) => void
  treeFocusBack: () => void
  treeFocusForward: () => void
  treeFocusHome: () => void
  canTreeFocusBack: boolean
  canTreeFocusForward: boolean
}

const AppNavigationContext = createContext<AppNavigationContextValue | null>(null)

function parseTreePersonFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const raw = window.location.hash.replace(/^#/, '')
  const query = raw.includes('?') ? raw.split('?')[1] : ''
  if (!query) return null
  return new URLSearchParams(query).get('person')
}

function treeHash(personId: string | null): string {
  const path = VIEW_PATHS.tree
  return personId ? `#${path}?person=${encodeURIComponent(personId)}` : `#${path}`
}

function initialView(): AppView {
  if (typeof window === 'undefined') return 'journey'
  return viewFromPath(window.location.hash.replace('#', '') || window.location.pathname)
}

export function AppNavigationProvider({ children }: { children: ReactNode }) {
  const { center, span, animateView, openPerson, closeDetail, peopleById } = useTimeline()
  const [activeView, setActiveView] = useState<AppView>(initialView)
  const [treeReturnViewport, setTreeReturnViewport] = useState<SavedViewport | null>(null)
  const [focusedTreePersonId, setFocusedTreePersonId] = useState<string | null>(() =>
    parseTreePersonFromHash(),
  )
  const [treeFocusTrail, setTreeFocusTrail] = useState<(string | null)[]>(() => {
    const fromHash = parseTreePersonFromHash()
    return fromHash ? [null, fromHash] : [null]
  })
  const [focusPast, setFocusPast] = useState<(string | null)[]>([])
  const [focusFuture, setFocusFuture] = useState<(string | null)[]>([])

  const savedViewportRef = useRef<SavedViewport | null>(null)
  const pendingViewportRef = useRef<SavedViewport | null>(null)
  const isRestoringRef = useRef(false)
  const enterTreeFromTimelineRef = useRef(false)
  const focusRef = useRef<string | null>(focusedTreePersonId)
  focusRef.current = focusedTreePersonId

  // Keep first paint on `#/` so the address bar matches the welcome fork.
  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState({ view: 'welcome' }, '', '#/')
    }
  }, [])

  const syncTreeHash = useCallback((personId: string | null, mode: 'push' | 'replace' = 'replace') => {
    if (activeView !== 'tree' && mode === 'replace') {
      // Still allow replace when entering tree via navigateToView.
    }
    const hash = treeHash(personId)
    if (window.location.hash === hash) return
    if (mode === 'push') window.history.pushState({ view: 'tree', personId }, '', hash)
    else window.history.replaceState({ view: 'tree', personId }, '', hash)
  }, [activeView])

  useEffect(() => {
    const onPopState = () => {
      const path = window.location.hash.replace('#', '') || '/journey'
      const view = viewFromPath(path)
      if (view === 'journey' && !pendingViewportRef.current) {
        isRestoringRef.current = true
      }
      setActiveView(view)
      if (view === 'tree') {
        const person = parseTreePersonFromHash()
        setFocusedTreePersonId(person)
        setTreeFocusTrail(person ? [null, person] : [null])
        setFocusPast([])
        setFocusFuture([])
      }
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

  const applyTrailForFocus = useCallback((resolved: string | null) => {
    setTreeFocusTrail((trail) => {
      if (resolved === null) return [null]
      const existing = trail.indexOf(resolved)
      if (existing >= 0) return trail.slice(0, existing + 1)
      return [...trail, resolved]
    })
  }, [])

  const setTreeFocus = useCallback(
    (personId: string | null, options?: { pushHistory?: boolean }) => {
      const resolved =
        personId === null ? null : peopleById[personId] ? personId : focusRef.current
      const pushHistory = options?.pushHistory !== false

      setFocusedTreePersonId((prev) => {
        if (prev === resolved) return prev
        if (pushHistory) {
          setFocusPast((stack) => [...stack, prev])
          setFocusFuture([])
        }
        return resolved
      })
      applyTrailForFocus(resolved)

      if (activeView === 'tree') {
        syncTreeHash(resolved, 'replace')
      }
    },
    [activeView, applyTrailForFocus, peopleById, syncTreeHash],
  )

  const jumpTreeFocusTrail = useCallback(
    (index: number) => {
      setTreeFocusTrail((trail) => {
        if (index < 0 || index >= trail.length) return trail
        const target = trail[index]
        const prev = focusRef.current
        if (prev !== target) {
          setFocusPast((stack) => [...stack, prev])
          setFocusFuture([])
          setFocusedTreePersonId(target)
          if (activeView === 'tree') syncTreeHash(target, 'replace')
        }
        return trail.slice(0, index + 1)
      })
    },
    [activeView, syncTreeHash],
  )

  const treeFocusBack = useCallback(() => {
    setFocusPast((past) => {
      if (!past.length) return past
      const prev = past[past.length - 1]
      setFocusFuture((future) => [focusRef.current, ...future])
      setFocusedTreePersonId(prev)
      applyTrailForFocus(prev)
      if (activeView === 'tree') syncTreeHash(prev, 'replace')
      return past.slice(0, -1)
    })
  }, [activeView, applyTrailForFocus, syncTreeHash])

  const treeFocusForward = useCallback(() => {
    setFocusFuture((future) => {
      if (!future.length) return future
      const next = future[0]
      setFocusPast((past) => [...past, focusRef.current])
      setFocusedTreePersonId(next)
      applyTrailForFocus(next)
      if (activeView === 'tree') syncTreeHash(next, 'replace')
      return future.slice(1)
    })
  }, [activeView, applyTrailForFocus, syncTreeHash])

  const treeFocusHome = useCallback(() => {
    setTreeFocus(null, { pushHistory: true })
    setTreeFocusTrail([null])
  }, [setTreeFocus])

  const navigateToView = useCallback(
    (view: AppView) => {
      if (view !== 'journey' && activeView === 'journey') {
        savedViewportRef.current = { center, span }
      }

      if (view === 'tree') {
        if (!enterTreeFromTimelineRef.current) {
          setTreeReturnViewport(null)
          const fromHash = parseTreePersonFromHash()
          // Fresh Tree entry from chrome: household focus, unless a person deep-link is present.
          if (activeView !== 'tree') {
            const nextFocus = fromHash && peopleById[fromHash] ? fromHash : null
            setFocusedTreePersonId(nextFocus)
            setTreeFocusTrail(nextFocus ? [null, nextFocus] : [null])
            setFocusPast([])
            setFocusFuture([])
            focusRef.current = nextFocus
          }
        }
        enterTreeFromTimelineRef.current = false
        const hash = treeHash(focusRef.current)
        if (window.location.hash !== hash) {
          window.history.pushState({ view: 'tree', personId: focusRef.current }, '', hash)
        }
        setActiveView(view)
        return
      }

      if (activeView === 'tree') {
        setTreeReturnViewport(null)
        setFocusedTreePersonId(null)
        setTreeFocusTrail([null])
        setFocusPast([])
        setFocusFuture([])
      }

      const path = VIEW_PATHS[view]
      const hash = `#${path}`
      if (window.location.hash !== hash) {
        window.history.pushState({ view }, '', hash)
      }
      setActiveView(view)
    },
    [activeView, center, peopleById, span],
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

  const viewOnTree = useCallback(
    (personId: string) => {
      closeDetail()
      if (activeView === 'journey') {
        setTreeReturnViewport({ center, span })
      }
      setFocusedTreePersonId(personId)
      setTreeFocusTrail([null, personId])
      setFocusPast([])
      setFocusFuture([])
      enterTreeFromTimelineRef.current = true
      focusRef.current = personId
      const hash = treeHash(personId)
      window.history.pushState({ view: 'tree', personId }, '', hash)
      setActiveView('tree')
    },
    [activeView, center, span, closeDetail],
  )

  const returnToTimeline = useCallback(() => {
    const saved = treeReturnViewport ?? savedViewportRef.current
    if (!saved) return
    pendingViewportRef.current = saved
    setTreeReturnViewport(null)
    setFocusedTreePersonId(null)
    setFocusPast([])
    setFocusFuture([])
    closeDetail()
    navigateToView('journey')
  }, [closeDetail, navigateToView, treeReturnViewport])

  const value: AppNavigationContextValue = {
    activeView,
    navigateToView,
    viewOnTimeline,
    viewOnTree,
    returnToTimeline,
    treeReturnViewport,
    focusedTreePersonId,
    treeFocusTrail,
    setTreeFocus,
    jumpTreeFocusTrail,
    treeFocusBack,
    treeFocusForward,
    treeFocusHome,
    canTreeFocusBack: focusPast.length > 0,
    canTreeFocusForward: focusFuture.length > 0,
  }

  return <AppNavigationContext.Provider value={value}>{children}</AppNavigationContext.Provider>
}

export function useAppNavigation() {
  const ctx = useContext(AppNavigationContext)
  if (!ctx) throw new Error('useAppNavigation must be used within AppNavigationProvider')
  return ctx
}
