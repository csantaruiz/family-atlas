import { useMemo, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ChapterCalloutPresence,
  ChapterConnectorLayer,
  pickPrimaryCluster,
} from './ChapterViewportCallout'
import { getCalloutLayoutProfile } from '../utils/chapterPresentation'
import { resolveChapterVerticalLayout } from '../utils/chapterCalloutLayout'
import { familyDatabase } from '../data/familyDatabase'
import { assignEventsToChapters, buildStoryChaptersForViewport } from '../data/buildStoryChapters'
import { useTimeline } from '../context/TimelineContext'
import { useJourneyIntro } from '../context/JourneyIntroContext'
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
import { displayName } from '../utils/labelMeasure'
import { canonicalEventId, assertNoDuplicateEvents } from '../utils/canonicalEvent'
import {
  connectorElbowX,
  connectorNeedsElbow,
  connectorStemColor,
  CONNECTOR_V_LABEL,
  CONNECTOR_V_MARKER,
  labelWidthForEvent,
} from '../utils/eventConnector'
import { yearX, zoomMode } from '../utils/timelineMath'
import type { FamilyEvent } from '../types'
import type { LabelAlignment } from '../utils/labelMeasure'

type FamilyLayerProps = {
  start: number
  end: number
  width: number
  height: number
}

const motionEase = [0.22, 0.8, 0.2, 1] as const

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

const detailMotionEase = [0.22, 0.8, 0.2, 1] as const
const detailPlacementTransition = { duration: 0.2, ease: detailMotionEase }

function eventIntroOpacity(eventsProgress: number, staggerDelayMs: number): number {
  const threshold = staggerDelayMs / 420
  if (eventsProgress <= threshold) return 0
  return Math.min(1, (eventsProgress - threshold) / 0.32)
}

function EventConnector({
  elbowX,
  kind,
  animated,
}: {
  elbowX: number
  kind: FamilyEvent['kind']
  animated: boolean
}) {
  const color = connectorStemColor(kind)
  const needsElbow = connectorNeedsElbow(elbowX)

  if (!needsElbow) {
    return <span className="event-stem" aria-hidden="true" />
  }

  const hWidth = Math.abs(elbowX)
  const hLeft = elbowX < 0 ? elbowX : 0
  const segmentClass = animated ? 'event-connector-segment placement-animated' : 'event-connector-segment'

  return (
    <span className="event-connector" aria-hidden="true">
      <span
        className={segmentClass}
        style={{
          left: 0,
          bottom: 0,
          width: 1,
          height: CONNECTOR_V_MARKER,
          backgroundColor: color,
          transform: 'translateX(-50%)',
        }}
      />
      <span
        className={segmentClass}
        style={{
          left: hLeft,
          bottom: CONNECTOR_V_MARKER,
          width: hWidth,
          height: 1,
          backgroundColor: color,
          transform: 'none',
        }}
      />
      <span
        className={segmentClass}
        style={{
          left: elbowX,
          bottom: CONNECTOR_V_MARKER,
          width: 1,
          height: CONNECTOR_V_LABEL,
          backgroundColor: color,
          transform: 'translateX(-50%)',
        }}
      />
    </span>
  )
}

function FamilyEventButton({
  event,
  x,
  y,
  onOpen,
  alignment = 'center',
  nudge = 0,
  compact = false,
  motionEnabled = false,
}: {
  event: FamilyEvent
  x: number
  y: number
  onOpen: (event: FamilyEvent) => void
  alignment?: LabelAlignment
  nudge?: number
  compact?: boolean
  motionEnabled?: boolean
}) {
  let label: React.ReactNode
  let title: string
  let sub = ''
  const accessibleTitle = eventAccessibleTitle(event)

  if (event.kind === 'birth') {
    label = (
      <>
        <SunriseIcon />
        BIRTH OF
      </>
    )
    title = displayName(event, compact)
  } else if (event.kind === 'death') {
    label = (
      <>
        <CrossIcon />
        DEATH OF
      </>
    )
    title = displayName(event, compact)
  } else if (event.kind === 'move') {
    label = 'MIGRATION'
    title = displayName(event, compact)
    sub = compact ? '' : movementSummary(event)
  } else {
    label = 'FAMILY STORY'
    title = compact ? displayName(event, true) : event.title
    sub = compact ? '' : event.detail || event.person.name
  }

  const labelWidth = labelWidthForEvent(event, compact)
  const elbowX = connectorElbowX(alignment, nudge, labelWidth)
  const hasElbow = connectorNeedsElbow(elbowX)

  const style = {
    left: Math.round(x),
    top: Math.round(y),
    '--label-nudge': `${nudge}px`,
  } as React.CSSProperties

  const className = [
    'family-event',
    event.kind,
    `align-${alignment}`,
    compact ? 'compact' : '',
    hasElbow ? 'has-elbow' : '',
    motionEnabled ? 'placement-animated' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={className}
      style={style}
      title={accessibleTitle}
      aria-label={accessibleTitle}
      onPointerDown={(ev) => ev.stopPropagation()}
      onClick={(ev) => {
        ev.stopPropagation()
        onOpen(event)
      }}
    >
      <span className="event-copy">
        <em>{label}</em>
        <b>{title}</b>
        {sub ? <small>{sub}</small> : null}
      </span>
      <span className="event-anchor" />
      <EventConnector elbowX={elbowX} kind={event.kind} animated={motionEnabled} />
    </button>
  )
}

