import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { buildFamilyEvents } from '../data/buildFamilyEvents'
import { familyDatabase } from '../data/familyDatabase'
import type { DetailContent, FamilyEvent, HistoryEvent } from '../types'
import {
  clampView,
  easeInOutCubic,
  spanFromZoomValue,
  viewport,
  zoomValueFromSpan,
} from '../utils/timelineMath'

type TimelineContextValue = {
  minYear: number
  maxYear: number
  presentYear: number
  fullSpan: number
  center: number
  span: number
  zoomValue: number
  historyEnabled: boolean
  isDragging: boolean
  isZooming: boolean
  detail: DetailContent
  peopleById: Record<string, (typeof familyDatabase.people)[number]>
  birthPeople: (typeof familyDatabase.people)[number][]
  familyEvents: FamilyEvent[]
  generationCount: number
  setHistoryEnabled: (enabled: boolean) => void
  setZoom: (value: number, anchorYear?: number) => void
  animateView: (targetCenter: number, targetSpan: number, duration?: number) => void
  returnToCraig: () => void
  openPerson: (id: string) => void
  openFamilyEvent: (event: FamilyEvent) => void
  openHistory: (event: HistoryEvent) => void
  closeDetail: () => void
  handleWheel: (clientX: number, deltaY: number, stageWidth: number) => void
  handlePointerDown: (clientX: number, target: EventTarget | null) => boolean
  handlePointerMove: (clientX: number, stageWidth: number) => void
  handlePointerUp: () => void
}

const TimelineContext = createContext<TimelineContextValue | null>(null)

export function TimelineProvider({ children }: { children: ReactNode }) {
  const presentYear = new Date().getFullYear()
  const birthPeople = useMemo(
    () =>
      familyDatabase.people
        .filter((p) => p.birthYear)
        .sort((a, b) => (a.birthYear ?? 0) - (b.birthYear ?? 0)),
    [],
  )
  const minYear = useMemo(
    () => Math.min(...birthPeople.map((p) => p.birthYear ?? presentYear)),
    [birthPeople, presentYear],
  )
  const maxYear = presentYear
  const fullSpan = maxYear - minYear
  const peopleById = useMemo(
    () => Object.fromEntries(familyDatabase.people.map((p) => [p.id, p])),
    [],
  )
  const familyEvents = useMemo(() => buildFamilyEvents(familyDatabase.people), [])
  const generationCount = useMemo(
    () => Math.max(...familyDatabase.people.map((p) => p.generation ?? 0)) + 1,
    [],
  )

  const [center, setCenter] = useState((minYear + maxYear) / 2)
  const [span, setSpan] = useState(fullSpan)
  const [zoomValue, setZoomValue] = useState(() => zoomValueFromSpan(fullSpan, fullSpan))
  const [historyEnabled, setHistoryEnabled] = useState(true)
  const [detail, setDetail] = useState<DetailContent>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isZooming, setIsZooming] = useState(false)

  const dragXRef = useRef<number | null>(null)
  const dragStartXRef = useRef<number | null>(null)
  const zoomAnimationRef = useRef<number | null>(null)

  const applyView = useCallback(
    (nextCenter: number, nextSpan: number) => {
      const clamped = clampView(nextCenter, nextSpan, minYear, maxYear, fullSpan)
      setCenter(clamped.center)
      setSpan(clamped.span)
      setZoomValue(zoomValueFromSpan(clamped.span, fullSpan))
    },
    [minYear, maxYear, fullSpan],
  )

  const cancelViewAnimation = useCallback(() => {
    if (zoomAnimationRef.current) {
      cancelAnimationFrame(zoomAnimationRef.current)
      zoomAnimationRef.current = null
    }
    setIsZooming(false)
  }, [])

  const animateView = useCallback(
    (targetCenter: number, targetSpan: number, duration = 420) => {
      cancelViewAnimation()
      const fromCenter = center
      const fromSpan = span
      const start = performance.now()
      let targetS = Math.max(6, Math.min(fullSpan, targetSpan))
      const half = targetS / 2
      let targetC = Math.max(minYear + half, Math.min(maxYear - half, targetCenter))
      setIsZooming(true)

      const frame = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const e = easeInOutCubic(t)
        const c = fromCenter + (targetC - fromCenter) * e
        const s = fromSpan + (targetS - fromSpan) * e
        applyView(c, s)
        if (t < 1) {
          zoomAnimationRef.current = requestAnimationFrame(frame)
        } else {
          zoomAnimationRef.current = null
          setIsZooming(false)
          applyView(targetC, targetS)
        }
      }
      zoomAnimationRef.current = requestAnimationFrame(frame)
    },
    [cancelViewAnimation, center, span, fullSpan, minYear, maxYear, applyView],
  )

  const setZoom = useCallback(
    (value: number, anchorYear = center) => {
      animateView(anchorYear, spanFromZoomValue(value, fullSpan), 260)
    },
    [animateView, center, fullSpan],
  )

  const returnToCraig = useCallback(() => {
    const root = peopleById[familyDatabase.root]
    animateView(root?.birthYear ?? 1975, 54, 650)
  }, [animateView, peopleById])

  const openPerson = useCallback((id: string) => {
    setDetail({ type: 'person', personId: id })
  }, [])

  const openFamilyEvent = useCallback((event: FamilyEvent) => {
    setDetail({ type: 'familyEvent', event })
  }, [])

  const openHistory = useCallback((event: HistoryEvent) => {
    setDetail({ type: 'history', event })
  }, [])

  const closeDetail = useCallback(() => setDetail(null), [])

  const handleWheel = useCallback(
    (clientX: number, deltaY: number, stageWidth: number) => {
      cancelViewAnimation()
      const { start } = viewport(center, span)
      const frac = clientX / stageWidth
      const anchor = start + frac * span
      const nextValue = Math.max(0, Math.min(100, zoomValue + (deltaY > 0 ? -7 : 7)))
      const targetSpan = spanFromZoomValue(nextValue, fullSpan)
      const targetCenter = anchor + (0.5 - frac) * targetSpan
      animateView(targetCenter, targetSpan, 360)
    },
    [cancelViewAnimation, center, span, zoomValue, fullSpan, animateView],
  )

  const handlePointerDown = useCallback((clientX: number, target: EventTarget | null) => {
    if (target instanceof Element && target.closest('button')) return false
    cancelViewAnimation()
    dragXRef.current = clientX
    dragStartXRef.current = clientX
    setIsDragging(true)
    return true
  }, [cancelViewAnimation])

  const handlePointerMove = useCallback(
    (clientX: number, stageWidth: number) => {
      if (dragXRef.current == null) return
      const dx = clientX - dragXRef.current
      const nextCenter = center - (dx / stageWidth) * span
      applyView(nextCenter, span)
      dragXRef.current = clientX
    },
    [center, span, applyView],
  )

  const handlePointerUp = useCallback(() => {
    dragXRef.current = null
    dragStartXRef.current = null
    setIsDragging(false)
  }, [])

  const value: TimelineContextValue = {
    minYear,
    maxYear,
    presentYear,
    fullSpan,
    center,
    span,
    zoomValue,
    historyEnabled,
    isDragging,
    isZooming,
    detail,
    peopleById,
    birthPeople,
    familyEvents,
    generationCount,
    setHistoryEnabled,
    setZoom,
    animateView,
    returnToCraig,
    openPerson,
    openFamilyEvent,
    openHistory,
    closeDetail,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  }

  return <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>
}

export function useTimeline() {
  const ctx = useContext(TimelineContext)
  if (!ctx) throw new Error('useTimeline must be used within TimelineProvider')
  return ctx
}
