import { useLayoutEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { historyEvents } from '../data'
import { historyEventHeroKey } from '../data/historyEventImagery'
import { useTimelinePulse } from '../context/TimelinePulseContext'
import { useTimeline } from '../context/TimelineContext'
import { MIN_VIEWPORT_EVENTS } from '../utils/semanticZoom'
import { activeCountriesAt } from '../utils/placeUtils'
import { yearX } from '../utils/timelineMath'
import { timelineAxisY } from '../utils/chapterCalloutLayout'
import { isNarrowStage, stageLayoutProfile } from '../utils/stageBreakpoints'
import type { HistoryEvent, Person, RenderedHistoryEvent } from '../types'

const motionEase = [0.22, 0.8, 0.2, 1] as const

type WorldHistoryLayerProps = {
  start: number
  end: number
  width: number
  height: number
}

function matchesCountryFilter(ev: HistoryEvent, birthPeople: Person[]): boolean {
  const active = activeCountriesAt(ev.year, birthPeople)
  if (ev.country === 'Global') return true
  if (ev.country === 'Britain') {
    return ['Britain', 'England', 'Scotland', 'Ireland'].some((c) => active.has(c))
  }
  return active.has(ev.country)
}

function historyZone(year: number, start: number, end: number): 'left' | 'center' | 'right' {
  const p = (year - start) / Math.max(1, end - start)
  if (p < 0.33) return 'left'
  if (p < 0.66) return 'center'
  return 'right'
}

function rankHistoryEvents(events: HistoryEvent[], center: number): HistoryEvent[] {
  return [...events].sort(
    (a, b) =>
      b.importance - a.importance || Math.abs(a.year - center) - Math.abs(b.year - center),
  )
}

function historyTargetCount(span: number, viewportWidth = 1200): number {
  let cap = 12
  if (span > 320) cap = 6
  else if (span > 150) cap = 8
  else if (span > 55) cap = 10
  return stageLayoutProfile(viewportWidth, 800).historyEventCap(cap)
}

function minHistoryYearGap(span: number, viewportWidth = 1200): number {
  const narrow = isNarrowStage(viewportWidth)
  if (span > 320) return narrow ? 64 : 48
  if (span > 150) return narrow ? 36 : 28
  if (span > 55) return narrow ? 18 : 14
  return narrow ? 10 : 8
}

function minHistoryPixelGap(span: number, viewportWidth = 1200): number {
  const narrow = isNarrowStage(viewportWidth)
  if (span > 320) return narrow ? 160 : 250
  if (span > 150) return narrow ? 120 : 190
  if (span > 55) return narrow ? 95 : 140
  return narrow ? 72 : 95
}

function passesHistorySpacing(
  candidate: HistoryEvent,
  selected: HistoryEvent[],
  span: number,
  viewportWidth = 1200,
): boolean {
  const minYears = minHistoryYearGap(span, viewportWidth)
  for (const event of selected) {
    if (Math.abs(event.year - candidate.year) < minYears) return false
  }
  return true
}

function bestInHistoryEra(
  pool: HistoryEvent[],
  eraStart: number,
  eraEnd: number,
  center: number,
): HistoryEvent | null {
  const inEra = pool.filter((ev) => ev.year >= eraStart && ev.year <= eraEnd)
  return rankHistoryEvents(inEra, center)[0] ?? null
}

function selectHistoricalEvents(
  start: number,
  end: number,
  span: number,
  center: number,
  birthPeople: Person[],
  previousSticky: HistoryEvent[] = [],
  viewportWidth = 1200,
): HistoryEvent[] {
  const inViewport = historyEvents.filter((ev) => ev.year >= start && ev.year <= end)
  if (!inViewport.length) return []

  const targetCount = Math.min(historyTargetCount(span, viewportWidth), inViewport.length)
  const baseImportance = span > 320 ? 3 : span > 150 ? 2 : 1
  const inViewportByKey = new Map(inViewport.map((ev) => [historyEventHeroKey(ev), ev]))

  let pool: HistoryEvent[] = []
  for (let importance = baseImportance; importance >= 1; importance--) {
    pool = inViewport.filter((ev) => ev.importance >= importance && matchesCountryFilter(ev, birthPeople))
    if (pool.length >= Math.min(MIN_VIEWPORT_EVENTS, targetCount)) break
  }

  if (pool.length < MIN_VIEWPORT_EVENTS) {
    pool = inViewport.filter((ev) => matchesCountryFilter(ev, birthPeople))
  }
  if (pool.length < MIN_VIEWPORT_EVENTS) {
    pool = inViewport
  }

  const selected: HistoryEvent[] = []
  const selectedKeys = new Set<string>()

  /** Sticky markers already shown stay while in view — within the density limit. */
  const addSticky = (event: HistoryEvent | null | undefined): boolean => {
    if (!event || selected.length >= targetCount) return false
    const key = historyEventHeroKey(event)
    if (selectedKeys.has(key)) return false
    selected.push(event)
    selectedKeys.add(key)
    return true
  }

  const addFresh = (event: HistoryEvent | null | undefined): boolean => {
    if (!event || selected.length >= targetCount) return false
    const key = historyEventHeroKey(event)
    if (selectedKeys.has(key)) return false
    if (!passesHistorySpacing(event, selected, span, viewportWidth)) return false
    selected.push(event)
    selectedKeys.add(key)
    return true
  }

  for (const event of previousSticky) {
    addSticky(inViewportByKey.get(historyEventHeroKey(event)))
  }

  if (selected.length >= targetCount) {
    return selected.sort((a, b) => a.year - b.year)
  }

  if (span > 320) {
    const eraCount = 5
    for (let i = 0; i < eraCount; i++) {
      if (selected.length >= targetCount) break
      const eraStart = start + (span * i) / eraCount
      const eraEnd = i === eraCount - 1 ? end : start + (span * (i + 1)) / eraCount - 1
      addFresh(bestInHistoryEra(pool, eraStart, eraEnd, center))
    }
  } else {
    for (const zone of ['left', 'center', 'right'] as const) {
      const best = rankHistoryEvents(
        pool.filter(
          (ev) => historyZone(ev.year, start, end) === zone && !selectedKeys.has(historyEventHeroKey(ev)),
        ),
        center,
      )[0]
      addFresh(best)
    }
  }

  for (const event of rankHistoryEvents(
    pool.filter((ev) => !selectedKeys.has(historyEventHeroKey(ev))),
    center,
  )) {
    if (selected.length >= targetCount) break
    addFresh(event)
  }

  return selected.sort((a, b) => a.year - b.year)
}

export function WorldHistoryLayer({ start, end, width, height }: WorldHistoryLayerProps) {
  const { span, center, birthPeople, openHistory, timelineFilters, isZooming } = useTimeline()
  const { pulse, registerHistoryPulseTargets } = useTimelinePulse()
  const prefersReducedMotion = useReducedMotion()
  const historyVisible = timelineFilters.historicalEvents
  const interactionLocked = isZooming
  const persistEventMarkers = interactionLocked
  const eventFadeEnabled = !prefersReducedMotion && !persistEventMarkers
  const frozenHistoryEventsRef = useRef<HistoryEvent[] | null>(null)
  const frozenHistoryPlacementRef = useRef<Map<string, { y: number; stemHeight: number }> | null>(null)
  const pinnedHistoryRef = useRef<HistoryEvent[]>([])
  const pinnedHistoryPlacementRef = useRef<Map<string, { y: number; stemHeight: number }>>(new Map())
  const pinnedHistorySpanRef = useRef<number | null>(null)
  const spanBucket = Math.round(span)

  if (!interactionLocked) {
    frozenHistoryEventsRef.current = null
    frozenHistoryPlacementRef.current = null
  }

  useLayoutEffect(() => {
    if (isZooming) {
      pinnedHistoryRef.current = []
      pinnedHistoryPlacementRef.current.clear()
      pinnedHistorySpanRef.current = null
    }
  }, [isZooming])

  // Lane geometry is span-dependent — drop placement pins when the zoom bucket changes.
  useLayoutEffect(() => {
    if (pinnedHistorySpanRef.current == null) return
    if (pinnedHistorySpanRef.current === spanBucket) return
    pinnedHistoryPlacementRef.current.clear()
  }, [spanBucket])

  // Ignore placements captured before the stage has a real height.
  useLayoutEffect(() => {
    if (height >= 240) return
    pinnedHistoryPlacementRef.current.clear()
  }, [height])

  const freshSelection = useMemo(() => {
    if (!historyVisible) return [] as HistoryEvent[]
    const sticky =
      !isZooming && pinnedHistorySpanRef.current === spanBucket ? pinnedHistoryRef.current : []
    return selectHistoricalEvents(start, end, span, center, birthPeople, sticky, width)
  }, [historyVisible, span, start, end, center, birthPeople, isZooming, spanBucket, width])

  useLayoutEffect(() => {
    if (!historyVisible || isZooming) return

    if (pinnedHistorySpanRef.current !== spanBucket) {
      pinnedHistorySpanRef.current = spanBucket
      pinnedHistoryRef.current = freshSelection
      return
    }

    // Keep sticky set to what is currently selectable in-range (capped by selection).
    const inRangeKeys = new Set(
      freshSelection.map((event) => historyEventHeroKey(event)),
    )
    const byKey = new Map<string, HistoryEvent>()
    for (const event of pinnedHistoryRef.current) {
      const key = historyEventHeroKey(event)
      if (event.year >= start && event.year <= end && inRangeKeys.has(key)) {
        byKey.set(key, event)
      }
    }
    for (const event of freshSelection) {
      byKey.set(historyEventHeroKey(event), event)
    }
    pinnedHistoryRef.current = [...byKey.values()].sort((a, b) => a.year - b.year)
  }, [historyVisible, isZooming, spanBucket, freshSelection, start, end])

  const events = useMemo(() => {
    if (!historyVisible) return []
    if (interactionLocked && frozenHistoryEventsRef.current) {
      return frozenHistoryEventsRef.current
    }

    // Selection is already density-capped (sticky-first). Do not re-union unbounded pins.
    const next = freshSelection.filter((event) => event.year >= start && event.year <= end)
    if (interactionLocked) frozenHistoryEventsRef.current = next
    return next
  }, [historyVisible, interactionLocked, freshSelection, start, end])

  const placed = useMemo(() => {
    if (interactionLocked && frozenHistoryPlacementRef.current) {
      const axisY = timelineAxisY(height, width)
      return events
        .filter((event) => event.year >= start && event.year <= end)
        .map((event) => {
          const key = historyEventHeroKey(event)
          const frozen =
            frozenHistoryPlacementRef.current!.get(key) ?? pinnedHistoryPlacementRef.current.get(key)
          const stemHeight = frozen?.stemHeight ?? 68
          return {
            event,
            x: yearX(event.year, start, span, width),
            y: axisY + stemHeight,
            stemHeight,
          }
        })
    }

    const stickyKeys = new Set(
      pinnedHistoryRef.current
        .filter((event) => event.year >= start && event.year <= end)
        .map((event) => historyEventHeroKey(event)),
    )
    const mustKeepKeys = new Set(
      events.map((event) => historyEventHeroKey(event)).filter((key) => stickyKeys.has(key)),
    )
    const next = placeHistoryEvents(events, start, span, width, height, mustKeepKeys)
    const axisY = timelineAxisY(height, width)

    for (const item of next) {
      const key = historyEventHeroKey(item.event)
      // Persist lane offset only — never absolute Y (height/axis can change).
      if (height < 240) continue
      if (!pinnedHistoryPlacementRef.current.has(key)) {
        pinnedHistoryPlacementRef.current.set(key, {
          y: item.stemHeight,
          stemHeight: item.stemHeight,
        })
      }
    }

    const withPinnedLane = next.map((item) => {
      const key = historyEventHeroKey(item.event)
      const pinned = pinnedHistoryPlacementRef.current.get(key)
      const stemHeight =
        !isZooming && pinned?.stemHeight != null ? pinned.stemHeight : item.stemHeight
      return {
        ...item,
        x: yearX(item.event.year, start, span, width),
        stemHeight,
        y: axisY + stemHeight,
      }
    })

    if (interactionLocked) {
      frozenHistoryPlacementRef.current = new Map(
        withPinnedLane.map(({ event, stemHeight }) => [
          historyEventHeroKey(event),
          { y: stemHeight, stemHeight },
        ]),
      )
    }
    return withPinnedLane
  }, [events, start, end, span, width, height, interactionLocked, isZooming, spanBucket])

  registerHistoryPulseTargets(
    useMemo(
      () =>
        placed.map(({ event, x }) => ({
          key: historyEventHeroKey(event),
          year: event.year,
          x: Math.round(x),
        })),
      [placed],
    ),
  )

  if (!historyVisible) return <div id="historyLayer" className="history-layer" style={{ display: 'none' }} />

  const dissolveTransition = prefersReducedMotion
    ? { duration: 0.01 }
    : {
        opacity: {
          duration: isZooming ? 0.55 : 0.45,
          ease: motionEase,
        },
        default: { duration: 0 },
      }

  return (
    <div id="historyLayer" className="history-layer">
      {eventFadeEnabled ? (
        <AnimatePresence mode="sync">
          {placed.map(({ event, x, y, stemHeight }) => {
            const eventKey = historyEventHeroKey(event)
            const isAmbientPulse = pulse.historyKey === eventKey

            return (
              <motion.div
                key={eventKey}
                className={`history-event-anchor${isAmbientPulse ? ' is-ambient-pulse-anchor' : ''}`}
                style={{ left: Math.round(x), top: Math.round(y) }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={dissolveTransition}
                layout={false}
              >
                <HistoryEventButton
                  event={event}
                  stemHeight={stemHeight}
                  isAmbientPulse={isAmbientPulse}
                  onOpen={openHistory}
                />
              </motion.div>
            )
          })}
        </AnimatePresence>
      ) : (
        placed.map(({ event, x, y, stemHeight }) => {
          const eventKey = historyEventHeroKey(event)
          const isAmbientPulse = pulse.historyKey === eventKey

          return (
            <div
              key={eventKey}
              className={`history-event-anchor${isAmbientPulse ? ' is-ambient-pulse-anchor' : ''}`}
              style={{ left: Math.round(x), top: Math.round(y) }}
            >
              <HistoryEventButton
                event={event}
                stemHeight={stemHeight}
                isAmbientPulse={isAmbientPulse}
                onOpen={openHistory}
              />
            </div>
          )
        })
      )}
    </div>
  )
}

function HistoryEventButton({
  event,
  stemHeight,
  isAmbientPulse,
  onOpen,
}: {
  event: HistoryEvent
  stemHeight: number
  isAmbientPulse: boolean
  onOpen: (event: HistoryEvent) => void
}) {
  return (
    <button
      type="button"
      className={`history-event below${isAmbientPulse ? ' is-ambient-pulse' : ''}`}
      title={`${event.year} · ${event.title}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onOpen(event)
      }}
    >
      <span
        className="history-stem"
        style={{ height: Math.max(18, stemHeight - 12), bottom: 12 }}
      />
      <span className="history-label">
        <b>{event.title}</b>
        <small>
          {event.year} · {event.country}
        </small>
      </span>
    </button>
  )
}

function historyLanes(span: number, viewportWidth = 1200): number[] {
  // Offsets below the axis. Keep the nearest lane clear of century year labels (~axis+17).
  if (isNarrowStage(viewportWidth)) {
    if (span > 320) return [68, 128, 188]
    if (span > 150) return [64, 118, 172]
    return [60, 108, 156, 204]
  }
  if (span > 320) return [78, 148, 218]
  if (span > 150) return [78, 138, 198, 258]
  return [74, 128, 182, 236, 290, 344]
}

function placeHistoryEvents(
  events: HistoryEvent[],
  start: number,
  span: number,
  width: number,
  height: number,
  mustKeepKeys: ReadonlySet<string> = new Set(),
): RenderedHistoryEvent[] {
  const lanes = historyLanes(span, width)
  const minGap = minHistoryPixelGap(span, width)
  const gapSteps = isNarrowStage(width)
    ? span > 320
      ? [minGap, minGap - 24, minGap - 48, 72]
      : span > 150
        ? [minGap, minGap - 20, minGap - 40, 64]
        : [minGap, 95, 72, 56]
    : span > 320
      ? [minGap, minGap - 40, minGap - 80, minGap - 110]
      : span > 150
        ? [minGap, minGap - 35, minGap - 70, minGap - 95, 80]
        : [175, 140, 110, 85, 60]

  const placedIds = new Set<string>()
  const result: RenderedHistoryEvent[] = []
  const axisY = timelineAxisY(height, width)

  const tryPlace = (ev: HistoryEvent, _force: boolean): boolean => {
    const key = historyEventHeroKey(ev)
    if (placedIds.has(key)) return true

    const x = yearX(ev.year, start, span, width)
    for (const gap of gapSteps) {
      const last = lanes.map(() => -1e9)
      for (const item of result) {
        const laneIndex = lanes.indexOf(item.stemHeight)
        if (laneIndex >= 0) last[laneIndex] = item.x
      }

      let laneIndex = -1
      for (let i = 0; i < lanes.length; i++) {
        if (x - last[i] > gap) {
          laneIndex = i
          break
        }
      }
      if (laneIndex < 0) continue

      const offset = lanes[laneIndex]
      placedIds.add(key)
      result.push({ event: ev, x, y: axisY + offset, stemHeight: offset })
      return true
    }

    // Never soft-overlap: sticky keep still requires a free lane/gap.
    return false
  }

  // Sticky first so already-visible history markers cannot be dropped when space remains.
  for (const ev of events) {
    if (mustKeepKeys.has(historyEventHeroKey(ev))) tryPlace(ev, true)
  }
  for (const ev of events) {
    if (!mustKeepKeys.has(historyEventHeroKey(ev))) tryPlace(ev, false)
  }

  return result.sort((a, b) => a.event.year - b.event.year)
}
