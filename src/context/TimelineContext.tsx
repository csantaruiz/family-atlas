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
import type { AtlasThinking, DetailContent, FamilyEvent, HistoryEvent } from '../types'
import type { TimelineFilterKey, TimelineFilters } from '../types/timelineFilters'
import { DEFAULT_TIMELINE_FILTERS } from '../types/timelineFilters'
import { applyFamilyEventFilters, personPassesBranchFilter } from '../utils/timelineFilters'
import { buildLineagePalette } from '../utils/lineageColors'
import { assertNoDuplicateEvents, dedupeFamilyEvents } from '../utils/canonicalEvent'
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
  isDragging: boolean
  isZooming: boolean
  /** True while post-drag inertial coasting is animating the camera. */
  isInertialScrolling: boolean
  chapterScrollUnlocked: boolean
  detail: DetailContent
  highlightedStoryPersonId: string | null
  thinkingFocusRange: { start: number; end: number } | null
  mapHighlightYears: { start: number; end: number } | null
  peopleById: Record<string, (typeof familyDatabase.people)[number]>
  birthPeople: (typeof familyDatabase.people)[number][]
  filteredBirthPeople: (typeof familyDatabase.people)[number][]
  familyEvents: FamilyEvent[]
  filteredFamilyEvents: FamilyEvent[]
  timelineFilters: TimelineFilters
  generationCount: number
  setTimelineFilter: (key: TimelineFilterKey, enabled: boolean) => void
  setTimelineFilters: (patch: Partial<TimelineFilters>) => void
  setZoom: (value: number, anchorYear?: number) => void
  animateView: (targetCenter: number, targetSpan: number, duration?: number) => void
  panTimelineBy: (direction: -1 | 1) => void
  unlockChapterScroll: () => void
  returnToCraig: () => void
  openPerson: (id: string) => void
  openFamilyEvent: (event: FamilyEvent) => void
  openHistory: (event: HistoryEvent) => void
  openThinking: (thinking: AtlasThinking) => void
  setHighlightedStoryPersonId: (personId: string | null) => void
  setThinkingFocusRange: (range: { start: number; end: number } | null) => void
  setMapHighlightYears: (range: { start: number; end: number } | null) => void
  closeDetail: () => void
  handleWheel: (clientX: number, deltaY: number, stageWidth: number) => void
  handlePointerDown: (clientX: number, target: EventTarget | null) => boolean
  handlePointerMove: (clientX: number, stageWidth: number) => void
  handlePointerUp: () => void
}

const TimelineContext = createContext<TimelineContextValue | null>(null)

/** Exponential friction (higher = stops sooner). Tuned for iOS-like coasting. */
const INERTIA_FRICTION_PER_MS = 0.0036
/** Ignore tiny releases — only flick when the hand was still moving. */
const INERTIA_MIN_RELEASE_PX_PER_MS = 0.2
const INERTIA_MIN_VELOCITY_YEARS_PER_MS = 0.00035
const INERTIA_STOP_VELOCITY_YEARS_PER_MS = 0.00012
const INERTIA_MAX_VELOCITY_YEARS_PER_MS = 0.55
const INERTIA_SAMPLE_WINDOW_MS = 100

