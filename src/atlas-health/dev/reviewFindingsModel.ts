/**
 * DEV-only Review Findings helpers — presentation + queue filtering only.
 * Persistence uses existing Phase 2B place / diagnostic overrides.
 */

import { getFamilyDatabase } from '../../family-data/activeFamily'
import { familyMarriages } from '../../data/familyMarriages'
import { buildFamilyEvents } from '../../data/buildFamilyEvents'
import { canonicalEventId, dedupeFamilyEvents } from '../../utils/canonicalEvent'
import { placeEntityKey } from '../../overrides/identity'
import {
  getCachedDiagnostic,
  getCachedPlaceOverride,
} from '../../overrides/overrideCache'
import { resolveCanonicalPlaceSync } from '../../places/resolveCanonicalPlace'
import type { AtlasHealthReport, PlaceComparisonCategory } from '../types'

export type ReviewSurface = 'Timeline' | 'Map' | 'Journey' | 'Documentary'

export type PriorityFinding = AtlasHealthReport['priorityPlaces'][number]

/** Stable id for a review-queue row (exact GEDCOM string + category). */
export function reviewFindingKey(finding: PriorityFinding): string {
  return `${finding.category}::${finding.original}`
}

export type ReviewFindingContext = {
  people: Array<{ id: string; name: string; role: string }>
  events: Array<{ id: string; year: number; kind: string; personName: string; title: string }>
  marriages: Array<{ year: number; summary: string }>
}

export type PlainFindingCopy = {
  whatMayBeWrong: string
  recommendation: string
  whyFlagged: string
  surfaces: ReviewSurface[]
  canConfirm: boolean
  confirmDisabledReason: string | null
  recommendedCanonicalPlaceId: string | null
  recommendedLabel: string | null
}

export function diagnosticEntityKey(
  original: string,
  category: PlaceComparisonCategory,
): string {
  return `place:${placeEntityKey(original)}:${category}`
}

/** True when Confirm or Ignore already persisted for this finding. */
export function isPriorityFindingHandled(finding: PriorityFinding): boolean {
  const placeOverride = getCachedPlaceOverride(placeEntityKey(finding.original))
  if (placeOverride && placeOverride.status === 'active') return true

  const diagnostic = getCachedDiagnostic(diagnosticEntityKey(finding.original, finding.category))
  if (
    diagnostic &&
    diagnostic.status === 'active' &&
    (diagnostic.reviewState === 'ignored' ||
      diagnostic.reviewState === 'confirmed' ||
      diagnostic.reviewState === 'corrected')
  ) {
    return true
  }
  return false
}

/**
 * Priority review queue: geographic conflicts and resolution gaps only,
 * excluding findings already confirmed or ignored in the override cache.
 */
export function buildReviewQueue(report: AtlasHealthReport): PriorityFinding[] {
  return report.priorityPlaces.filter((finding) => !isPriorityFindingHandled(finding))
}

export function describePlaceContext(original: string): ReviewFindingContext {
  const people = getFamilyDatabase().people
    .filter((person) => {
      const places = [person.birthPlace, person.deathPlace, ...(person.places ?? [])].filter(
        Boolean,
      ) as string[]
      return places.includes(original)
    })
    .map((person) => {
      let role = 'place on record'
      if (person.birthPlace === original) role = 'birth place'
      else if (person.deathPlace === original) role = 'death place'
      return { id: person.id, name: person.name, role }
    })

  const events = dedupeFamilyEvents(buildFamilyEvents(getFamilyDatabase().people))
    .filter((event) => {
      const raw =
        event.kind === 'death'
          ? event.person.deathPlace || event.detail
          : event.kind === 'birth'
            ? event.person.birthPlace || event.detail
            : event.detail || event.person.birthPlace || event.person.deathPlace || ''
      return raw === original || event.detail === original
    })
    .slice(0, 8)
    .map((event) => ({
      id: canonicalEventId(event),
      year: event.year,
      kind: event.kind,
      personName: event.person.name,
      title: event.title,
    }))

  const marriages = familyMarriages
    .filter((marriage) => marriage.place === original)
    .map((marriage) => ({
      year: marriage.year,
      summary: `Marriage ${marriage.year} (${marriage.husbandId} × ${marriage.wifeId})`,
    }))

  return { people, events, marriages }
}

export function buildPlainFindingCopy(finding: PriorityFinding): PlainFindingCopy {
  const automated = resolveCanonicalPlaceSync(finding.original)
  const recommendedCanonicalPlaceId =
    automated.status === 'resolved' || automated.status === 'coarse'
      ? automated.canonicalPlaceId
      : null
  const recommendedLabel =
    automated.status === 'resolved' || automated.status === 'coarse'
      ? automated.label
      : null

  const whatMayBeWrong =
    finding.category === 'GEOGRAPHIC_CONFLICT'
      ? 'Different Atlas experiences disagree on the country or region for this place.'
      : 'One Atlas experience resolved this place and another did not.'

  const recommendation = recommendedLabel
    ? `Treat this as ${recommendedLabel}${
        recommendedCanonicalPlaceId ? ` (${recommendedCanonicalPlaceId})` : ''
      }.`
    : 'No clear city/region recommendation yet — Skip, Ignore, or inspect technical details.'

  const canConfirm = Boolean(recommendedCanonicalPlaceId)
  const confirmDisabledReason = canConfirm
    ? null
    : 'Confirm needs a recommended place id from Unified resolution.'

  // Honest surface list for current Phase 2B wiring (place Confirm).
  const surfaces: ReviewSurface[] =
    finding.category === 'GEOGRAPHIC_CONFLICT' || finding.category === 'RESOLUTION_GAP'
      ? ['Journey', 'Map', 'Timeline', 'Documentary']
      : ['Journey', 'Map']

  return {
    whatMayBeWrong,
    recommendation,
    whyFlagged: finding.summary,
    surfaces,
    canConfirm,
    confirmDisabledReason,
    recommendedCanonicalPlaceId,
    recommendedLabel,
  }
}

/** Short surface note: Confirm affects Journey/unified Map; Documentary/legacy Explore not yet. */
export function surfaceImpactNote(surfaces: ReviewSurface[]): string {
  const bits: string[] = []
  if (surfaces.includes('Journey')) bits.push('Journey')
  if (surfaces.includes('Map')) bits.push('Map (when unified places is on)')
  if (surfaces.includes('Timeline')) bits.push('Timeline (place labels on journeys)')
  if (surfaces.includes('Documentary')) {
    bits.push('Documentary (not yet override-aware — listed for awareness)')
  }
  return bits.join(' · ')
}
