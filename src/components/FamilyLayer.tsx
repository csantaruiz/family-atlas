import { useLayoutEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ChapterCalloutPresence,
  ChapterConnectorLayer,
  pickPrimaryCluster,
  type CalloutLayoutAnchor,
} from './ChapterViewportCallout'
import { getCalloutLayoutProfile } from '../utils/chapterPresentation'
import { estimateCardFrameHeight, resolveChapterVerticalLayout, timelineAxisY } from '../utils/chapterCalloutLayout'
import { familyDatabase } from '../data/familyDatabase'
import { assignEventsToChapters, buildStoryChaptersForViewport } from '../data/buildStoryChapters'
import { useTimeline } from '../context/TimelineContext'
import { useTimelinePulse } from '../context/TimelinePulseContext'
import { useJourneyIntro } from '../context/JourneyIntroContext'
import { useAppNavigation } from '../context/AppNavigationContext'
import { FamilyMemberActionTip } from './FamilyMemberActionTip'
import {
  buildBirthClusters,
  chooseFocus,
  conflictClusterZoomSpan,
  estimatedLabelHalfWidth,
  foldSpatiallyConflictingEvents,
  layoutBirthClustersProgressive,
  layoutFamilyEventsProgressive,
  peopleBudgetForMode,
  placeLabels,
  semanticZoomMode,
  showBirthPeriodClusters,
  type PlacedEventConflictCluster,
} from '../utils/clustering'
import { movementSummary } from '../utils/placeUtils'
import { eventAccessibleTitle } from '../utils/detailPlacement'
import { categoryTypeLabel, clampAnchorBelowEditorialPanels, clampAnchorBelowPlaque, deconflictFamilyAnchorYs, displayName, measureDetailedFootprint, type LabelAlignment } from '../utils/labelMeasure'
import { canonicalEventId, assertNoDuplicateEvents } from '../utils/canonicalEvent'
import { freezeLandmarkStability, unfreezeLandmarkStability } from '../utils/landmarkSelectionStability'
import { admitPersistentMarkers, maxFamilyEventsForSpan, staggerFamilyEventLanes } from '../utils/landmarkSelection'
import { connectorStemColor, familyEventStemLength, familyLabelCeilingY } from '../utils/eventConnector'
import { spanFromZoomValue, yearX, zoomMode } from '../utils/timelineMath'
import type { FamilyEvent } from '../types'

type FamilyLayerProps = {
  start: number
  end: number
  width: number
  height: number
}

const motionEase = [0.22, 0.8, 0.2, 1] as const
const detailMotionEase = [0.22, 0.8, 0.2, 1] as const

const SunriseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 18h16" />
    <path d="M6.5 18a5.5 5.5 0 0 1 11 0" />
    <path d="M12 3v4" />
    <path d="m4.2 8.2 2.8 2" />
    <path d="m19.8 8.2-2.8 2" />
  </svg>
)

const CrossIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    <path d="M12 3v18" />
    <path d="M7.5 8h9" />
  </svg>
)

function eventIntroOpacity(eventsProgress: number, staggerDelayMs: number): number {
  const threshold = staggerDelayMs / 420
  if (eventsProgress <= threshold) return 0
  return Math.min(1, (eventsProgress - threshold) / 0.32)
}

function EventStem({ stemLength, kind }: { stemLength: number; kind: FamilyEvent['kind'] }) {
  return (
    <span
      className="event-stem"
      aria-hidden="true"
      style={{
        height: stemLength,
        ['--stem-color' as string]: connectorStemColor(kind),
      }}
    />
  )
}

function EventCategoryLabel({ event }: { event: FamilyEvent }) {
  return (
    <>
      {event.kind === 'birth' ? <SunriseIcon /> : null}
      {event.kind === 'death' ? <CrossIcon /> : null}
      <span className="event-copy-type">{categoryTypeLabel(event)}</span>
      <span className="event-copy-year">({event.year})</span>
    </>
  )
}

