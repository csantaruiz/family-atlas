/**
 * Customer Atlas Review queue — a strict subset of Health + Unified Places.
 * DEV Review Findings remains the full technical list; this module never
 * surfaces problems Unified already resolved with a confident coherent answer.
 */

import { getFamilyDatabase, getFamilyMarriages } from '../family-data/activeFamily'
import { familyMarriages } from '../data/familyMarriages'
import { runAtlasHealthCheck } from '../atlas-health/healthCheck'
import { collectNameDateFindings, type NameDateFinding } from '../atlas-health/nameDateFindings'
import { parseGedcomDate } from '../gedcom/parseGedcomDate'
import { getCachedPersonDateOverride, getCachedPersonNameOverride } from '../overrides/overrideCache'
import { personDateEntityKey, personNameEntityKey } from '../overrides/identity'
import { suggestCleanedName } from '../overrides/applyPersonNameOverrides'
import { buildPlaceResolutionRecord, collectUniquePlaceStrings } from '../atlas-health/placeResolution'
import type { PlaceComparisonCategory, PlaceResolutionRecord } from '../atlas-health/types'
import {
  diagnosticEntityKey,
  describePlaceContext,
  isPriorityFindingHandled,
  type PriorityFinding,
} from '../atlas-health/dev/reviewFindingsModel'
import { placeEntityKey } from '../overrides/identity'
import { getCachedDiagnostic, getCachedPlaceOverride } from '../overrides/overrideCache'
import {
  getAtlasPlace,
  findScopedLocalityMatches,
  formatCanonicalPlaceLabel,
} from '../places/registry/atlasPlaceRegistry'
import { normalizePlace } from '../places/normalizePlace'
import type { CanonicalPlaceResolution } from '../places/types'

export const CUSTOMER_REVIEW_SOURCE = 'atlas-review'

export const CUSTOMER_REVIEW_CATEGORY = 'ATLAS_REVIEW' as const

export type CustomerReviewKind = 'ambiguous' | 'conflict' | 'gap' | 'unresolved' | 'date' | 'name'

export type CustomerPlaceChoice = {
  canonicalPlaceId: string
  label: string
  latitude: number | null
  longitude: number | null
}

export type CustomerReviewDomain = 'place' | 'date' | 'name'

export type CustomerReviewItem = {
  domain: CustomerReviewDomain
  id: string
  originals: string[]
  primaryOriginal: string
  kind: CustomerReviewKind
  healthCategory: PlaceComparisonCategory | typeof CUSTOMER_REVIEW_CATEGORY
  familyWording: string
  atlasReading: string | null
  whyAsking: string
  personId: string | null
  personName: string | null
  personRole: string | null
  eventYear: number | null
  eventKind: string | null
  recommendedCanonicalPlaceId: string | null
  recommendedLabel: string | null
  alternatives: CustomerPlaceChoice[]
  latitude: number | null
  longitude: number | null
  dateField?: 'birth' | 'death'
  sourceDateRaw?: string | null
  relatedDateRaw?: string | null
  relatedPersonName?: string | null
  relatedPersonId?: string | null
  relatedFact?: 'birth' | 'death'
  relatedLine?: string | null
  dateShape?: DateReviewShape
  dateSides?: DateFactSide[]
  conflictSummary?: string | null
  findingId?: string
  findingCode?: string
  suggestedName?: string | null
  sourceNameRaw?: string | null
}

export type DateReviewShape = 'single' | 'conflict'

export type DateFactSide = {
  personId: string
  personName: string
  field: 'birth' | 'death'
  dateRaw: string
  overrideKey: string
  roleLabel?: string | null
}

const JUNK_PLACE =
  /^(unknown|n\/?a|none|not stated|not located|not located[\s—-].*|unlocated|unavailable)?$/i

const CONFIDENT: ReadonlySet<string> = new Set(['CONFIRMED', 'HIGH'])

export function customerDiagnosticKey(original: string): string {
  return `place:${placeEntityKey(original)}:${CUSTOMER_REVIEW_CATEGORY}`
}

