import { useMemo } from 'react'
import { historyEvents } from '../data'
import { useTimeline } from '../context/TimelineContext'
import { MIN_VIEWPORT_EVENTS } from '../utils/semanticZoom'
import { activeCountriesAt } from '../utils/placeUtils'
import { yearX } from '../utils/timelineMath'
import type { HistoryEvent, Person, RenderedHistoryEvent } from '../types'

type WorldHistoryLayerProps = {
  start: number
  end: number
  width: number
  height: number
  enabled: boolean
}

function matchesCountryFilter(ev: HistoryEvent, birthPeople: Person[]): boolean {
  const active = activeCountriesAt(ev.year, birthPeople)
  if (ev.country === 'Global') return true
  if (ev.country === 'Britain') {
    return ['Britain', 'England', 'Scotland', 'Ireland'].some((c) => active.has(c))
  }
  return active.has(ev.country)
}

function rankHistoryEvents(events: HistoryEvent[], center: number): HistoryEvent[] {
  return [...events].sort(
    (a, b) =>
      b.importance - a.importance || Math.abs(a.year - center) - Math.abs(b.year - center),
  )
}

function selectHistoricalEvents(
  start: number,
  end: number,
  span: number,
  center: number,
  birthPeople: Person[],
): HistoryEvent[] {
  const inViewport = historyEvents.filter((ev) => ev.year >= start && ev.year <= end)
  if (!inViewport.length) return []

  const maxCount =
    span > 320 ? 8 : span > 150 ? 10 : span > 55 ? 14 : 18
  const targetCount = Math.max(MIN_VIEWPORT_EVENTS, maxCount)
  const baseImportance = span > 320 ? 3 : span > 150 ? 2 : 1

  let selected: HistoryEvent[] = []
  for (let importance = baseImportance; importance >= 1; importance--) {
    const pool = inViewport.filter((ev) => ev.importance >= importance && matchesCountryFilter(ev, birthPeople))
    selected = rankHistoryEvents(pool, center).slice(0, targetCount)
    if (selected.length >= MIN_VIEWPORT_EVENTS) break
  }

  if (selected.length < MIN_VIEWPORT_EVENTS) {
    const relaxed = inViewport.filter((ev) => matchesCountryFilter(ev, birthPeople))
    selected = rankHistoryEvents(relaxed, center).slice(0, targetCount)
  }

  if (selected.length < MIN_VIEWPORT_EVENTS) {
    selected = rankHistoryEvents(inViewport, center).slice(0, targetCount)
  }

  return selected.sort((a, b) => a.year - b.year)
}

export function WorldHistoryLayer({ start, end, width, height, enabled }: WorldHistoryLayerProps) {
  const { span, center, birthPeople, openHistory, timelineFilters } = useTimeline()

  const events = useMemo(() => {
    if (!enabled || !timelineFilters.historicalEvents) return []
    return selectHistoricalEvents(start, end, span, center, birthPeople)
  }, [enabled, timelineFilters.historicalEvents, span, start, end, center, birthPeople])

  const placed = useMemo(
    () => placeHistoryEvents(events, start, span, width, height),
    [events, start, span, width, height],
  )

  if (!enabled) return <div id="historyLayer" className="history-layer" style={{ display: 'none' }} />

  return (
    <div id="historyLayer" className="history-layer">
      {placed.map(({ event, x, y, stemHeight }) => (
        <button
          key={`${event.year}-${event.title}`}
          type="button"
          className="history-event below"
          style={{ left: Math.round(x), top: Math.round(y) }}
          title={`${event.year} · ${event.title}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            openHistory(event)
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
      ))}
    </div>
  )
}

function placeHistoryEvents(
  events: HistoryEvent[],
  start: number,
  span: number,
  width: number,
  height: number,
): RenderedHistoryEvent[] {
  const lanes = [70, 122, 174, 226]
  const minimum = Math.min(events.length, MIN_VIEWPORT_EVENTS)
  const gapSteps = span < 80 ? [210, 170, 130, 95, 70] : [175, 140, 110, 85, 60]
  const placedIds = new Set<string>()
  const result: RenderedHistoryEvent[] = []

  for (const gap of gapSteps) {
    const last = lanes.map(() => -1e9)
    for (const item of result) {
      const laneIndex = lanes.indexOf(item.stemHeight)
      if (laneIndex >= 0) last[laneIndex] = item.x
    }

    for (const ev of events) {
      const key = `${ev.year}-${ev.title}`
      if (placedIds.has(key)) continue

      const x = yearX(ev.year, start, span, width)
      let laneIndex = -1
      for (let i = 0; i < lanes.length; i++) {
        if (x - last[i] > gap) {
          laneIndex = i
          break
        }
      }
      if (laneIndex < 0) continue

      last[laneIndex] = x
      placedIds.add(key)
      const offset = lanes[laneIndex]
      result.push({ event: ev, x, y: height * 0.54 + offset, stemHeight: offset })
    }

    if (result.length >= minimum) break
  }

  return result.sort((a, b) => a.event.year - b.event.year)
}
