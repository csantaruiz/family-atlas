import type { FamilyEvent } from '../types'
import { canonicalEventId } from './canonicalEvent'
import { isNearGeneration, generationDistance } from './familyPriority'
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
let interactionFrozenKey: string | null = null

export function resetLandmarkStability(): void {
  state = { key: '', ids: [], placements: new Map() }
  interactionFrozenKey = null
}

function spanStabilityBucket(span: number): number {
  if (span <= 14) return Math.round(span * 10) / 10
  if (span <= 40) return Math.round(span / 4) * 4
  if (span <= 120) return Math.round(span / 8) * 8
  return Math.round(span / 15) * 15
}

export function landmarkStabilityKey(mode: SemanticZoomMode, span: number): string {
  return `${mode}:${spanStabilityBucket(span)}`
}

export function freezeLandmarkStability(mode: SemanticZoomMode, span: number): void {
  interactionFrozenKey = landmarkStabilityKey(mode, span)
}

export function unfreezeLandmarkStability(): void {
  interactionFrozenKey = null
}

function resolveStabilityKey(mode: SemanticZoomMode, span: number): string {
  return interactionFrozenKey ?? landmarkStabilityKey(mode, span)
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

  /** Sticky markers already on-screen get first claim on slots (within the limit). */
  const addSticky = (event: FamilyEvent | undefined): boolean => {
    if (!event || merged.length >= limit) return false
    const id = canonicalEventId(event)
    if (mergedIds.has(id)) return false
    merged.push(event)
    mergedIds.add(id)
    return true
  }

  const addFresh = (event: FamilyEvent | undefined): boolean => {
    if (!event || merged.length >= limit) return false
    const id = canonicalEventId(event)
    if (mergedIds.has(id)) return false
    merged.push(event)
    mergedIds.add(id)
    return true
  }

  // Phase 1 — keep markers from the last frame that are still in view (capped).
  for (const id of previousIds) {
    addSticky(visibleById.get(id))
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

    const zoneFresh = fresh
      .filter(
        (event) =>
          zoneForYear(event.year, start, end) === zone && !mergedIds.has(canonicalEventId(event)),
      )
      .sort((a, b) => {
        const ga = generationDistance(a.person)
        const gb = generationDistance(b.person)
        if (ga !== gb) return ga - gb
        const nearA = isNearGeneration(a.person) ? 0 : 1
        const nearB = isNearGeneration(b.person) ? 0 : 1
        if (nearA !== nearB) return nearA - nearB
        return a.year - b.year
      })

    for (let i = 0; i < need && merged.length < limit; i++) {
      addFresh(zoneFresh[i])
    }
  }

  // Phase 2b — if a nearer-generation event was crowded out, swap in for a farther one.
  const missingNear = fresh
    .filter(
      (event) =>
        isNearGeneration(event.person, 1) && !mergedIds.has(canonicalEventId(event)),
    )
    .sort((a, b) => generationDistance(a.person) - generationDistance(b.person))

  for (const candidate of missingNear) {
    if (merged.length < limit) {
      addFresh(candidate)
      continue
    }
    // Replace the farthest-generation merged event in the same temporal zone when possible.
    const zone = zoneForYear(candidate.year, start, end)
    let victimIndex = -1
    let victimGen = -1
    for (let i = 0; i < merged.length; i++) {
      const event = merged[i]
      if (isNearGeneration(event.person, 1)) continue
      const g = generationDistance(event.person)
      if (zoneForYear(event.year, start, end) === zone && g > victimGen) {
        victimGen = g
        victimIndex = i
      }
    }
    if (victimIndex < 0) {
      for (let i = 0; i < merged.length; i++) {
        const event = merged[i]
        const g = generationDistance(event.person)
        if (isNearGeneration(event.person, 1)) continue
        if (g > victimGen) {
          victimGen = g
          victimIndex = i
        }
      }
    }
    if (victimIndex < 0) continue
    const victim = merged[victimIndex]
    if (generationDistance(victim.person) <= generationDistance(candidate.person)) continue
    mergedIds.delete(canonicalEventId(victim))
    merged[victimIndex] = candidate
    mergedIds.add(canonicalEventId(candidate))
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
    addFresh(next)
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
 * Near-generation (root/parents) from `fresh` are never displaced by
 * more distant relatives when the viewport still has room.
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

  const key = resolveStabilityKey(mode, span)

  if (interactionFrozenKey) {
    const visibleById = new Map(visible.map((event) => [canonicalEventId(event), event]))
    const kept = (state.key === key ? state.ids : [])
      .map((id) => visibleById.get(id))
      .filter((event): event is FamilyEvent => event != null)

    if (kept.length > 0) {
      state.ids = kept.map((event) => canonicalEventId(event))
      prunePlacements(new Set(state.ids))
      return sortEvents(kept)
    }
  }

  let balanced = balanceLandmarkSelection(visible, fresh, state.key === key ? state.ids : [], start, end, limit)
  balanced = enforceNearGenerationSeats(balanced, fresh, start, end, limit)

  if (state.key !== key) ensureStabilityKey(key)

  state.ids = balanced.map((event) => canonicalEventId(event))
  prunePlacements(new Set(state.ids))

  return balanced
}

/** Guarantee gen ≤ 1 landmarks from the fresh selection survive stabilization. */
function enforceNearGenerationSeats(
  merged: FamilyEvent[],
  fresh: FamilyEvent[],
  start: number,
  end: number,
  limit: number,
): FamilyEvent[] {
  const result = [...merged]
  const ids = new Set(result.map((event) => canonicalEventId(event)))
  const missing = fresh
    .filter(
      (event) =>
        event.year >= start &&
        event.year <= end &&
        isNearGeneration(event.person, 1) &&
        !ids.has(canonicalEventId(event)),
    )
    .sort((a, b) => generationDistance(a.person) - generationDistance(b.person))

  for (const candidate of missing) {
    if (result.length < limit) {
      result.push(candidate)
      ids.add(canonicalEventId(candidate))
      continue
    }

    let victimIndex = -1
    let victimGen = -1
    for (let i = 0; i < result.length; i++) {
      const event = result[i]
      if (isNearGeneration(event.person, 1)) continue
      const g = generationDistance(event.person)
      if (g > victimGen) {
        victimGen = g
        victimIndex = i
      }
    }
    if (victimIndex < 0) continue
    if (victimGen <= generationDistance(candidate.person)) continue
    ids.delete(canonicalEventId(result[victimIndex]))
    result[victimIndex] = candidate
    ids.add(canonicalEventId(candidate))
  }

  return sortEvents(result)
}
