import type { FamilyEvent } from '../types'
import { canonicalEventId } from './canonicalEvent'
import type { LabelAlignment } from './labelMeasure'
import type { SemanticZoomMode } from './semanticZoom'

export type StableLandmarkPlacement = {
  lane: number
  alignment: LabelAlignment
  nudge: number
  compact: boolean
}

type TemporalZone = 'left' | 'center' | 'right'

type StabilityState = {
  key: string
  ids: string[]
  placements: Map<string, StableLandmarkPlacement>
}

const ZONE_LEFT_MAX = 0.33
const ZONE_CENTER_MAX = 0.66
const ZONES: TemporalZone[] = ['left', 'center', 'right']

let state: StabilityState = { key: '', ids: [], placements: new Map() }

export function resetLandmarkStability(): void {
  state = { key: '', ids: [], placements: new Map() }
}

export function landmarkStabilityKey(mode: SemanticZoomMode, span: number): string {
  return `${mode}:${span.toFixed(3)}`
}

function ensureStabilityKey(key: string): void {
  if (state.key === key) return
  state = { key, ids: [], placements: new Map() }
}

function prunePlacements(activeIds: Set<string>): void {
  for (const id of state.placements.keys()) {
    if (!activeIds.has(id)) state.placements.delete(id)
  }
}

function zoneForYear(year: number, start: number, end: number): TemporalZone {
  const p = (year - start) / Math.max(1, end - start)
  if (p < ZONE_LEFT_MAX) return 'left'
  if (p < ZONE_CENTER_MAX) return 'center'
  return 'right'
}

function activeZones(events: FamilyEvent[], start: number, end: number): TemporalZone[] {
  return ZONES.filter((zone) => events.some((event) => zoneForYear(event.year, start, end) === zone))
}

function countInZone(events: FamilyEvent[], zone: TemporalZone, start: number, end: number): number {
  return events.filter((event) => zoneForYear(event.year, start, end) === zone).length
}

function zoneBudgets(limit: number, zones: TemporalZone[]): Map<TemporalZone, number> {
  const budgets = new Map<TemporalZone, number>()
  if (!zones.length || limit <= 0) return budgets

  let remaining = limit
  if (limit >= zones.length) {
    for (const zone of zones) {
      budgets.set(zone, 1)
      remaining--
    }
  }

  let index = 0
  while (remaining > 0) {
    const zone = zones[index % zones.length]
    budgets.set(zone, (budgets.get(zone) ?? 0) + 1)
    remaining--
    index++
  }

  return budgets
}

function sortEvents(events: FamilyEvent[]): FamilyEvent[] {
  return [...events].sort(
    (a, b) => a.year - b.year || canonicalEventId(a).localeCompare(canonicalEventId(b)),
  )
}

function balanceLandmarkSelection(
  visible: FamilyEvent[],
  fresh: FamilyEvent[],
  previousIds: string[],
  start: number,
  end: number,
  limit: number,
): FamilyEvent[] {
  if (!fresh.length && previousIds.length === 0) return []

  const visibleById = new Map(visible.map((event) => [canonicalEventId(event), event]))
  const merged: FamilyEvent[] = []
  const mergedIds = new Set<string>()

  const addEvent = (event: FamilyEvent | undefined): boolean => {
    if (!event || merged.length >= limit) return false
    const id = canonicalEventId(event)
    if (mergedIds.has(id)) return false
    merged.push(event)
    mergedIds.add(id)
    return true
  }

  // Phase 1 — keep every marker from the last frame that is still in view.
  for (const id of previousIds) {
    addEvent(visibleById.get(id))
  }

  if (merged.length >= limit) {
    return sortEvents(merged)
  }

  const zones = activeZones(visible, start, end)
  const zoneList = zones.length ? zones : ZONES
  const budgets = zoneBudgets(limit, zoneList)

  // Phase 2 — use remaining slots to balance left / center / right coverage.
  for (const zone of zoneList) {
    const target = budgets.get(zone) ?? 0
    const have = countInZone(merged, zone, start, end)
    const need = Math.max(0, target - have)
    if (need <= 0) continue

    const zoneFresh = fresh.filter(
      (event) =>
        zoneForYear(event.year, start, end) === zone && !mergedIds.has(canonicalEventId(event)),
    )

    for (let i = 0; i < need && merged.length < limit; i++) {
      addEvent(zoneFresh[i])
    }
  }

  // Phase 3 — fill open slots, prioritising underrepresented zones.
  while (merged.length < limit) {
    const targetZones = [...zoneList].sort(
      (a, b) => countInZone(merged, a, start, end) - countInZone(merged, b, start, end),
    )

    let next: FamilyEvent | undefined
    for (const zone of targetZones) {
      next = fresh.find(
        (event) =>
          !mergedIds.has(canonicalEventId(event)) && zoneForYear(event.year, start, end) === zone,
      )
      if (next) break
    }
    next ??= fresh.find((event) => !mergedIds.has(canonicalEventId(event)))
    if (!next) break
    addEvent(next)
  }

  if (merged.length === 0) {
    return sortEvents(fresh.slice(0, limit))
  }

  return sortEvents(merged)
}

export function getStableLandmarkPlacement(
  key: string,
  eventId: string,
): StableLandmarkPlacement | undefined {
  if (state.key !== key) return undefined
  return state.placements.get(eventId)
}

export function rememberStableLandmarkPlacement(
  key: string,
  eventId: string,
  placement: StableLandmarkPlacement,
): void {
  ensureStabilityKey(key)
  state.placements.set(eventId, placement)
}

/**
 * Keep landmark markers stable while panning, with fair coverage across
 * the left, center, and right of the visible range.
 *
 * Persistence: markers from the previous frame stay while still in view.
 * Balance: any open slots are filled with zone-aware fresh picks.
 */
export function stabilizeLandmarkSelection(
  visible: FamilyEvent[],
  fresh: FamilyEvent[],
  start: number,
  end: number,
  span: number,
  mode: SemanticZoomMode,
  limit: number,
): FamilyEvent[] {
  if (mode === 'detail' || limit <= 0) return fresh

  const key = landmarkStabilityKey(mode, span)
  const balanced = balanceLandmarkSelection(visible, fresh, state.key === key ? state.ids : [], start, end, limit)

  if (state.key !== key) ensureStabilityKey(key)

  state.ids = balanced.map((event) => canonicalEventId(event))
  prunePlacements(new Set(state.ids))

  return balanced
}