export function isCustomerOriginalHandled(original: string): boolean {
  const placeOverride = getCachedPlaceOverride(placeEntityKey(original))
  if (placeOverride && placeOverride.status === 'active') return true

  const customer = getCachedDiagnostic(customerDiagnosticKey(original))
  if (customer && customer.status === 'active' && isSettledReview(customer.reviewState)) {
    return true
  }

  for (const category of ['GEOGRAPHIC_CONFLICT', 'RESOLUTION_GAP'] as const) {
    const diagnostic = getCachedDiagnostic(diagnosticEntityKey(original, category))
    if (diagnostic && diagnostic.status === 'active' && isSettledReview(diagnostic.reviewState)) {
      return true
    }
  }
  return false
}

function isSettledReview(state: string | null | undefined): boolean {
  return state === 'ignored' || state === 'confirmed' || state === 'corrected'
}

/** Unified already has a confident, coherent answer — do not ask the family. */
export function unifiedAlreadyHandles(record: PlaceResolutionRecord): boolean {
  const unified = record.unified
  const category = record.unifiedComparison.category
  if (category === 'UNIFIED_REGRESSION' || category === 'UNIFIED_UNRESOLVED' || category === 'UNIFIED_AMBIGUOUS_SAFE') {
    return false
  }
  const confidentCorrection =
    category === 'UNIFIED_CORRECTS_LEGACY' || category === 'UNIFIED_AGREES_ACCEPTABLE'
  const placed =
    (unified.status === 'resolved' || unified.status === 'coarse') &&
    Boolean(unified.canonicalPlaceId)
  return confidentCorrection && placed && CONFIDENT.has(unified.confidence)
}

function looksLikePlace(original: string): boolean {
  const trimmed = original.trim()
  if (trimmed.length < 3) return false
  if (JUNK_PLACE.test(trimmed)) return false
  return /[a-zA-Z]/.test(trimmed)
}

function attachedToPerson(original: string): boolean {
  const context = describePlaceContext(original)
  return context.people.length > 0 || context.events.length > 0 || context.marriages.length > 0
}

function displayLabelForPlaceId(id: string | null | undefined, fallback?: string | null): string | null {
  if (!id) return fallback ?? null
  const place = getAtlasPlace(id)
  if (place) return formatCanonicalPlaceLabel(place)
  return fallback ?? null
}

function recommendedFromUnified(unified: CanonicalPlaceResolution): {
  id: string | null
  label: string | null
} {
  if (unified.status === 'resolved' || unified.status === 'coarse') {
    return {
      id: unified.canonicalPlaceId,
      label: displayLabelForPlaceId(unified.canonicalPlaceId, unified.label),
    }
  }
  if (unified.status === 'ambiguous' && unified.alternatives.length === 1) {
    const only = unified.alternatives[0]
    return {
      id: only.canonicalPlaceId,
      label: displayLabelForPlaceId(only.canonicalPlaceId, only.label),
    }
  }
  return { id: null, label: null }
}

export function safePlaceChoices(record: PlaceResolutionRecord): CustomerPlaceChoice[] {
  const recommended = recommendedFromUnified(record.unified).id
  const seen = new Set<string>()
  const choices: CustomerPlaceChoice[] = []

  const add = (id: string | null | undefined) => {
    if (!id || id === recommended || seen.has(id)) return
    const place = getAtlasPlace(id)
    if (!place) return
    seen.add(id)
    choices.push({
      canonicalPlaceId: id,
      label: formatCanonicalPlaceLabel(place),
      latitude: place.latitude ?? null,
      longitude: place.longitude ?? null,
    })
  }

  for (const alt of record.unified.alternatives) {
    add(alt.canonicalPlaceId)
  }

  const parts = normalizePlace(record.original).components
  if (parts.locality && parts.country) {
    for (const id of findScopedLocalityMatches({
      locality: parts.locality,
      country: parts.country,
      admin1: parts.admin1,
    })) {
      add(id)
    }
  }

  return choices
}