function FamilyEventButton({
  event,
  x,
  y,
  viewportWidth,
  onOpen,
  onExplore,
  onViewTree,
  alignment = 'center',
  nudge = 0,
  compact = false,
  stemLength,
  motionEnabled = false,
}: {
  event: FamilyEvent
  x: number
  y: number
  viewportWidth: number
  onOpen: (event: FamilyEvent) => void
  onExplore?: (personId: string) => void
  onViewTree?: (personId: string) => void
  alignment?: LabelAlignment
  nudge?: number
  compact?: boolean
  stemLength: number
  motionEnabled?: boolean
}) {
  let label: React.ReactNode
  let title: string
  let sub = ''
  const accessibleTitle = eventAccessibleTitle(event)

  if (event.kind === 'birth') {
    label = <EventCategoryLabel event={event} />
    title = displayName(event, compact)
  } else if (event.kind === 'death') {
    label = <EventCategoryLabel event={event} />
    title = displayName(event, compact)
  } else if (event.kind === 'move') {
    label = <EventCategoryLabel event={event} />
    title = displayName(event, compact)
    sub = compact ? '' : movementSummary(event)
  } else {
    label = <EventCategoryLabel event={event} />
    title = compact ? displayName(event, true) : event.title
    sub = compact ? '' : event.detail || event.person.name
  }

  const labelWidth = measureDetailedFootprint(event, viewportWidth, compact).width

  const style = {
    left: Math.round(x),
    top: Math.round(y),
    '--label-nudge': `${nudge}px`,
    '--label-width': `${labelWidth}px`,
  } as React.CSSProperties

  const className = [
    'family-event',
    event.kind,
    `align-${alignment}`,
    compact ? 'compact' : '',
    motionEnabled ? 'placement-animated' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const { pulse } = useTimelinePulse()
  const eventKey = canonicalEventId(event)
  const isAmbientResponse = pulse.familyEventIds.includes(eventKey)
  const ambientResponseDelay = pulse.familyDelays[eventKey] ?? 0

  const pulseClassName = isAmbientResponse ? ' is-ambient-response' : ''
  const pulseStyle = isAmbientResponse
    ? ({
        ...style,
        ['--ambient-response-delay' as string]: `${ambientResponseDelay}ms`,
      } as React.CSSProperties)
    : style

  return (
    <button
      type="button"
      className={className + pulseClassName}
      style={pulseStyle}
      title={accessibleTitle}
      aria-label={accessibleTitle}
      onPointerDown={(ev) => ev.stopPropagation()}
      onClick={(ev) => {
        ev.stopPropagation()
        onOpen(event)
      }}
    >
      {onViewTree && onExplore ? (
        <FamilyMemberActionTip
          personId={event.person.id}
          onExplore={onExplore}
          onViewTree={onViewTree}
        />
      ) : null}
      <span className="event-copy">
        <em>{label}</em>
        <b>{title}</b>
        {sub ? <small>{sub}</small> : null}
      </span>
      <span className="event-anchor" />
      <EventStem stemLength={stemLength} kind={event.kind} />
    </button>
  )
}

export function FamilyLayer({ start, end, width, height }: FamilyLayerProps) {
  const {
    span,
    minYear,
    maxYear,
    presentYear,
    fullSpan,
    filteredBirthPeople,
    filteredFamilyEvents,
    timelineFilters,
    animateView,
    panTimelineBy,
    unlockChapterScroll,
    chapterScrollUnlocked,
    zoomValue,
    openPerson,
    openFamilyEvent,
    setThinkingFocusRange,
    isZooming,
  } = useTimeline()
  const { viewOnTree } = useAppNavigation()

  const modeLive = zoomMode(span)
  const earliestYear = familyDatabase.stats.earliestYear
  const totalTimelineEnd = presentYear
  const interactionLocked = isZooming
  const zoomSemanticRef = useRef(semanticZoomMode(span, fullSpan))
  const useBirthClustersRef = useRef(showBirthPeriodClusters(span) && timelineFilters.births)
  const modeRef = useRef(modeLive)
  const frozenFamilyLayoutRef = useRef<ReturnType<typeof layoutFamilyEventsProgressive> | null>(null)
  const frozenBirthLayoutRef = useRef<ReturnType<typeof layoutBirthClustersProgressive> | null>(null)
  const frozenBirthClustersRef = useRef<ReturnType<typeof buildBirthClusters> | null>(null)

  const zoomSemanticLive = useMemo(() => {
    if (interactionLocked) return zoomSemanticRef.current
    const visible = filteredFamilyEvents.filter((e) => e.year >= start && e.year <= end)
    const chapters = buildStoryChaptersForViewport(
      visible,
      start,
      end,
      span,
      earliestYear,
      presentYear,
      12,
      fullSpan,
    )
    const chapterMap = assignEventsToChapters(visible, chapters)
    return semanticZoomMode(span, fullSpan, {
      visible,
      start,
      span,
      width,
      chapters,
      chapterMap,
    })
  }, [filteredFamilyEvents, start, end, span, fullSpan, width, earliestYear, presentYear, interactionLocked])

  const useBirthClustersLive = showBirthPeriodClusters(span) && timelineFilters.births

  if (!interactionLocked) {
    zoomSemanticRef.current = zoomSemanticLive
    useBirthClustersRef.current = useBirthClustersLive
    modeRef.current = modeLive
    frozenFamilyLayoutRef.current = null
    frozenBirthLayoutRef.current = null
    frozenBirthClustersRef.current = null
  }

  const zoomSemantic = interactionLocked ? zoomSemanticRef.current : zoomSemanticLive
  const useBirthClusters = interactionLocked ? useBirthClustersRef.current : useBirthClustersLive
  const mode = interactionLocked ? modeRef.current : modeLive
  const prefersReducedMotion = useReducedMotion()
  const motionEnabled = !prefersReducedMotion
  // Freeze marker selection/layout during drag+zoom; only X is recomputed from yearX.
  const persistEventMarkers = interactionLocked
  const eventFadeEnabled = motionEnabled && !persistEventMarkers
  const frozenEventsRef = useRef<
    Array<{
      event: FamilyEvent
      x: number
      y: number
      alignment?: LabelAlignment
      nudge?: number
      compact?: boolean
      lane?: number
    }> | null
  >(null)
  const persistSnapshotRef = useRef(false)
  const frozenEventYRef = useRef<Map<string, number>>(new Map())
  // Span-stable pins: once shown at a zoom level, prefer keeping them while still in view.
  const pinnedSpanBucketRef = useRef<number | null>(null)
  const previousRenderedIdsRef = useRef<string[]>([])
  const pinnedEventsRef = useRef<
    Array<{
      event: FamilyEvent
      x: number
      y: number
      alignment?: LabelAlignment
      nudge?: number
      compact?: boolean
      lane?: number
    }>
  >([])
  const {
    isIntroActive,
    introProgress,
    eventIntroDelayMs,
    completeIntro,
  } = useJourneyIntro()

  useLayoutEffect(() => {
    if (interactionLocked) {
      freezeLandmarkStability(useBirthClusters ? 'far' : zoomSemantic, span)
      return
    }
    frozenEventsRef.current = null
    persistSnapshotRef.current = false
    unfreezeLandmarkStability()
  }, [interactionLocked, span, useBirthClusters, zoomSemantic])

  useLayoutEffect(() => {
    if (!isZooming) {
      frozenEventYRef.current.clear()
    }
  }, [isZooming])

  const densityBars = useMemo(() => {
    if (interactionLocked || !timelineFilters.births || span < 120) return []
    const bin = span > 350 ? 50 : 25
    const bars: { x: number; width: number; opacity: number; height: number }[] = []
    for (let y = Math.floor(start / bin) * bin; y <= end; y += bin) {
      const count = filteredBirthPeople.filter((p) => p.birthYear && p.birthYear >= y && p.birthYear < y + bin).length
      if (!count) continue
      const x = yearX(y + bin / 2, start, span, width)
      bars.push({
        x,
        width: Math.max(6, (bin / span) * width * 0.78),
        opacity: Math.min(0.92, 0.15 + count / 16),
        height: 22 + Math.min(52, count * 2.5),
      })
    }
    return bars
  }, [span, start, end, filteredBirthPeople, width, timelineFilters.births, interactionLocked])

  const birthClusters = useMemo(() => {
    if (!useBirthClusters) return []
    if (interactionLocked && frozenBirthClustersRef.current) {
      return frozenBirthClustersRef.current
    }
    const clusters = buildBirthClusters(filteredBirthPeople, start, end, span, width, height, presentYear)
    if (interactionLocked) frozenBirthClustersRef.current = clusters
    return clusters
  }, [useBirthClusters, filteredBirthPeople, start, end, span, width, height, presentYear, interactionLocked])

  const rootPersonId = familyDatabase.root

  const [plaqueAnchor, setPlaqueAnchor] = useState<CalloutLayoutAnchor | null>(null)
  const handlePlaqueAnchorChange = useCallback((anchor: CalloutLayoutAnchor | null) => {
    setPlaqueAnchor(anchor)
  }, [])

  const visibleInViewport = useMemo(
    () => filteredFamilyEvents.filter((e) => e.year >= start && e.year <= end),
    [filteredFamilyEvents, start, end],
  )

  const placementCalloutLayout = useMemo(
    () =>
      getCalloutLayoutProfile({
        zoomMode: 'far',
        totalVisibleEvents: visibleInViewport.length,
        placedEventCount: visibleInViewport.length,
        viewportWidth: width,
      }),
    [visibleInViewport.length, width],
  )

  const placementVerticalLayout = useMemo(
    () => resolveChapterVerticalLayout('far', width, height, placementCalloutLayout),
    [width, height, placementCalloutLayout],
  )

  const estimatedPlaqueAnchor = useMemo((): CalloutLayoutAnchor | null => {
    if (useBirthClusters) return null
    return {
      centerX: placementVerticalLayout.chapterCenterX,
      bottomY:
        placementVerticalLayout.cardTop + estimateCardFrameHeight(placementCalloutLayout) + 16,
      width: placementCalloutLayout.maxWidthPx,
    }
  }, [useBirthClusters, placementVerticalLayout, placementCalloutLayout])

  const effectivePlaqueAnchor = plaqueAnchor ?? estimatedPlaqueAnchor

  const birthLayout = useMemo(() => {
    if (!useBirthClusters) return null
    if (interactionLocked && frozenBirthLayoutRef.current) {
      return frozenBirthLayoutRef.current
    }
    const eventsInView = filteredFamilyEvents.filter((e) => e.year >= start && e.year <= end)
    const layout = layoutBirthClustersProgressive(
      birthClusters,
      eventsInView,
      start,
      end,
      span,
      width,
      height,
      fullSpan,
      earliestYear,
      rootPersonId,
      presentYear,
      effectivePlaqueAnchor,
    )
    if (interactionLocked) frozenBirthLayoutRef.current = layout
    return layout
  }, [useBirthClusters, birthClusters, filteredFamilyEvents, start, end, span, width, height, fullSpan, earliestYear, rootPersonId, presentYear, effectivePlaqueAnchor, interactionLocked])

  const familyLayout = useMemo(() => {
    if (useBirthClusters) return null
    if (interactionLocked && frozenFamilyLayoutRef.current) {
      return frozenFamilyLayoutRef.current
    }
    const events = filteredFamilyEvents.filter((e) => e.year >= start && e.year <= end)
    const layout = layoutFamilyEventsProgressive(
      events,
      start,
      end,
      span,
      width,
      height,
      mode,
      fullSpan,
      earliestYear,
      rootPersonId,
      presentYear,
      effectivePlaqueAnchor,
    )
    if (interactionLocked) frozenFamilyLayoutRef.current = layout
    return layout
  }, [useBirthClusters, filteredFamilyEvents, start, end, span, width, height, mode, fullSpan, earliestYear, rootPersonId, presentYear, effectivePlaqueAnchor, interactionLocked])

  const activeLayout = useBirthClusters ? birthLayout : familyLayout

  const activeClusters = activeLayout?.clusters ?? []
  const primaryCluster = useMemo(
    () => pickPrimaryCluster(activeClusters, start, span),
    [activeClusters, start, span],
  )

  const canScrollTimelinePrev = start > minYear + 1
  const canScrollTimelineNext = end < maxYear - 1
  const isWideTimelineView = span >= fullSpan * 0.992 || zoomValue <= 0
  const showChapterScrollChevrons =
    chapterScrollUnlocked &&
    !isWideTimelineView &&
    (canScrollTimelinePrev || canScrollTimelineNext)

  const calloutLayout = useMemo(() => {
    return getCalloutLayoutProfile({
      zoomMode: 'far',
      totalVisibleEvents: visibleInViewport.length,
      placedEventCount: activeLayout?.events.length ?? 0,
      viewportWidth: width,
    })
  }, [visibleInViewport.length, activeLayout?.events.length, width])

  const chapterVerticalLayout = useMemo(() => {
    return resolveChapterVerticalLayout('far', width, height, calloutLayout)
  }, [width, height, calloutLayout])

  const calloutCenterX = chapterVerticalLayout.chapterCenterX

  const introEventOrder = useMemo(() => {
    const list = activeLayout?.events ?? []
    const sorted = [...list].sort(
      (a, b) => Math.abs(a.x - calloutCenterX) - Math.abs(b.x - calloutCenterX) || a.x - b.x,
    )
    return new Map(sorted.map((item, index) => [canonicalEventId(item.event), index]))
  }, [activeLayout?.events, calloutCenterX])

  const renderIntroEvent = (
    eventKey: string,
    x: number,
    y: number,
    content: ReactNode,
  ) => {
    if (!isIntroActive) return content

    const orderIndex = introEventOrder.get(eventKey) ?? 0
    const delay = eventIntroDelayMs(x, calloutCenterX, orderIndex)
    const opacity = eventIntroOpacity(introProgress.events, delay)

    return (
      <div
        className="family-event-anchor"
        style={{
          left: Math.round(x),
          top: Math.round(y),
          opacity,
          transition: 'opacity 0.28s ease-out',
        }}
      >
        <div className="family-event-wrap">{content}</div>
      </div>
    )
  }

  const occupiedSlots = useMemo(() => {
    if (!activeLayout) return []
    const half = (calloutLayout.maxWidthPx / 2) * 0.85
    const calloutReserve =
      primaryCluster && width > 0
        ? { left: calloutCenterX - half, right: calloutCenterX + half, y: 100, lane: 0 }
        : null
    return [
      ...activeLayout.events.map((e) => {
        const halfW = estimatedLabelHalfWidth(e.event)
        return { left: e.x - halfW, right: e.x + halfW, y: e.y, lane: 0 }
      }),
      ...(calloutReserve ? [calloutReserve] : []),
    ]
  }, [activeLayout, primaryCluster, calloutCenterX, calloutLayout.maxWidthPx, width])

  const representativeNodes = useMemo(() => {
    if (!timelineFilters.births || useBirthClusters || zoomSemantic !== 'detail') return []
    if ((activeLayout?.events.length ?? 0) > 0) return []

    const visible = chooseFocus(
      filteredBirthPeople.filter((p) => p.birthYear && p.birthYear >= start && p.birthYear <= end),
      Math.min(3, peopleBudgetForMode(mode)),
    )
    return placeLabels(visible, start, span, width, height, occupiedSlots)
      .filter((o) => o.show)
      .slice(0, Math.min(2, peopleBudgetForMode(mode)))
  }, [timelineFilters.births, useBirthClusters, zoomSemantic, activeLayout, occupiedSlots, filteredBirthPeople, start, end, span, width, height, mode])

  const { registerFamilyPulseTargets } = useTimelinePulse()

  const spanBucket = Math.round(span)

  useLayoutEffect(() => {
    if (isZooming) {
      pinnedSpanBucketRef.current = null
      pinnedEventsRef.current = []
      previousRenderedIdsRef.current = []
      return
    }
    const layoutEvents = activeLayout?.events
    if (!layoutEvents?.length && pinnedEventsRef.current.length === 0) return

    if (pinnedSpanBucketRef.current !== spanBucket) {
      pinnedSpanBucketRef.current = spanBucket
      pinnedEventsRef.current = (layoutEvents ?? []).map((entry) => ({ ...entry }))
      previousRenderedIdsRef.current = (layoutEvents ?? []).map((entry) =>
        canonicalEventId(entry.event),
      )
      return
    }

    // Same zoom: refresh placement for events layout still proposes; keep prior pins
    // only while their year remains in (or just outside) the viewport.
    const byId = new Map(
      pinnedEventsRef.current.map((entry) => [canonicalEventId(entry.event), entry] as const),
    )
    for (const entry of layoutEvents ?? []) {
      byId.set(canonicalEventId(entry.event), { ...entry })
    }
    const edgePad = Math.max(1, span * 0.01)
    pinnedEventsRef.current = [...byId.values()].filter(
      (entry) => entry.event.year >= start - edgePad && entry.event.year <= end + edgePad,
    )
  }, [isZooming, spanBucket, activeLayout?.events, start, end, span])

  const renderLayout = useMemo(() => {
    const zoomFrozen =
      persistEventMarkers && frozenEventsRef.current?.length ? frozenEventsRef.current : null
    if (zoomFrozen) {
      return {
        events: zoomFrozen
          .filter(({ event }) => event.year >= start && event.year <= end)
          .map((entry) => ({
            ...entry,
            x: yearX(entry.event.year, start, span, width),
            nudge: 0,
            alignment: 'center' as const,
          })),
        clusters: [] as PlacedEventConflictCluster[],
      }
    }

    const byId = new Map<string, (typeof pinnedEventsRef.current)[number]>()
    if (
      !isZooming &&
      pinnedSpanBucketRef.current === spanBucket &&
      pinnedEventsRef.current.length > 0
    ) {
      for (const entry of pinnedEventsRef.current) {
        byId.set(canonicalEventId(entry.event), entry)
      }
    }
    for (const entry of activeLayout?.events ?? []) {
      byId.set(canonicalEventId(entry.event), entry)
    }

    const candidates = [...byId.values()]
      .filter(({ event }) => event.year >= start && event.year <= end)
      .map((entry) => ({
        ...entry,
        x: yearX(entry.event.year, start, span, width),
      }))

    const limit = maxFamilyEventsForSpan(span, width)
    const stickyIds = previousRenderedIdsRef.current.filter((id) =>
      candidates.some((entry) => canonicalEventId(entry.event) === id),
    )
    const admitted = admitPersistentMarkers(
      candidates,
      stickyIds,
      (entry) => canonicalEventId(entry.event),
      (entry) =>
        (entry.event.importance ?? 0) * 12 +
        (entry.event.kind === 'move' || entry.event.kind === 'service'
          ? 40
          : entry.event.kind === 'birth'
            ? 20
            : entry.event.kind === 'death'
              ? 10
              : 0) +
        (entry.event.person.focus ? 30 : 0),
      limit,
    )

    const mustKeep = new Set(stickyIds.filter((id) => admitted.some((e) => canonicalEventId(e.event) === id)))
    const staggered = staggerFamilyEventLanes(admitted, height, span, width, mustKeep)

    assertNoDuplicateEvents(
      staggered.map((p) => p.event),
      'FamilyLayer.renderEvents',
    )

    return foldSpatiallyConflictingEvents(staggered, span, width, height)
  }, [activeLayout, persistEventMarkers, isZooming, spanBucket, start, end, span, width, height])

  const renderEvents = renderLayout.events
  const conflictClusters = renderLayout.clusters

  useLayoutEffect(() => {
    if (isZooming) return
    previousRenderedIdsRef.current = [
      ...renderEvents.map((entry) => canonicalEventId(entry.event)),
      ...conflictClusters.flatMap((cluster) => cluster.events.map((event) => canonicalEventId(event))),
    ]
    // Pin what is actually on screen so pan refreshes keep geometry stable.
    const byId = new Map(
      pinnedEventsRef.current.map((entry) => [canonicalEventId(entry.event), entry] as const),
    )
    for (const entry of renderEvents) {
      byId.set(canonicalEventId(entry.event), { ...entry })
    }
    pinnedEventsRef.current = [...byId.values()].filter(
      (entry) => entry.event.year >= start && entry.event.year <= end,
    )
    if (pinnedSpanBucketRef.current !== spanBucket) {
      pinnedSpanBucketRef.current = spanBucket
    }
  }, [renderEvents, conflictClusters, isZooming, start, end, spanBucket])

  useLayoutEffect(() => {
    if (!persistEventMarkers || !activeLayout?.events?.length) return
    if (!persistSnapshotRef.current) {
      frozenEventsRef.current = activeLayout.events.map((entry) => ({ ...entry }))
      persistSnapshotRef.current = true
    }
  }, [persistEventMarkers, activeLayout?.events])

  registerFamilyPulseTargets(
    useMemo(
      () => [
        ...renderEvents.map(({ event, x }) => ({
          key: canonicalEventId(event),
          year: event.year,
          x: Math.round(x),
        })),
        ...conflictClusters.map((cluster) => ({
          key: cluster.id,
          year: Math.round((cluster.from + cluster.to) / 2),
          x: Math.round(cluster.x),
        })),
      ],
      [renderEvents, conflictClusters],
    ),
  )

  const resolveEventY = (eventKey: string, computedY: number) => {
    if (!isZooming) return computedY
    const frozen = frozenEventYRef.current
    const existing = frozen.get(eventKey)
    if (existing != null) return existing
    frozen.set(eventKey, computedY)
    return computedY
  }

  const clampPlaqueY = (
    event: FamilyEvent,
    x: number,
    y: number,
    alignment: LabelAlignment = 'center',
    nudge = 0,
    compact = false,
  ) => {
    const ceiling = familyLabelCeilingY(timelineAxisY(height, width))
    const belowEditorial = clampAnchorBelowEditorialPanels(
      event,
      x,
      y,
      width,
      alignment,
      nudge,
      compact,
    )
    const cleared = !effectivePlaqueAnchor
      ? belowEditorial
      : clampAnchorBelowPlaque(
          event,
          x,
          belowEditorial,
          width,
          effectivePlaqueAnchor,
          alignment,
          nudge,
          compact,
        )
    // Never let family markers cross into the history band below the axis.
    return Math.min(cleared, ceiling)
  }

  const axisY = useMemo(() => timelineAxisY(height, width), [height, width])

  const zoomToCluster = (from: number, to: number) => {
    unlockChapterScroll()
    const targetSpan = chapterZoomInSpan(from, to)
    if (targetSpan >= span * 0.98) return
    setThinkingFocusRange({ start: from, end: to })
    animateView((from + to) / 2, targetSpan, 820)
  }

  const zoomToConflictCluster = (cluster: PlacedEventConflictCluster) => {
    completeIntro()
    unlockChapterScroll()
    const targetSpan = conflictClusterZoomSpan(cluster.from, cluster.to, span)
    setThinkingFocusRange({ start: cluster.from, end: cluster.to })
    animateView((cluster.from + cluster.to) / 2, targetSpan, 820)
  }

  const zoomOutFromCluster = (from: number, to: number) => {
    const anchor = (from + to) / 2
    const nextValue = Math.max(0, zoomValue - 7)
    animateView(anchor, spanFromZoomValue(nextValue, fullSpan), 560)
  }

  const canZoomInCluster = (from: number, to: number) => {
    const targetSpan = chapterZoomInSpan(from, to)
    return targetSpan < span * 0.98
  }

  const scrollTimelineBy = (direction: -1 | 1) => {
    panTimelineBy(direction)
  }

  function chapterZoomInSpan(from: number, to: number) {
    if (useBirthClusters) {
      const bin = span > 430 ? 100 : span > 280 ? 50 : 25
      const naturalSpan = Math.max(18, bin * 1.4)
      return Math.max(6, Math.min(naturalSpan, span * 0.55))
    }

    const naturalSpan = Math.max(7, (to - from) * 2.2 + 8)
    return Math.max(6, Math.min(naturalSpan, span * 0.55))
  }

  const handleEventOpen = (event: FamilyEvent) => {
    completeIntro()
    if (event.kind === 'move' || event.kind === 'service') openFamilyEvent(event)
    else openPerson(event.person.id)
  }

  const opacityFadeTransition = motionEnabled
    ? {
        opacity: {
          duration: isZooming ? 0.55 : 0.45,
          ease: motionEase,
        },
        default: { duration: 0 },
      }
    : { duration: 0.01 }

  const detailOpacityTransition = motionEnabled
    ? {
        opacity: { duration: 0.2, ease: detailMotionEase },
        default: { duration: 0 },
      }
    : { duration: 0.01 }

  const renderPlacedFamilyEvent = (
    eventKey: string,
    x: number,
    renderY: number,
    button: ReactNode,
    detailMotion = false,
  ) => {
    if (isIntroActive) {
      return <div key={eventKey}>{renderIntroEvent(eventKey, x, renderY, button)}</div>
    }

    if (persistEventMarkers || !eventFadeEnabled) {
      return (
        <div
          key={eventKey}
          className="family-event-anchor"
          style={{ left: Math.round(x), top: Math.round(renderY) }}
        >
          <div className="family-event-wrap">{button}</div>
        </div>
      )
    }

    return (
      <motion.div
        key={eventKey}
        className="family-event-anchor"
        style={{ left: Math.round(x), top: Math.round(renderY) }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={detailMotion ? detailOpacityTransition : opacityFadeTransition}
        layout={false}
      >
        <div className="family-event-wrap">{button}</div>
      </motion.div>
    )
  }

  const placedFamilyEvents = (() => {
    const prepared = renderEvents.map(({ event, x, y, alignment, nudge, compact }) => {
      const eventKey = canonicalEventId(event)
      const clampedY = clampPlaqueY(
        event,
        x,
        resolveEventY(eventKey, y),
        alignment,
        nudge,
        compact,
      )
      const footprint = measureDetailedFootprint(event, width, compact ?? false)
      return {
        id: eventKey,
        event,
        x,
        y: clampedY,
        width: footprint.width,
        height: footprint.height,
        alignment,
        nudge,
        compact,
      }
    })

    const separated = deconflictFamilyAnchorYs(prepared, 16, familyLabelCeilingY(axisY))

    return separated.map(({ id: eventKey, event, x, y: renderY, alignment, nudge, compact }) => {
      const stemLength = familyEventStemLength(renderY, axisY)
      const button = (
        <FamilyEventButton
          event={event}
          x={0}
          y={0}
          viewportWidth={width}
          alignment={alignment}
          nudge={nudge}
          compact={compact}
          stemLength={stemLength}
          motionEnabled={zoomSemantic === 'detail'}
          onOpen={handleEventOpen}
          onExplore={openPerson}
          onViewTree={viewOnTree}
        />
      )

      return renderPlacedFamilyEvent(eventKey, x, renderY, button, zoomSemantic === 'detail')
    })
  })()

  return (
    <>
      <div className="density-layer">
        {densityBars.map((bar, i) => (
          <div
            key={i}
            className="density"
            style={{
              left: bar.x,
              width: bar.width,
              opacity: bar.opacity,
              height: bar.height,
            }}
          />
        ))}
      </div>

      {useBirthClusters && primaryCluster && (
        <ChapterCalloutPresence
          primary={primaryCluster}
          clusters={activeClusters}
          verticalLayout={chapterVerticalLayout}
          zoomMode="far"
          totalTimelineStart={earliestYear}
          totalTimelineEnd={totalTimelineEnd}
          viewportWidth={width}
          layout={calloutLayout}
          motionEnabled={motionEnabled}
          onZoomIn={(c) => zoomToCluster(c.from, c.to)}
          onZoomOut={(c) => zoomOutFromCluster(c.from, c.to)}
          canZoomIn={canZoomInCluster(primaryCluster.from, primaryCluster.to)}
          canZoomOut={!isWideTimelineView}
          isWideTimelineView={isWideTimelineView}
          onScrollPrev={() => scrollTimelineBy(-1)}
          onScrollNext={() => scrollTimelineBy(1)}
          canScrollPrev={canScrollTimelinePrev}
          canScrollNext={canScrollTimelineNext}
          showScrollChevrons={showChapterScrollChevrons}
          onPlaqueAnchorChange={handlePlaqueAnchorChange}
        />
      )}

      {!useBirthClusters && primaryCluster && (
        <ChapterCalloutPresence
          primary={primaryCluster}
          clusters={activeClusters}
          verticalLayout={chapterVerticalLayout}
          zoomMode="far"
          totalTimelineStart={earliestYear}
          totalTimelineEnd={totalTimelineEnd}
          viewportWidth={width}
          layout={calloutLayout}
          motionEnabled={motionEnabled}
          onZoomIn={(c) => zoomToCluster(c.from, c.to)}
          onZoomOut={(c) => zoomOutFromCluster(c.from, c.to)}
          canZoomIn={canZoomInCluster(primaryCluster.from, primaryCluster.to)}
          canZoomOut={!isWideTimelineView}
          isWideTimelineView={isWideTimelineView}
          onScrollPrev={() => scrollTimelineBy(-1)}
          onScrollNext={() => scrollTimelineBy(1)}
          canScrollPrev={canScrollTimelinePrev}
          canScrollNext={canScrollTimelineNext}
          showScrollChevrons={showChapterScrollChevrons}
          onPlaqueAnchorChange={handlePlaqueAnchorChange}
        />
      )}

      {activeClusters.length > 0 && !primaryCluster && (
        <ChapterConnectorLayer
          clusters={activeClusters}
          primaryCluster={null}
          verticalLayout={chapterVerticalLayout}
          zoomMode="far"
        />
      )}

      <div id="nodes">
        {eventFadeEnabled ? (
          <AnimatePresence mode="sync">
            {placedFamilyEvents}
          </AnimatePresence>
        ) : (
          placedFamilyEvents
        )}

        {conflictClusters.map((cluster) => (
          <div
            key={cluster.id}
            className="family-event-anchor family-event-cluster-anchor"
            style={{ left: Math.round(cluster.x), top: Math.round(cluster.y) }}
          >
            <button
              type="button"
              className="family-event-cluster"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                zoomToConflictCluster(cluster)
              }}
              aria-label={`${cluster.count} events from ${cluster.from} to ${cluster.to}. Zoom in to reveal.`}
              title={`Zoom in to reveal ${cluster.count} events`}
            >
              <span className="cluster-count">{cluster.count}</span>
              <span className="cluster-label">Events</span>
              <span className="cluster-range">
                {cluster.from === cluster.to ? cluster.from : `${cluster.from}–${cluster.to}`}
              </span>
              <span className="cluster-stem" aria-hidden="true" />
            </button>
          </div>
        ))}

        {representativeNodes.map(({ person: p, x, y }) => (
          <div
            key={p.id}
            className="node representative-wrap"
            style={{ left: Math.round(x), top: Math.round(y) }}
          >
            <FamilyMemberActionTip
              personId={p.id}
              onExplore={openPerson}
              onViewTree={viewOnTree}
            />
            <button
              type="button"
              className="node representative"
              title={`${p.name} · ${p.birthYear}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                openPerson(p.id)
              }}
            >
              <span className="node-dot" />
              <span className="node-label">
                <b>{p.name}</b>
                <small>
                  {p.birthYear}
                  {p.birthPlace ? ` · ${p.birthPlace.split(',')[0]}` : ''}
                </small>
              </span>
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
