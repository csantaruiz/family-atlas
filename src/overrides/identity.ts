import { normalizePlace } from '../places/normalizePlace'
import { placeFingerprint } from '../places/placeFingerprint'
import { resolveCanonicalPlaceSync } from '../places/resolveCanonicalPlace'
import { canonicalEventId } from '../utils/canonicalEvent'
import type { FamilyEvent } from '../types'
import type { AtlasOverrideRecord, OverrideMatchConfidence, OverrideStatus, PersonDateField } from './types'

/** Durable place source signature at override time (for reimport safety). */
export function placeSourceSignature(original: string, autoCanonicalPlaceId?: string | null): string {
  const normalized = normalizePlace(original)
  const fp = placeFingerprint(normalized)
  const auto = autoCanonicalPlaceId ?? resolveCanonicalPlaceSync(original).canonicalPlaceId ?? 'none'
  return `place|fp:${fp}|compact:${normalized.compact}|auto:${auto}`
}

export function placeEntityKey(original: string): string {
  return placeFingerprint(normalizePlace(original))
}

/**
 * Richer event fingerprint than canonicalEventId — used for reimport signature checks.
 * Kind + person + year + place matchKey + provenance tag.
 */
export function eventFingerprint(
  event: FamilyEvent,
  provenance: string = 'unknown',
): string {
  const place =
    event.kind === 'death'
      ? event.person.deathPlace || event.detail || ''
      : event.kind === 'birth'
        ? event.person.birthPlace || event.detail || ''
        : event.detail || event.person.birthPlace || ''
  const matchKey = normalizePlace(place).matchKey || 'unknown'
  return `${event.person.id}|${event.kind}|${event.year}|${matchKey}|${provenance}`
}

export function eventEntityKey(event: FamilyEvent): string {
  return canonicalEventId(event)
}

export function personDateEntityKey(personId: string, field: PersonDateField): string {
  return `${personId}:${field}`
}

export function personDateSourceSignature(field: PersonDateField, originalRaw: string): string {
  return `person|${field}|${originalRaw.trim()}`
}

export function personNameEntityKey(personId: string): string {
  return `${personId}:name`
}

export function personNameSourceSignature(originalRaw: string): string {
  return `person|name|${originalRaw.trim()}`
}

export function parsePersonNameEntityKey(entityKey: string): { personId: string } | null {
  if (!entityKey.endsWith(':name')) return null
  const personId = entityKey.slice(0, -':name'.length)
  return personId ? { personId } : null
}

export function parsePersonDateEntityKey(
  entityKey: string,
): { personId: string; field: PersonDateField } | null {
  const separator = entityKey.lastIndexOf(':')
  if (separator <= 0) return null
  const field = entityKey.slice(separator + 1)
  if (field !== 'birth' && field !== 'death') return null
  return { personId: entityKey.slice(0, separator), field }
}

export type RebindCandidate = {
  entityKey: string
  sourceSignature: string
}

export type RebindResult = {
  overrideId: string
  nextStatus: OverrideStatus
  matchConfidence: OverrideMatchConfidence
  reason: string
}

/**
 * Reimport rebinding rules:
 * - exact key + matching source signature → apply (exact)
 * - exact key but material signature change → needs_review (never silent apply)
 * - no key match → orphaned
 */
export function rebindOverride(
  override: Pick<AtlasOverrideRecord, 'id' | 'entityKey' | 'sourceSignature' | 'status'>,
  candidates: RebindCandidate[],
): RebindResult {
  const matches = candidates.filter((c) => c.entityKey === override.entityKey)
  if (matches.length === 0) {
    return {
      overrideId: override.id,
      nextStatus: 'orphaned',
      matchConfidence: 'ambiguous',
      reason: 'No matching entity key after reimport.',
    }
  }

  if (matches.length > 1) {
    return {
      overrideId: override.id,
      nextStatus: 'needs_review',
      matchConfidence: 'ambiguous',
      reason: 'Multiple entities share the override key after reimport.',
    }
  }

  const candidate = matches[0]
  const stored = override.sourceSignature
  if (stored && candidate.sourceSignature && stored !== candidate.sourceSignature) {
    return {
      overrideId: override.id,
      nextStatus: 'needs_review',
      matchConfidence: 'exact',
      reason:
        'Stable key still matches, but underlying source signature changed — human review required.',
    }
  }

  return {
    overrideId: override.id,
    nextStatus: 'active',
    matchConfidence: 'exact',
    reason: 'Stable key and source signature match.',
  }
}

/** Whether an active override may affect runtime resolution. */
export function isRuntimeApplicable(override: AtlasOverrideRecord): boolean {
  if (override.status !== 'active') return false
  if (override.matchConfidence === 'ambiguous') return false
  return true
}
