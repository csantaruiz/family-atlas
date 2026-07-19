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
import { TimelineHint } from './TimelineHint'
import {
  buildBirthClusters,
  chooseFocus,
  estimatedLabelHalfWidth,
  layoutBirthClustersProgressive,
  layoutFamilyEventsProgressive,
  peopleBudgetForMode,
  placeLabels,
  semanticZoomMode,
  showBirthPeriodClusters,
} from '../utils/clustering'
import { movementSummary } from '../utils/placeUtils'
import { eventAccessibleTitle } from '../utils/detailPlacement'
import { categoryTypeLabel, clampAnchorBelowPlaque, displayName, measureDetailedFootprint, type LabelAlignment } from '../utils/labelMeasure'
import { canonicalEventId, assertNoDuplicateEvents } from '../utils/canonicalEvent'
import { connectorStemColor, familyEventStemLength } from '../utils/eventConnector'
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
    birthPeople,
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

  const mode = zoomMode(span)
  const earliestYear = familyDatabase.stats.earliestYear
  const totalTimelineEnd = presentYear

  const zoomSemantic = useMemo(() => {
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
  }, [filteredFamilyEvents, start, end, span, fullSpan, width, earliestYear, presentYear])

  const useBirthClusters = showBirthPeriodClusters(span) && timelineFilters.births
  const prefersReducedMotion = useReducedMotion()
  const motionEnabled = !prefersReducedMotion
  const {
    isIntroActive,
    introProgress,
    eventIntroDelayMs,
    completeIntro,
  } = useJourneyIntro()

  const densityBars = useMemo(() => {
    if (!timelineFilters.births || span < 120) return []
    const bin = span > 350 ? 50 : 25
    const bars: { x: number; width: number; opacity: number; height: number }[] = []
    for (let y = Math.floor(start / bin) * bin; y <= end; y += bin) {
      const count = birthPeople.filter((p) => p.birthYear && p.birthYear >= y && p.birthYear < y + bin).length
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
  }, [span, start, end, birthPeople, width, timelineFilters.births])

  const birthClusters = useMemo(() => {
    if (!useBirthClusters) return []
    return buildBirthClusters(birthPeople, start, end, span, width, height, presentYear)
  }, [useBirthClusters, birthPeople, start, end, span, width, height, presentYear])

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
        zoomMode: useBirthClusters ? 'far' : zoomSemantic,
        totalVisibleEvents: visibleInViewport.length,
        placedEventCount: visibleInViewport.length,
        viewportWidth: width,
      }),
    [useBirthClusters, zoomSemantic, visibleInViewport.length, width],
  )

  const placementVerticalLayout = useMemo(
    () =>
      resolveChapterVerticalLayout(
        useBirthClusters ? 'far' : zoomSemantic,
        width,
        height,
        placementCalloutLayout,
      ),
    [useBirthClusters, zoomSemantic, width, height, placementCalloutLayout],
  )

  const estimatedPlaqueAnchor = useMemo((): CalloutLayoutAnchor | null => {
    if (useBirthClusters || zoomSemantic === 'detail') return null
    return {
      centerX: placementVerticalLayout.chapterCenterX,
      bottomY:
        placementVerticalLayout.cardTop + estimateCardFrameHeight(placementCalloutLayout) + 16,
      width: placementCalloutLayout.maxWidthPx,
    }
  }, [useBirthClusters, zoomSemantic, placementVerticalLayout, placementCalloutLayout])

  const effectivePlaqueAnchor = plaqueAnchor ?? estimatedPlaqueAnchor

  const birthLayout = useMemo(() => {
    if (!useBirthClusters) return null
    const eventsInView = filteredFamilyEvents.filter((e) => e.year >= start && e.year <= end)
    return layoutBirthClustersProgressive(
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
  }, [useBirthClusters, birthClusters, filteredFamilyEvents, start, end, span, width, height, fullSpan, earliestYear, rootPersonId, presentYear, effectivePlaqueAnchor])

  const familyLayout = useMemo(() => {
    if (useBirthClusters) return null
    const events = filteredFamilyEvents.filter((e) => e.year >= start && e.year <= end)
    return layoutFamilyEventsProgressive(
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
  }, [useBirthClusters, filteredFamilyEvents, start, end, span, width, height, mode, fullSpan, earliestYear, rootPersonId, presentYear, effectivePlaqueAnchor])

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
      zoomMode: useBirthClusters ? 'far' : zoomSemantic,
      totalVisibleEvents: visibleInViewport.length,
      placedEventCount: activeLayout?.events.length ?? 0,
      viewportWidth: width,
    })
  }, [useBirthClusters, zoomSemantic, visibleInViewport.length, activeLayout?.events.length, width])

  const chapterVerticalLayout = useMemo(() => {
    return resolveChapterVerticalLayout(
      useBirthClusters ? 'far' : zoomSemantic,
      width,
      height,
      calloutLayout,
    )
  }, [useBirthClusters, zoomSemantic, width, height])

  const calloutCenterX = chapterVerticalLayout.chapterCenterX

  const plaqueHintTop =
    effectivePlaqueAnchor != null
      ? effectivePlaqueAnchor.bottomY + 12
      : chapterVerticalLayout.cardTop + estimateCardFrameHeight(calloutLayout) + 12

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
      birthPeople.filter((p) => p.birthYear && p.birthYear >= start && p.birthYear <= end),
      Math.min(3, peopleBudgetForMode(mode)),
    )
    return placeLabels(visible, start, span, width, height, occupiedSlots)
      .filter((o) => o.show)
      .slice(0, Math.min(2, peopleBudgetForMode(mode)))
  }, [timelineFilters.births, useBirthClusters, zoomSemantic, activeLayout, occupiedSlots, birthPeople, start, end, span, width, height, mode])

  const { registerFamilyPulseTargets } = useTimelinePulse()

  const renderEvents = useMemo(() => {
    const list = activeLayout?.events ?? []
    assertNoDuplicateEvents(
      list.map((p) => p.event),
      'FamilyLayer.renderEvents',
    )
    return list
  }, [activeLayout])

  registerFamilyPulseTargets(
    useMemo(
      () =>
        renderEvents.map(({ event, x }) => ({
          key: canonicalEventId(event),
          year: event.year,
          x: Math.round(x),
        })),
      [renderEvents],
    ),
  )

  const frozenEventYRef = useRef<Map<string, number>>(new Map())

  useLayoutEffect(() => {
    if (!isZooming) {
      frozenEventYRef.current.clear()
    }
  }, [isZooming])

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
    if (!effectivePlaqueAnchor) return y
    return clampAnchorBelowPlaque(
      event,
      x,
      y,
      width,
      effectivePlaqueAnchor,
      alignment,
      nudge,
      compact,
    )
  }

  const axisY = useMemo(() => timelineAxisY(height), [height])

  const zoomToCluster = (from: number, to: number) => {
    unlockChapterScroll()
    const targetSpan = chapterZoomInSpan(from, to)
    if (targetSpan >= span * 0.98) return
    setThinkingFocusRange({ start: from, end: to })
    animateView((from + to) / 2, targetSpan, 820)
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
          zoomMode={zoomSemantic}
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
          zoomMode={useBirthClusters ? 'far' : zoomSemantic}
        />
      )}

      <div
        className="timeline-plaque-hint"
        style={{
          top: plaqueHintTop,
          left: chapterVerticalLayout.chapterCenterX,
        }}
      >
        <TimelineHint />
      </div>

      <div id="nodes">
        {useBirthClusters && (
          <AnimatePresence mode="sync" initial={false}>
            {birthLayout?.events.map(({ event, x, y, alignment, nudge, compact }) => {
              const eventKey = canonicalEventId(event)
              const renderY = clampPlaqueY(
                event,
                x,
                resolveEventY(eventKey, y),
                alignment,
                nudge,
                compact,
              )
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

              if (isIntroActive) {
                return (
                  <div key={eventKey}>
                    {renderIntroEvent(eventKey, x, renderY, button)}
                  </div>
                )
              }

              return motionEnabled ? (
                <motion.div
                  key={eventKey}
                  className="family-event-anchor"
                  style={{ left: Math.round(x), top: Math.round(renderY) }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={opacityFadeTransition}
                  layout={false}
                >
                  <div className="family-event-wrap">{button}</div>
                </motion.div>
              ) : (
                <FamilyEventButton
                  key={eventKey}
                  event={event}
                  x={x}
                  y={renderY}
                  viewportWidth={width}
                  alignment={alignment}
                  nudge={nudge}
                  compact={compact}
                  stemLength={stemLength}
                  onOpen={handleEventOpen}
                  onExplore={openPerson}
                  onViewTree={viewOnTree}
                />
              )
            })}
          </AnimatePresence>
        )}

        {!useBirthClusters && (
          <AnimatePresence mode="sync" initial={false}>
            {renderEvents.map(({ event, x, y, alignment, nudge, compact }) => {
              const eventKey = canonicalEventId(event)
              const renderY = clampPlaqueY(
                event,
                x,
                resolveEventY(eventKey, y),
                alignment,
                nudge,
                compact,
              )
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

              if (isIntroActive) {
                return (
                  <div key={eventKey}>
                    {renderIntroEvent(eventKey, x, renderY, button)}
                  </div>
                )
              }

              return motionEnabled ? (
                <motion.div
                  key={eventKey}
                  className="family-event-anchor"
                  style={{ left: Math.round(x), top: Math.round(renderY) }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={
                    zoomSemantic === 'detail' ? detailOpacityTransition : opacityFadeTransition
                  }
                  layout={false}
                >
                  <div className="family-event-wrap">{button}</div>
                </motion.div>
              ) : (
                <FamilyEventButton
                  key={eventKey}
                  event={event}
                  x={x}
                  y={renderY}
                  viewportWidth={width}
                  alignment={alignment}
                  nudge={nudge}
                  compact={compact}
                  stemLength={stemLength}
                  onOpen={handleEventOpen}
                  onExplore={openPerson}
                  onViewTree={viewOnTree}
                />
              )
            })}
          </AnimatePresence>
        )}

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
