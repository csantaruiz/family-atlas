import { useMemo } from 'react'
import { historyEvents } from '../data'
import { useTimeline } from '../context/TimelineContext'
import { activeCountriesAt } from '../utils/placeUtils'
import { yearX } from '../utils/timelineMath'
import type { HistoryEvent, RenderedHistoryEvent } from '../types'

type WorldHistoryLayerProps = {
  start: number
  end: number
  width: number
  height: number
  enabled: boolean
}

export function WorldHistoryLayer({ start, end, width, height, enabled }: WorldHistoryLayerProps) {
  const { span, center, birthPeople, openHistory, timelineFilters } = useTimeline()

  const events = useMemo(() => {
    if (!enabled || !timelineFilters.historicalEvents) return []
    const minImportance = span > 320 ? 3 : span > 150 ? 2 : 1
    let filtered = historyEvents.filter(
      (ev) => ev.year >= start && ev.year <= end && ev.importance >= minImportance,
    )
    filtered = filtered.filter((ev) => {
      const active = activeCountriesAt(ev.year, birthPeople)
      if (ev.country === 'Global') return true
      if (ev.country === 'Britain')
        return ['Britain', 'England', 'Scotland', 'Ireland'].some((c) => active.has(c))
      return active.has(ev.country)
    })
    const max = span > 320 ? 5 : span > 150 ? 8 : span > 55 ? 12 : 18
    if (filtered.length > max) {
      filtered = filtered
        .sort(
          (a, b) =>
            b.importance - a.importance || Math.abs(a.year - center) - Math.abs(b.year - center),
        )
        .slice(0, max)
        .sort((a, b) => a.year - b.year)
    }
    return filtered
  }, [enabled, timelineFilters.historicalEvents, span, start, end, center, birthPeople])

  const placed = useMemo(() => placeHistoryEvents(events, start, span, width, height), [events, start, span, width, height])

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
  const lanes = [70, 122, 174]
  const last = lanes.map(() => -1e9)
  const result: RenderedHistoryEvent[] = []

  events.forEach((ev) => {
    const x = yearX(ev.year, start, span, width)
    let laneIndex = -1
    const gap = span < 80 ? 210 : 175
    for (let i = 0; i < lanes.length; i++) {
      if (x - last[i] > gap) {
        laneIndex = i
        break
      }
    }
    if (laneIndex < 0) return
    last[laneIndex] = x
    const offset = lanes[laneIndex]
    const y = height * 0.54 + offset
    result.push({ event: ev, x, y, stemHeight: offset })
  })

  return result
}