export function shouldOfferCustomerReview(record: PlaceResolutionRecord): CustomerReviewKind | null {
  if (!looksLikePlace(record.original)) return null
  if (isCustomerOriginalHandled(record.original)) return null
  if (unifiedAlreadyHandles(record)) return null

  const unified = record.unified
  const legacy = record.comparison.category
  const personLinked = attachedToPerson(record.original)

  if (unified.status === 'ambiguous') {
    return 'ambiguous'
  }

  if (legacy === 'GEOGRAPHIC_CONFLICT') {
    if (
      unified.status === 'unresolved' ||
      unified.status === 'normalization-only' ||
      record.unifiedComparison.category === 'UNIFIED_REGRESSION' ||
      record.unifiedComparison.category === 'UNIFIED_AMBIGUOUS_SAFE' ||
      record.unifiedComparison.category === 'UNIFIED_UNRESOLVED' ||
      unified.confidence === 'LOW' ||
      unified.confidence === 'UNRESOLVED'
    ) {
      return 'conflict'
    }
  }

  if (legacy === 'RESOLUTION_GAP') {
    if (unified.status === 'unresolved' || unified.status === 'normalization-only') {
      if (personLinked) return 'gap'
    }
  }

  if (
    (unified.status === 'unresolved' || unified.status === 'normalization-only') &&
    personLinked
  ) {
    return 'unresolved'
  }

  return null
}

function toReviewItem(record: PlaceResolutionRecord, kind: CustomerReviewKind): CustomerReviewItem {
  const context = describePlaceContext(record.original)
  const person = context.people[0] ?? null
  const event = context.events[0] ?? null
  const recommended = recommendedFromUnified(record.unified)
  const alternatives = safePlaceChoices(record)
  const healthCategory: CustomerReviewItem['healthCategory'] =
    record.comparison.category === 'GEOGRAPHIC_CONFLICT' ||
    record.comparison.category === 'RESOLUTION_GAP'
      ? record.comparison.category
      : CUSTOMER_REVIEW_CATEGORY

  return {
    domain: 'place',
    id: `${kind}::${record.original}`,
    originals: [record.original],
    primaryOriginal: record.original,
    kind,
    healthCategory,
    familyWording: record.original,
    atlasReading: recommended.label,
    whyAsking: '',
    personId: person?.id ?? null,
    personName: person?.name ?? null,
    personRole: person?.role ?? null,
    eventYear: event?.year ?? null,
    eventKind: event?.kind ?? null,
    recommendedCanonicalPlaceId: recommended.id,
    recommendedLabel: recommended.label,
    alternatives,
    latitude: record.unified.latitude ?? (recommended.id ? getAtlasPlace(recommended.id)?.latitude ?? null : null),
    longitude: record.unified.longitude ?? (recommended.id ? getAtlasPlace(recommended.id)?.longitude ?? null : null),
  }
}

export function dateReviewDiagnosticKey(finding: Pick<NameDateFinding, 'personId' | 'fact' | 'code' | 'relatedPersonId'>): string {
  return `date:${finding.code}:${finding.personId}:${finding.fact}:${finding.relatedPersonId ?? 'none'}`
}

function dateFieldOf(finding: NameDateFinding): 'birth' | 'death' {
  return finding.fact === 'death' ? 'death' : 'birth'
}

function relatedDateFieldOf(finding: NameDateFinding): 'birth' | 'death' | null {
  if (finding.relatedFact === 'death') return 'death'
  if (finding.relatedFact === 'birth') return 'birth'
  return null
}

export function isTwoSidedDateConflict(finding: NameDateFinding): boolean {
  if (finding.fact !== 'birth' && finding.fact !== 'death') return false
  const relatedField = relatedDateFieldOf(finding)
  if (!relatedField || !finding.relatedRaw) return false
  return Boolean(finding.relatedPersonId ?? finding.personId)
}