export function FamilyLayer({ start, end, width, height }: FamilyLayerProps) {
  const {
    span,
    presentYear,
    fullSpan,
    birthPeople,
    filteredFamilyEvents,
    timelineFilters,
    animateView,
    openPerson,
    openFamilyEvent,
    setThinkingFocusRange,
    isZooming,
  } = useTimeline()

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
    )
  }, [useBirthClusters, birthClusters, filteredFamilyEvents, start, end, span, width, height, fullSpan, earliestYear, rootPersonId, presentYear])

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
    )
  }, [useBirthClusters, filteredFamilyEvents, start, end, span, width, height, mode, fullSpan, earliestYear, rootPersonId, presentYear])

  const activeLayout = useBirthClusters ? birthLayout : familyLayout

  const activeClusters = activeLayout?.clusters ?? []
  const primaryCluster = useMemo(
    () => pickPrimaryCluster(activeClusters, start, span),
    [activeClusters, start, span],
  )

  const visibleInViewport = useMemo(
    () => filteredFamilyEvents.filter((e) => e.year >= start && e.year <= end),
    [filteredFamilyEvents, start, end],
  )

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
  }, [useBirthClusters, zoomSemantic, width, height, calloutLayout])

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
    const offsetY = 5 * (1 - opacity)

    return (
      <div
        className="family-event-wrap"
        style={{
          left: Math.round(x),
          top: Math.round(y),
          opacity,
          transform: `translateY(${offsetY}px)`,
          transition: `opacity 0.28s ease-out, transform 0.28s ease-out`,
        }}
      >
        {content}
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

  const renderEvents = useMemo(() => {
    const list = activeLayout?.events ?? []
    assertNoDuplicateEvents(
      list.map((p) => p.event),
      'FamilyLayer.renderEvents',
    )
    return list
  }, [activeLayout])

  const zoomToCluster = (from: number, to: number) => {
    setThinkingFocusRange({ start: from, end: to })
    const targetCenter = (from + to) / 2
    const naturalSpan = Math.max(7, (to - from) * 2.2 + 8)
    const targetSpan = Math.max(6, Math.min(naturalSpan, span * 0.55))
    if (targetSpan >= span * 0.98) return
    animateView(targetCenter, targetSpan, 820)
  }

  const handleEventOpen = (event: FamilyEvent) => {
    completeIntro()
    if (event.kind === 'move' || event.kind === 'service') openFamilyEvent(event)
    else openPerson(event.person.id)
  }

  const dissolveTransition = motionEnabled
    ? { duration: isZooming ? 0.55 : 0.45, ease: motionEase }
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
          onZoom={(c) => {
            const bin = span > 430 ? 100 : span > 280 ? 50 : 25
            const naturalSpan = Math.max(18, bin * 1.4)
            const targetSpan = Math.max(6, Math.min(naturalSpan, span * 0.55))
            if (targetSpan >= span * 0.98) return
            setThinkingFocusRange({ start: c.from, end: c.to })
            animateView((c.from + c.to) / 2, targetSpan, 820)
          }}
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
          onZoom={(c) => zoomToCluster(c.from, c.to)}
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

      <div id="nodes">
        {useBirthClusters && (
          <AnimatePresence mode="sync">
            {birthLayout?.events.map(({ event, x, y, alignment, nudge, compact }) => {
              const eventKey = canonicalEventId(event)
              const button = (
                <FamilyEventButton
                  event={event}
                  x={0}
                  y={0}
                  alignment={alignment}
                  nudge={nudge}
                  compact={compact}
                  motionEnabled={zoomSemantic === 'detail'}
                  onOpen={handleEventOpen}
                />
              )

              if (isIntroActive) {
                return (
                  <div key={eventKey}>
                    {renderIntroEvent(eventKey, x, y, button)}
                  </div>
                )
              }

              return motionEnabled ? (
                <motion.div
                  key={eventKey}
                  className="family-event-wrap"
                  style={{ left: Math.round(x), top: Math.round(y) }}
                  initial={{ opacity: 0, y: y + 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: y - 8 }}
                  transition={dissolveTransition}
                >
                  {button}
                </motion.div>
              ) : (
                <FamilyEventButton
                  key={eventKey}
                  event={event}
                  x={x}
                  y={y}
                  alignment={alignment}
                  nudge={nudge}
                  compact={compact}
                  onOpen={handleEventOpen}
                />
              )
            })}
          </AnimatePresence>
        )}

        {!useBirthClusters && (
          <AnimatePresence mode="sync">
            {renderEvents.map(({ event, x, y, alignment, nudge, compact }) => {
              const eventKey = canonicalEventId(event)
              const button = (
                <FamilyEventButton
                  event={event}
                  x={0}
                  y={0}
                  alignment={alignment}
                  nudge={nudge}
                  compact={compact}
                  motionEnabled={zoomSemantic === 'detail'}
                  onOpen={handleEventOpen}
                />
              )

              if (isIntroActive) {
                return (
                  <div key={eventKey}>
                    {renderIntroEvent(eventKey, x, y, button)}
                  </div>
                )
              }

              return motionEnabled ? (
                <motion.div
                  key={eventKey}
                  className="family-event-wrap"
                  style={{ left: Math.round(x), top: Math.round(y) }}
                  initial={{ opacity: 0, y: y + 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: y - 8 }}
                  transition={zoomSemantic === 'detail' ? detailPlacementTransition : dissolveTransition}
                >
                  {button}
                </motion.div>
              ) : (
                <FamilyEventButton
                  key={eventKey}
                  event={event}
                  x={x}
                  y={y}
                  alignment={alignment}
                  nudge={nudge}
                  compact={compact}
                  onOpen={handleEventOpen}
                />
              )
            })}
          </AnimatePresence>
        )}

        {representativeNodes.map(({ person: p, x, y }) => (
          <button
            key={p.id}
            type="button"
            className="node representative"
            style={{ left: Math.round(x), top: Math.round(y) }}
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
        ))}
      </div>
    </>
  )
}
