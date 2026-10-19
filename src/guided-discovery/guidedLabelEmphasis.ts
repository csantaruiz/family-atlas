import type { FamilyEvent } from '../types'

/** Screen-space label footprint for one placed Timeline family event. */
export type GuidedLabelCandidate = {
  id: string
  personId: string
  spouseId?: string
  kind: FamilyEvent['kind']
  year: number
  importance: number
  left: number
  right: number
  top: number
  bottom: number
}

export type GuidedLabelSpec = {
  /** People the chapter is about — always considered first. */
  focusPersonIds: readonly string[]
  /** Chapter-relevant records (e.g. births and marriages in an era). */
  emphasis?: {
    years?: { start: number; end: number }
    kinds?: readonly FamilyEvent['kind'][]
  } | null
  maxLabels: number
}

const PAD_X = 12
const PAD_Y = 6

function overlaps(a: GuidedLabelCandidate, b: GuidedLabelCandidate): boolean {
  return (
    a.left - PAD_X < b.right &&
    b.left - PAD_X < a.right &&
    a.top - PAD_Y < b.bottom &&
    b.top - PAD_Y < a.bottom
  )
}

function tier(candidate: GuidedLabelCandidate, spec: GuidedLabelSpec): number {
  const focus = spec.focusPersonIds
  if (focus.includes(candidate.personId) || (candidate.spouseId && focus.includes(candidate.spouseId))) {
    return 0
  }
  const emphasis = spec.emphasis
  if (hasEmphasis(spec)) {
    const inYears =
      !emphasis?.years ||
      (candidate.year >= emphasis.years.start && candidate.year <= emphasis.years.end)
    const inKinds = !emphasis?.kinds || emphasis.kinds.includes(candidate.kind)
    if (inYears && inKinds) return 1
    if (inYears) return 2
    return 3
  }
  return 2
}

function hasEmphasis(spec: GuidedLabelSpec): boolean {
  return Boolean(spec.emphasis && (spec.emphasis.years || spec.emphasis.kinds))
}

/** When a chapter names what it is about, other records only fill a little space. */
const MAX_SECONDARY_WITH_EMPHASIS = 2

/**
 * Pick which labels stay readable while a guided chapter is on screen.
 * Markers are never removed — callers only quiet the label copy of events
 * that are not returned. Deterministic: tier, importance, year, then id.
 */
export function selectGuidedLabels(
  candidates: readonly GuidedLabelCandidate[],
  spec: GuidedLabelSpec,
): Set<string> {
  const ranked = candidates
    .map((candidate) => ({ candidate, tier: tier(candidate, spec) }))
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        b.candidate.importance - a.candidate.importance ||
        a.candidate.year - b.candidate.year ||
        a.candidate.id.localeCompare(b.candidate.id),
    )

  const emphasised = hasEmphasis(spec)
  const kept: GuidedLabelCandidate[] = []
  const people = new Set<string>()
  let secondary = 0
  for (const { candidate, tier: rank } of ranked) {
    if (kept.length >= spec.maxLabels) break
    if (emphasised && rank >= 2 && secondary >= MAX_SECONDARY_WITH_EMPHASIS) continue
    // One label per person keeps the scene from repeating the same name.
    if (people.has(candidate.personId)) continue
    if (kept.some((other) => overlaps(candidate, other))) continue
    kept.push(candidate)
    people.add(candidate.personId)
    if (emphasised && rank >= 2) secondary += 1
  }
  return new Set(kept.map((candidate) => candidate.id))
}

export function guidedLabelBudget(viewportWidth: number): number {
  if (viewportWidth >= 1600) return 6
  if (viewportWidth >= 1280) return 5
  return 4
}