export function isDateFindingReviewed(finding: NameDateFinding): boolean {
  const diagnostic = getCachedDiagnostic(dateReviewDiagnosticKey(finding))
  if (diagnostic && diagnostic.status === 'active' && isSettledReview(diagnostic.reviewState)) {
    return true
  }
  if (isTwoSidedDateConflict(finding)) return false

  const field = dateFieldOf(finding)
  const keys = [personDateEntityKey(finding.personId, field)]
  if (finding.sourcePersonId && finding.sourcePersonId !== finding.personId) {
    keys.push(personDateEntityKey(finding.sourcePersonId, field))
  }
  for (const key of keys) {
    const confirm = getCachedPersonDateOverride(key, 'confirm_date')
    if (confirm && confirm.status === 'active') return true
    const setDate = getCachedPersonDateOverride(key, 'set_date')
    if (setDate && setDate.status === 'active') return true
  }
  return false
}

function givenNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

function possessiveOf(phrase: string): string {
  const trimmed = phrase.trim()
  if (!trimmed) return phrase
  return /s$/i.test(trimmed) ? `${trimmed}’` : `${trimmed}’s`
}

function yearWord(count: number): string {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
  return words[count] ?? String(count)
}

function roleLabelFor(finding: NameDateFinding): string | null {
  const people = getFamilyDatabase().people
  const primary = people.find((row) => row.id === finding.personId)
  const relatedId = finding.relatedPersonId ?? finding.personId
  const related = people.find((row) => row.id === relatedId)
  if (!primary || !related || primary.id === related.id) return null
  const relatedIsParent = (primary.parents ?? []).includes(related.id)
  const primaryIsParent = (related.parents ?? []).includes(primary.id)
  const child = relatedIsParent ? primary : primaryIsParent ? related : null
  const parent = relatedIsParent ? related : primaryIsParent ? primary : null
  if (!child || !parent) return null
  const whose = child.sex === 'F' ? 'her' : child.sex === 'M' ? 'his' : 'their'
  if (related.id === parent.id) {
    const role = parent.sex === 'F' ? 'mother' : parent.sex === 'M' ? 'father' : 'parent'
    return `${whose} ${role}`
  }
  const childRole = child.sex === 'F' ? 'daughter' : child.sex === 'M' ? 'son' : 'child'
  return `${whose} ${childRole}`
}

function conflictSummaryFor(finding: NameDateFinding, sides: DateFactSide[]): string {
  const primary = sides[0]
  const related = sides[1]
  if (finding.code === 'date_child_after_parent_death' && primary && related) {
    const years = yearGap(primary.dateRaw, related.dateRaw)
    const child = possessiveOf(givenNameOf(primary.personName))
    const parent = related.roleLabel ? possessiveOf(related.roleLabel) : possessiveOf(givenNameOf(related.personName))
    if (years != null && years > 0) {
      const span = years === 1 ? 'a year' : `${yearWord(years)} years`
      const hedge = years >= 2 ? 'almost ' : ''
      return `${child} recorded birth is ${hedge}${span} after ${parent} recorded death.`
    }
  }
  if (finding.code === 'date_child_before_parent_birth' && primary && related) {
    const child = possessiveOf(givenNameOf(primary.personName))
    const parent = related.roleLabel ? possessiveOf(related.roleLabel) : possessiveOf(givenNameOf(related.personName))
    return `${child} recorded birth is before ${parent} recorded birth.`
  }
  if (finding.code === 'date_death_before_birth' && primary) {
    return `${possessiveOf(givenNameOf(primary.personName))} recorded death is before the recorded birth.`
  }
  return finding.reason
}

function yearGap(leftRaw: string, rightRaw: string): number | null {
  const left = parseGedcomDate(leftRaw)
  const right = parseGedcomDate(rightRaw)
  if (left.year == null || right.year == null) return null
  return Math.abs(left.year - right.year)
}