export function TimelineProvider({ children }: { children: ReactNode }) {
  const presentYear = new Date().getFullYear()
  const birthPeople = useMemo(
    () =>
      familyDatabase.people
        .filter((p) => p.birthYear)
        .sort((a, b) => (a.birthYear ?? 0) - (b.birthYear ?? 0)),
    [],
  )
  const lineagePalette = useMemo(
    () => buildLineagePalette(familyDatabase.people, familyDatabase.root),
    [],
  )
  const peopleIdMap = useMemo(
    () => new Map(familyDatabase.people.map((person) => [person.id, person])),
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
  const familyEvents = useMemo(() => {
    const events = dedupeFamilyEvents(buildFamilyEvents(familyDatabase.people))
    assertNoDuplicateEvents(events, 'familyEvents')
    return events
  }, [])

  const [timelineFilters, setTimelineFiltersState] = useState<TimelineFilters>(DEFAULT_TIMELINE_FILTERS)

  const filteredFamilyEvents = useMemo(
    () => applyFamilyEventFilters(familyEvents, timelineFilters, lineagePalette, peopleIdMap),
    [familyEvents, timelineFilters, lineagePalette, peopleIdMap],
  )
  const filteredBirthPeople = useMemo(
    () =>
      birthPeople.filter((person) =>
        personPassesBranchFilter(person.id, timelineFilters, lineagePalette, peopleIdMap),
      ),
    [birthPeople, timelineFilters, lineagePalette, peopleIdMap],
  )

  const setTimelineFilter = useCallback((key: TimelineFilterKey, enabled: boolean) => {
    setTimelineFiltersState((prev) => ({ ...prev, [key]: enabled }))
  }, [])

  const setTimelineFilters = useCallback((patch: Partial<TimelineFilters>) => {
    setTimelineFiltersState((prev) => ({ ...prev, ...patch }))
  }, [])
  const generationCount = useMemo(
    () =>
      Math.max(
        0,
        ...familyDatabase.people.map((p) => (p.generation != null ? Math.abs(p.generation) : 0)),
      ) + 1,
    [],
  )

  const [center, setCenter] = useState((minYear + maxYear) / 2)
  const [span, setSpan] = useState(fullSpan)
  const [zoomValue, setZoomValue] = useState(() => zoomValueFromSpan(fullSpan, fullSpan))
  const [detail, setDetail] = useState<DetailContent>(null)
  const [highlightedStoryPersonId, setHighlightedStoryPersonId] = useState<string | null>(null)
  const [thinkingFocusRange, setThinkingFocusRange] = useState<{ start: number; end: number } | null>(null)
  const [mapHighlightYears, setMapHighlightYears] = useState<{ start: number; end: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isZooming, setIsZooming] = useState(false)
  const [isInertialScrolling, setIsInertialScrolling] = useState(false)
  const [chapterScrollUnlocked, setChapterScrollUnlocked] = useState(false)

  const dragXRef = useRef<number | null>(null)
  const dragStartXRef = useRef<number | null>(null)
  const dragStageWidthRef = useRef(1200)
  const centerRef = useRef(center)
  const spanRef = useRef(span)
  const dragSamplesRef = useRef<{ t: number; x: number }[]>([])
  const zoomAnimationRef = useRef<number | null>(null)
  const panAnimationRef = useRef<number | null>(null)
  const inertiaAnimationRef = useRef<number | null>(null)

  const applyView = useCallback(
    (nextCenter: number, nextSpan: number) => {
      const clamped = clampView(nextCenter, nextSpan, minYear, maxYear, fullSpan)
      centerRef.current = clamped.center
      spanRef.current = clamped.span
      setCenter(clamped.center)
      setSpan(clamped.span)
      setZoomValue(zoomValueFromSpan(clamped.span, fullSpan))
    },
    [minYear, maxYear, fullSpan],
  )

  const cancelInertia = useCallback(() => {
    if (inertiaAnimationRef.current) {
      cancelAnimationFrame(inertiaAnimationRef.current)
      inertiaAnimationRef.current = null
    }
    setIsInertialScrolling(false)
  }, [])

  const cancelViewAnimation = useCallback(() => {
    if (zoomAnimationRef.current) {
      cancelAnimationFrame(zoomAnimationRef.current)
      zoomAnimationRef.current = null
    }
    if (panAnimationRef.current) {
      cancelAnimationFrame(panAnimationRef.current)
      panAnimationRef.current = null
    }
    cancelInertia()
    setIsZooming(false)
  }, [cancelInertia])

  const unlockChapterScroll = useCallback(() => {
    setChapterScrollUnlocked(true)
  }, [])

  const startInertia = useCallback(
    (velocityYearsPerMs: number) => {
      cancelInertia()
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (prefersReducedMotion) return

      let velocity = Math.max(
        -INERTIA_MAX_VELOCITY_YEARS_PER_MS,
        Math.min(INERTIA_MAX_VELOCITY_YEARS_PER_MS, velocityYearsPerMs),
      )
      if (Math.abs(velocity) < INERTIA_MIN_VELOCITY_YEARS_PER_MS) return

      setIsInertialScrolling(true)
      let lastTime = performance.now()
      const frame = (now: number) => {
        const dt = Math.min(48, Math.max(0, now - lastTime))
        lastTime = now
        if (dt <= 0) {
          inertiaAnimationRef.current = requestAnimationFrame(frame)
          return
        }

        const currentSpan = spanRef.current
        const nextCenter = centerRef.current + velocity * dt
        applyView(nextCenter, currentSpan)

        // Exponential decay — fast flicks coast farther than slow releases.
        velocity *= Math.exp(-INERTIA_FRICTION_PER_MS * dt)

        const half = currentSpan / 2
        const atEdge =
          centerRef.current <= minYear + half + 0.05 ||
          centerRef.current >= maxYear - half - 0.05
        if (atEdge) velocity *= 0.55

        if (Math.abs(velocity) < INERTIA_STOP_VELOCITY_YEARS_PER_MS) {
          inertiaAnimationRef.current = null
          setIsInertialScrolling(false)
          return
        }
        inertiaAnimationRef.current = requestAnimationFrame(frame)
      }
      inertiaAnimationRef.current = requestAnimationFrame(frame)
    },
    [applyView, cancelInertia, minYear, maxYear],
  )

  const animateView = useCallback(
    (targetCenter: number, targetSpan: number, duration = 680) => {
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

  const panTimelineBy = useCallback(
    (direction: -1 | 1) => {
      cancelViewAnimation()
      const fromCenter = center
      const currentSpan = span
      const half = currentSpan / 2
      const panYears = currentSpan * 0.36
      const targetC = Math.max(
        minYear + half,
        Math.min(maxYear - half, fromCenter + direction * panYears),
      )
      if (Math.abs(targetC - fromCenter) < 0.5) return

      const duration = 520
      const startTime = performance.now()

      const frame = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration)
        const eased = easeInOutCubic(t)
        applyView(fromCenter + (targetC - fromCenter) * eased, currentSpan)
        if (t < 1) {
          panAnimationRef.current = requestAnimationFrame(frame)
        } else {
          panAnimationRef.current = null
          applyView(targetC, currentSpan)
        }
      }
      panAnimationRef.current = requestAnimationFrame(frame)
    },
    [cancelViewAnimation, center, span, minYear, maxYear, applyView],
  )

  const setZoom = useCallback(
    (value: number, anchorYear = center) => {
      if (value > 0) unlockChapterScroll()
      animateView(anchorYear, spanFromZoomValue(value, fullSpan), 480)
    },
    [animateView, center, fullSpan, unlockChapterScroll],
  )

  const returnToCraig = useCallback(() => {
    const root = peopleById[familyDatabase.root]
    animateView(root?.birthYear ?? 1975, 54, 900)
  }, [animateView, peopleById])

  const openPerson = useCallback((id: string) => {
    setDetail({ type: 'person', personId: id })
  }, [])

  const openFamilyEvent = useCallback((event: FamilyEvent) => {
    setDetail({ type: 'familyEvent', event })
    if (event.kind === 'move') {
      const pad = 12
      setMapHighlightYears({ start: event.year - pad, end: event.year + pad })
    }
  }, [])

  const openHistory = useCallback((event: HistoryEvent) => {
    setDetail({ type: 'history', event })
  }, [])

  const openThinking = useCallback((thinking: AtlasThinking) => {
    setDetail({ type: 'thinking', thinking })
  }, [])

  const closeDetail = useCallback(() => {
    setDetail(null)
    setMapHighlightYears(null)
  }, [])

  const handleWheel = useCallback(
    (clientX: number, deltaY: number, stageWidth: number) => {
      cancelViewAnimation()
      const { start } = viewport(center, span)
      const frac = clientX / stageWidth
      const anchor = start + frac * span
      // Touch pinch sends small |deltaY| steps; amplify those so pinch feels responsive.
      // Mouse/trackpad wheel deltas are usually larger and keep the existing step size.
      const abs = Math.abs(deltaY)
      const step = abs > 0 && abs < 40 ? 12 : 7
      const nextValue = Math.max(0, Math.min(100, zoomValue + (deltaY > 0 ? -step : step)))
      if (nextValue > zoomValue) unlockChapterScroll()
      const targetSpan = spanFromZoomValue(nextValue, fullSpan)
      const targetCenter = anchor + (0.5 - frac) * targetSpan
      animateView(targetCenter, targetSpan, 560)
    },
    [cancelViewAnimation, center, span, zoomValue, fullSpan, animateView, unlockChapterScroll],
  )

  const handlePointerDown = useCallback((clientX: number, target: EventTarget | null) => {
    if (target instanceof Element) {
      if (target.closest('button, input, select, textarea, label')) return false
      if (target.closest('.chapter-callout-frame, .chapter-callout-presence-stack')) return false
    }
    cancelViewAnimation()
    dragXRef.current = clientX
    dragStartXRef.current = clientX
    dragSamplesRef.current = [{ t: performance.now(), x: clientX }]
    setIsDragging(true)
    return true
  }, [cancelViewAnimation])

  const handlePointerMove = useCallback(
    (clientX: number, stageWidth: number) => {
      if (dragXRef.current == null) return
      dragStageWidthRef.current = stageWidth
      const dx = clientX - dragXRef.current
      const nextCenter = centerRef.current - (dx / stageWidth) * spanRef.current
      applyView(nextCenter, spanRef.current)
      dragXRef.current = clientX

      const now = performance.now()
      const samples = dragSamplesRef.current
      samples.push({ t: now, x: clientX })
      while (samples.length > 1 && now - samples[0].t > INERTIA_SAMPLE_WINDOW_MS) {
        samples.shift()
      }
    },
    [applyView],
  )

  const handlePointerUp = useCallback(() => {
    const samples = dragSamplesRef.current
    const stageWidth = Math.max(1, dragStageWidthRef.current)
    const currentSpan = spanRef.current

    dragXRef.current = null
    dragStartXRef.current = null
    setIsDragging(false)

    if (samples.length >= 2) {
      const newest = samples[samples.length - 1]
      let oldest = samples[0]
      for (let i = samples.length - 2; i >= 0; i--) {
        if (newest.t - samples[i].t >= 32) {
          oldest = samples[i]
          break
        }
        oldest = samples[i]
      }
      const dt = newest.t - oldest.t
      if (dt > 0) {
        const velocityPxPerMs = (newest.x - oldest.x) / dt
        if (Math.abs(velocityPxPerMs) >= INERTIA_MIN_RELEASE_PX_PER_MS) {
          // Dragging right reveals earlier years (center decreases).
          const velocityYearsPerMs = -(velocityPxPerMs / stageWidth) * currentSpan
          startInertia(velocityYearsPerMs)
        }
      }
    }

    dragSamplesRef.current = []
  }, [startInertia])

  const value: TimelineContextValue = {
    minYear,
    maxYear,
    presentYear,
    fullSpan,
    center,
    span,
    zoomValue,
    isDragging,
    isZooming,
    isInertialScrolling,
    chapterScrollUnlocked,
    detail,
    highlightedStoryPersonId,
    thinkingFocusRange,
    mapHighlightYears,
    peopleById,
    birthPeople,
    filteredBirthPeople,
    familyEvents,
    filteredFamilyEvents,
    timelineFilters,
    generationCount,
    setTimelineFilter,
    setTimelineFilters,
    setZoom,
    animateView,
    panTimelineBy,
    unlockChapterScroll,
    returnToCraig,
    openPerson,
    openFamilyEvent,
    openHistory,
    openThinking,
    setHighlightedStoryPersonId,
    setThinkingFocusRange,
    setMapHighlightYears,
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
