import type { FamilyEvent } from '../types'
import { eventEntityKey, eventFingerprint, isRuntimeApplicable } from './identity'
import { getCachedEventOverrides } from './overrideCache'
import type {
  AtlasOverrideRecord,
  EventCorrectPlacePayload,
  EventCorrectYearPayload,
  EventForceIncludePayload,
} from './types'

/**
 * Event truth/eligibility overrides.
 *
 * force_include = eligible for display consideration only.
 * It does NOT bypass clustering, semantic zoom, density limits, or layout collision.
 */
export type EventOverrideEffect = {
  eventId: string
  suppressed: boolean
  forceIncludeEligible: boolean
  confirmedInferred: boolean
  correctedYear: number | null
  correctedPlace: string | null
  overrides: AtlasOverrideRecord[]
}

export function resolveAtlasEvent(
  event: FamilyEvent,
  provenance: string = 'unknown',
): EventOverrideEffect {
  const eventId = eventEntityKey(event)
  const rows = getCachedEventOverrides(eventId).filter(isRuntimeApplicable)
  const expectedFp = eventFingerprint(event, provenance)

  let suppressed = false
  let forceIncludeEligible = false
  let confirmedInferred = false
  let correctedYear: number | null = null
  let correctedPlace: string | null = null
  const applied: AtlasOverrideRecord[] = []

  for (const row of rows) {
    const payloadFp =
      typeof (row.payload as { eventFingerprint?: string }).eventFingerprint === 'string'
        ? (row.payload as { eventFingerprint: string }).eventFingerprint
        : null
    // Signature drift on same entity key → treat as not applicable (needs_review path).
    if (payloadFp && payloadFp !== expectedFp && row.sourceSignature && row.sourceSignature !== expectedFp) {
      continue
    }

    applied.push(row)
    if (row.overrideType === 'suppress') suppressed = true
    if (row.overrideType === 'force_include') {
      forceIncludeEligible = true
      // eligibilityOnly is documented on payload; layout pipelines must still apply budgets.
      void (row.payload as EventForceIncludePayload).eligibilityOnly
    }
    if (row.overrideType === 'confirm_inferred') confirmedInferred = true
    if (row.overrideType === 'correct_year') {
      correctedYear = (row.payload as EventCorrectYearPayload).year
    }
    if (row.overrideType === 'correct_place') {
      correctedPlace = (row.payload as EventCorrectPlacePayload).placeString
    }
  }

  // suppress wins over force_include if both somehow active
  if (suppressed) forceIncludeEligible = false

  return {
    eventId,
    suppressed,
    forceIncludeEligible,
    confirmedInferred,
    correctedYear,
    correctedPlace,
    overrides: applied,
  }
}

/**
 * Filter events for eligibility before landmark/layout selection.
 * force_include only restores eligibility — caller must still run clustering/zoom/density.
 */
export function applyEventEligibilityOverrides(
  events: FamilyEvent[],
  provenanceFor: (event: FamilyEvent) => string = () => 'unknown',
): FamilyEvent[] {
  return events
    .map((event) => {
      const effect = resolveAtlasEvent(event, provenanceFor(event))
      if (effect.suppressed) return null
      if (effect.correctedYear != null || effect.correctedPlace) {
        return {
          ...event,
          year: effect.correctedYear ?? event.year,
          detail: effect.correctedPlace ?? event.detail,
        }
      }
      return event
    })
    .filter((event): event is FamilyEvent => event != null)
}