function relatedLineFor(finding: NameDateFinding): string | null {
  if (!finding.relatedPersonName || !finding.relatedRaw) return null
  const role = roleLabelFor(finding)
  const verb = finding.relatedFact === 'birth' ? 'born' : 'died'
  if (role) return `${role}, ${finding.relatedPersonName}, ${verb} ${finding.relatedRaw}`
  return `${finding.relatedPersonName} ${finding.relatedFact === 'birth' ? 'born' : 'died'} ${finding.relatedRaw}`
}

function toDateReviewItem(finding: NameDateFinding): CustomerReviewItem {
  const field = dateFieldOf(finding)
  const sourceRaw = field === 'death' ? finding.rawValues[1] ?? finding.rawValues[0] : finding.rawValues[0]
  const relatedField = relatedDateFieldOf(finding)
  const relatedPersonId = finding.relatedPersonId ?? (relatedField ? finding.personId : null)
  const conflict = isTwoSidedDateConflict(finding)
  const primarySide: DateFactSide = {
    personId: finding.personId,
    personName: finding.personName,
    field,
    dateRaw: sourceRaw ?? '',
    overrideKey: personDateEntityKey(finding.personId, field),
  }
  const relatedSide: DateFactSide | null =
    conflict && relatedField && relatedPersonId && finding.relatedRaw
      ? {
          personId: relatedPersonId,
          personName: finding.relatedPersonName ?? finding.personName,
          field: relatedField,
          dateRaw: finding.relatedRaw,
          overrideKey: personDateEntityKey(relatedPersonId, relatedField),
          roleLabel: roleLabelFor(finding),
        }
      : null
  const dateSides = relatedSide ? [primarySide, relatedSide] : [primarySide]
  return {
    domain: 'date',
    id: `date::${finding.id}`,
    originals: finding.rawValues,
    primaryOriginal: sourceRaw ?? '',
    kind: 'date',
    healthCategory: CUSTOMER_REVIEW_CATEGORY,
    familyWording: sourceRaw ?? '',
    atlasReading: finding.relatedRaw ?? null,
    whyAsking: finding.reason,
    personId: finding.personId,
    personName: finding.personName,
    personRole: field === 'death' ? 'Death' : 'Birth',
    eventYear: null,
    eventKind: field,
    recommendedCanonicalPlaceId: null,
    recommendedLabel: null,
    alternatives: [],
    latitude: null,
    longitude: null,
    dateField: field,
    sourceDateRaw: sourceRaw ?? null,
    relatedDateRaw: finding.relatedRaw ?? null,
    relatedPersonName: finding.relatedPersonName ?? null,
    relatedPersonId: relatedPersonId,
    relatedFact: relatedField ?? undefined,
    relatedLine: relatedLineFor(finding),
    dateShape: relatedSide ? 'conflict' : 'single',
    dateSides,
    conflictSummary: relatedSide ? conflictSummaryFor(finding, dateSides) : null,
    findingId: finding.id,
    findingCode: finding.code,
  }
}

export function nameReviewDiagnosticKey(finding: Pick<NameDateFinding, 'personId' | 'code'>): string {
  return `name:${finding.code}:${finding.personId}`
}

export function isNameFindingReviewed(finding: NameDateFinding): boolean {
  const keys = [personNameEntityKey(finding.personId)]
  if (finding.sourcePersonId && finding.sourcePersonId !== finding.personId) {
    keys.push(personNameEntityKey(finding.sourcePersonId))
  }
  for (const key of keys) {
    const confirm = getCachedPersonNameOverride(key, 'confirm_name')
    if (confirm && confirm.status === 'active') return true
    const setName = getCachedPersonNameOverride(key, 'set_name')
    if (setName && setName.status === 'active') return true
  }
  return false
}

