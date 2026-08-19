import { diagnoseExplorePlace } from '../data/placeCoordinates'
import {
  diagnoseGedcomPlaceResolution,
  normalizeGedcomPlace,
} from '../documentary-engine/core/gedcomMigrationDirector'
import { getCanonicalPlace } from '../documentary-engine/data/canonicalPlaceRegistry'
import type { PlaceConfidence } from '../documentary-engine/data/canonicalPlaceRegistry'
import { classifyUnifiedLegacyComparison } from '../places/unifiedLegacyComparison'
import { resolveCanonicalPlaceSync } from '../places/resolveCanonicalPlace'
import {
  classifyPlaceComparison,
  inferDocumentaryPrecision,
  inferExplorePrecision,
} from './placeComparison'
import type {
  AtlasConfidence,
  PipelinePlaceResolution,
  PlaceResolutionRecord,
  ResolutionPrecision,
} from './types'

function mapDocumentaryConfidence(raw: PlaceConfidence | null | undefined): AtlasConfidence {
  switch (raw) {
    case 'verified':
      return 'CONFIRMED'
    case 'high':
      return 'HIGH'
    case 'medium':
      return 'MEDIUM'
    case 'unresolved':
      return 'UNRESOLVED'
    default:
      return 'UNRESOLVED'
  }
}

function mapExploreConfidence(
  method: ReturnType<typeof diagnoseExplorePlace>['method'],
  resolved: boolean,
): AtlasConfidence {
  if (!resolved || method === 'unresolved' || method === 'empty') return 'UNRESOLVED'
  if (method === 'exact-override') return 'HIGH'
  if (method === 'pattern') return 'MEDIUM'
  if (method === 'region-fallback') return 'LOW'
  return 'UNRESOLVED'
}

function explorePipeline(original: string, precision: ResolutionPrecision): PipelinePlaceResolution {
  const diag = diagnoseExplorePlace(original)
  const notes: string[] = []
  if (diag.method === 'pattern') {
    notes.push('Matched via explore pattern heuristics (order-sensitive).')
  }
  if (diag.method === 'region-fallback') {
    notes.push('Fell back to coarse country/region center via placeRegion().')
  }
  if (diag.method === 'unresolved') {
    notes.push('No explore override, pattern, or region match.')
  }

  return {
    pipeline: 'explore',
    resolved: diag.coordinate.resolved,
    method: diag.method,
    confidence: mapExploreConfidence(diag.method, diag.coordinate.resolved),
    precision,
    label: diag.coordinate.resolved
      ? diag.coordinate.displayRegion || diag.coordinate.region || original
      : null,
    canonicalId: null,
    latitude: diag.latitude,
    longitude: diag.longitude,
    projectedX: diag.coordinate.resolved ? diag.coordinate.x : null,
    projectedY: diag.coordinate.resolved ? diag.coordinate.y : null,
    region: diag.coordinate.region || null,
    displayRegion: diag.coordinate.displayRegion ?? null,
    documentaryConfidenceRaw: null,
    resolutionMethodRaw: diag.method,
    notes,
  }
}

function documentaryPipeline(original: string, precision: ResolutionPrecision): PipelinePlaceResolution {
  const diag = diagnoseGedcomPlaceResolution(original)
  const place = diag.canonicalId ? getCanonicalPlace(diag.canonicalId) : null
  const notes: string[] = []
  if (diag.method === 'pattern-fallback') {
    notes.push('Matched via documentary patternFallbackPlaceId().')
  }
  if (diag.method === 'substring-alias') {
    notes.push('Matched via longest substring alias (≥5 chars).')
  }
  if (!diag.canonicalId) {
    notes.push('No documentary canonical place id.')
  }

  return {
    pipeline: 'documentary',
    resolved: Boolean(place),
    method: diag.method,
    confidence: mapDocumentaryConfidence(place?.confidence),
    precision,
    label: place?.canonicalName ?? null,
    canonicalId: diag.canonicalId,
    latitude: place?.latitude ?? null,
    longitude: place?.longitude ?? null,
    projectedX: place?.x ?? null,
    projectedY: place?.y ?? null,
    region: place?.region ?? place?.country ?? null,
    displayRegion: place?.canonicalName ?? null,
    documentaryConfidenceRaw: place?.confidence ?? null,
    resolutionMethodRaw: place?.resolutionMethod ?? diag.method,
    notes,
  }
}

/** Build a PlaceResolutionRecord by observing both pipelines — no unification. */
export function buildPlaceResolutionRecord(original: string): PlaceResolutionRecord {
  const exploreDraft = explorePipeline(original, 'unresolved')
  const documentaryDraft = documentaryPipeline(original, 'unresolved')
  const explorePrecision = inferExplorePrecision(exploreDraft, original)
  const documentaryPrecision = inferDocumentaryPrecision(documentaryDraft)
  const explore = explorePipeline(original, explorePrecision)
  const documentary = documentaryPipeline(original, documentaryPrecision)
  const comparison = classifyPlaceComparison(
    explore,
    documentary,
    explorePrecision,
    documentaryPrecision,
  )

  const unified = resolveCanonicalPlaceSync(original)
  const unifiedComparison = classifyUnifiedLegacyComparison({
    original,
    unified,
    explore,
    documentary,
    legacyComparison: comparison,
  })

  return {
    original,
    normalized: normalizeGedcomPlace(original),
    explore,
    documentary,
    comparison,
    humanConfirmed: false,
    unified,
    unifiedComparison,
  }
}

function addRawPlace(set: Set<string>, value: string | undefined | null): void {
  if (value == null || value.length === 0) return
  set.add(value)
}

export function collectUniquePlaceStrings(input: {
  people: Array<{
    birthPlace?: string
    deathPlace?: string
    places?: string[]
  }>
  marriagePlaces?: string[]
  extra?: string[]
}): string[] {
  const set = new Set<string>()
  for (const person of input.people) {
    addRawPlace(set, person.birthPlace)
    addRawPlace(set, person.deathPlace)
    for (const place of person.places ?? []) {
      addRawPlace(set, place)
    }
  }
  for (const place of input.marriagePlaces ?? []) {
    addRawPlace(set, place)
  }
  for (const place of input.extra ?? []) {
    addRawPlace(set, place)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}