function toNameReviewItem(finding: NameDateFinding): CustomerReviewItem {
  const sourceRaw = finding.rawValues[1] || finding.rawValues[0] || finding.personName
  const suggested = suggestCleanedName(sourceRaw)
  return {
    domain: 'name',
    id: `name::${finding.id}`,
    originals: finding.rawValues,
    primaryOriginal: sourceRaw,
    kind: 'name',
    healthCategory: CUSTOMER_REVIEW_CATEGORY,
    familyWording: sourceRaw,
    atlasReading: suggested && suggested !== sourceRaw ? suggested : null,
    whyAsking: finding.reason,
    personId: finding.personId,
    personName: finding.personName,
    personRole: 'Name',
    eventYear: null,
    eventKind: 'name',
    recommendedCanonicalPlaceId: null,
    recommendedLabel: null,
    alternatives: [],
    latitude: null,
    longitude: null,
    findingId: finding.id,
    findingCode: finding.code,
    suggestedName: suggested && suggested !== sourceRaw ? suggested : null,
    sourceNameRaw: sourceRaw,
  }
}

function selectNameReviews(): CustomerReviewItem[] {
  const findings = collectNameDateFindings({
    people: getFamilyDatabase().people,
    marriages: getFamilyMarriages(),
  })
  return findings
    .filter(
      (finding) =>
        finding.domain === 'name' &&
        finding.customerCandidate &&
        finding.severity === 'impossible' &&
        finding.confidence === 'high' &&
        finding.code === 'name_import_garbage',
    )
    .filter((finding) => !isNameFindingReviewed(finding))
    .map(toNameReviewItem)
}

function selectDateReviews(): CustomerReviewItem[] {
  const findings = collectNameDateFindings({
    people: getFamilyDatabase().people,
    marriages: getFamilyMarriages(),
  })
  return findings
    .filter(
      (finding) =>
        finding.domain === 'date' &&
        finding.customerCandidate &&
        finding.severity === 'impossible' &&
        finding.confidence === 'high' &&
        (finding.fact === 'birth' || finding.fact === 'death'),
    )
    .filter((finding) => !isDateFindingReviewed(finding))
    .map(toDateReviewItem)
}

function groupItems(items: CustomerReviewItem[]): CustomerReviewItem[] {
  const groups = new Map<string, CustomerReviewItem>()
  for (const item of items) {
    const key = item.recommendedCanonicalPlaceId
      ? `canon:${item.recommendedCanonicalPlaceId}`
      : `raw:${item.primaryOriginal}`
    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, item)
      continue
    }
    if (!existing.originals.includes(item.primaryOriginal)) {
      existing.originals.push(item.primaryOriginal)
    }
  }
  return [...groups.values()]
}

/**
 * Customer-facing queue. Geographic conflicts Unified already corrected
 * (e.g. Gloucester City, NJ vs England) are omitted.
 */
export function selectCustomerReviews(): CustomerReviewItem[] {
  const originals = collectUniquePlaceStrings({
    people: getFamilyDatabase().people,
    marriagePlaces: familyMarriages.map((marriage) => marriage.place),
  })

  const picked: CustomerReviewItem[] = []
  for (const original of originals) {
    const record = buildPlaceResolutionRecord(original)
    const kind = shouldOfferCustomerReview(record)
    if (!kind) continue
    picked.push(toReviewItem(record, kind))
  }

  const grouped = groupItems(picked)
  grouped.sort((a, b) => {
    const rank = (kind: CustomerReviewKind) =>
      kind === 'ambiguous' ? 0 : kind === 'conflict' ? 1 : kind === 'gap' ? 2 : kind === 'date' ? 4 : kind === 'name' ? 5 : 3
    return rank(a.kind) - rank(b.kind)
  })
  return [...grouped, ...selectDateReviews(), ...selectNameReviews()]
}

/** Count used by the header chip — 0 means render nothing. */
export function customerReviewCount(): number {
  return selectCustomerReviews().length
}

/** Keep DEV queue helper available for tests that compare the two lists. */
export function debugPriorityStillIncludes(original: string): boolean {
  const report = runAtlasHealthCheck()
  const finding: PriorityFinding | undefined = report.priorityPlaces.find(
    (row) => row.original === original,
  )
  if (!finding) return false
  return !isPriorityFindingHandled(finding)
}
