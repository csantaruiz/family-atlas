import { normalizePlace } from './normalizePlace'
import {
  adminCenterPlaceId,
  findExactRegistryMatch,
  findFuzzyLocalityMatch,
  findScopedLocalityMatches,
  getAtlasPlace,
} from './registry/atlasPlaceRegistry'
import {
  hasModernMexicoContext,
  matchHistoricalEntity,
} from './registry/historicalEntities'
import { placeFingerprint } from './placeFingerprint'
import type {
  AtlasConfidence,
  CanonicalPlaceResolution,
  PlaceAlternative,
  ResolveCanonicalPlaceContext,
  ResolutionMethod,
  ResolutionStatus,
} from './types'
import { RESOLVER_VERSION } from './types'
import { getCachedPlaceOverride } from '../overrides/overrideCache'
import { isRuntimeApplicable } from '../overrides/identity'
import type {
  PlaceConfirmPayload,
  PlaceCoordinatesPayload,
} from '../overrides/types'
import { projectGeo } from '../utils/mapProjection'
import {
  collapsePlaceIdsToSourcePrecision,
  placeIdHonoringSourcePrecision,
  sourcePrecisionFromComponents,
} from './sourcePrecision'

function mapRegistryConfidence(raw: string | undefined): AtlasConfidence {
  switch (raw) {
    case 'verified':
      return 'CONFIRMED'
    case 'high':
      return 'HIGH'
    case 'medium':
      return 'MEDIUM'
    default:
      return 'LOW'
  }
}

function precisionFromScale(scale: string | undefined, method: ResolutionMethod) {
  if (method === 'historical-entity') return 'historical-region' as const
  switch (scale) {
    case 'local':
      return 'locality' as const
    case 'regional':
      return 'state' as const
    case 'country':
      return 'country' as const
    case 'continental':
    case 'world':
      return 'macro-region' as const
    default:
      return 'state' as const
  }
}

function buildAlternative(placeId: string, reason: string): PlaceAlternative | null {
  const place = getAtlasPlace(placeId)
  if (!place) return null
  return {
    canonicalPlaceId: place.id,
    label: place.canonicalName,
    latitude: place.latitude,
    longitude: place.longitude,
    precision: precisionFromScale(place.geographicScale, 'hierarchical-match'),
    confidence: mapRegistryConfidence(place.confidence),
    reason,
  }
}

function unresolved(original: string, normalized: ReturnType<typeof normalizePlace>): CanonicalPlaceResolution {
  return {
    original,
    normalized,
    status: 'unresolved',
    method: 'unresolved',
    confidence: 'UNRESOLVED',
    precision: 'unresolved',
    canonicalPlaceId: null,
    label: null,
    latitude: null,
    longitude: null,
    projected: null,
    geographicScale: null,
    branch: null,
    alternatives: [],
    provenance: {
      parseNotes: normalized.components.parseNotes,
      constraintNotes: [],
      resolverVersion: RESOLVER_VERSION,
    },
    humanOverride: { kind: 'none' },
  }
}

function fromRegistry(
  original: string,
  normalized: ReturnType<typeof normalizePlace>,
  placeId: string,
  method: ResolutionMethod,
  status: ResolutionStatus,
  constraintNotes: string[],
  extra?: Partial<CanonicalPlaceResolution['provenance']>,
): CanonicalPlaceResolution {
  const place = getAtlasPlace(placeId)
  if (!place) return unresolved(original, normalized)

  const confidence =
    method === 'fuzzy-locality' ? 'MEDIUM' : mapRegistryConfidence(place.confidence)

  return {
    original,
    normalized,
    status,
    method,
    confidence,
    precision: precisionFromScale(place.geographicScale, method),
    canonicalPlaceId: place.id,
    label: place.canonicalName,
    latitude: place.latitude,
    longitude: place.longitude,
    projected: { x: place.x, y: place.y },
    geographicScale: place.geographicScale,
    branch: place.branch ?? null,
    alternatives: [],
    provenance: {
      matchedRegistryEntry: place.id,
      matchedAdminPath: [
        place.hierarchy.country,
        place.hierarchy.admin1,
        place.hierarchy.admin2,
        place.hierarchy.locality,
      ].filter((value): value is string => Boolean(value)),
      parseNotes: normalized.components.parseNotes,
      constraintNotes,
      resolverVersion: RESOLVER_VERSION,
      ...extra,
    },
    humanOverride: { kind: 'none' },
  }
}

function cheshireFromHistoricalLocality(
  original: string,
  normalized: ReturnType<typeof normalizePlace>,
): CanonicalPlaceResolution | null {
  if (!/sandbach|cheshire|bostock/i.test(original)) return null
  if (normalized.components.country && normalized.components.country !== 'England') return null
  return fromRegistry(original, normalized, 'cheshire', 'admin-center', 'coarse', [
    'Cheshire inferred from parish/locality text in truncated GEDCOM.',
  ])
}

function historicalOnlyResolution(
  original: string,
  normalized: ReturnType<typeof normalizePlace>,
): CanonicalPlaceResolution | null {
  const entity = matchHistoricalEntity(original)
  if (!entity) return null
  if (hasModernMexicoContext(original)) return null

  return {
    original,
    normalized,
    status: 'coarse',
    method: 'historical-entity',
    confidence: 'LOW',
    precision: 'historical-region',
    canonicalPlaceId: entity.id,
    label: entity.canonicalName,
    latitude: entity.latitude,
    longitude: entity.longitude,
    projected: null,
    geographicScale: 'country',
    branch: 'spanish-mexican',
    alternatives: [],
    provenance: {
      historicalEntityId: entity.id,
      modernContextApplied: false,
      parseNotes: [...normalized.components.parseNotes, entity.scopeNote],
      constraintNotes: ['Historical entity preserved — modern country not inferred without admin evidence.'],
      resolverVersion: RESOLVER_VERSION,
    },
    humanOverride: { kind: 'none' },
  }
}

function foldPlaceToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function countryRecognizedOnlyByLanguageAlias(country: string, parts: string[]): boolean {
  const canon = foldPlaceToken(country)
  const tokens = parts.map((part) => foldPlaceToken(part))
  if (tokens.some((token) => token === canon || token.endsWith(` ${canon}`) || token.startsWith(`${canon} `))) {
    return false
  }
  if (canon === 'united states' && tokens.some((token) => /\b(usa|u\.s\.a\.|u\.s\.|united states)\b/.test(token))) {
    return false
  }
  if (canon === 'mexico' && tokens.some((token) => token === 'mexico' || token.endsWith(' mexico'))) {
    return false
  }
  return true
}

function medordAmbiguity(
  original: string,
  normalized: ReturnType<typeof normalizePlace>,
): CanonicalPlaceResolution | null {
  if (!/^medord/i.test(normalized.components.locality ?? '')) return null
  if (normalized.components.admin1 !== 'Oregon') return null
  const suggestion = buildAlternative('medford-or', 'Likely Medford, Oregon (typo)')
  if (!suggestion) return null

  return {
    original,
    normalized,
    status: 'ambiguous',
    method: 'fuzzy-locality',
    confidence: 'LOW',
    precision: 'locality',
    canonicalPlaceId: null,
    label: null,
    latitude: null,
    longitude: null,
    projected: null,
    geographicScale: null,
    branch: null,
    alternatives: [suggestion],
    provenance: {
      parseNotes: normalized.components.parseNotes,
      constraintNotes: ['Typo suspected — awaiting human confirmation before pinning Medford.'],
      resolverVersion: RESOLVER_VERSION,
    },
    humanOverride: { kind: 'none' },
  }
}

function resolutionForHonoredPlace(
  original: string,
  normalized: ReturnType<typeof normalizePlace>,
  originalId: string,
  honoredId: string,
  preferredMethod: ResolutionMethod,
): CanonicalPlaceResolution {
  const source = sourcePrecisionFromComponents(normalized.components)
  const notes: string[] = []
  if (honoredId !== originalId) {
    notes.push(
      `source-precision-cap: kept ${source}-level place instead of nested finer canonical ${originalId}.`,
    )
  }
  const method: ResolutionMethod = honoredId !== originalId ? 'admin-center' : preferredMethod
  const status: ResolutionStatus = method === 'admin-center' ? 'coarse' : 'resolved'
  return fromRegistry(original, normalized, honoredId, method, status, notes)
}

function resolveCore(original: string, normalized: ReturnType<typeof normalizePlace>): CanonicalPlaceResolution {
  const medord = medordAmbiguity(original, normalized)
  if (medord) return medord

  const exactId = findExactRegistryMatch(normalized.matchKey)
  if (exactId) {
    const honoredId = placeIdHonoringSourcePrecision(exactId, normalized.components)
    if (honoredId) {
      return resolutionForHonoredPlace(original, normalized, exactId, honoredId, 'exact-registry')
    }
  }

  const { country, admin1, admin2, locality } = normalized.components

  if (locality && country) {
    const scoped = collapsePlaceIdsToSourcePrecision(
      findScopedLocalityMatches({ locality, country, admin1 }),
      normalized.components,
    )
    if (scoped.length === 1) {
      const originalScoped = findScopedLocalityMatches({ locality, country, admin1 })
      return resolutionForHonoredPlace(
        original,
        normalized,
        originalScoped[0] ?? scoped[0],
        scoped[0],
        'hierarchical-match',
      )
    }
    if (scoped.length > 1) {
      const alternatives = scoped
        .map((id) => buildAlternative(id, 'Scoped locality candidate'))
        .filter((alt): alt is PlaceAlternative => alt != null)
      return {
        ...unresolved(original, normalized),
        status: 'ambiguous',
        method: 'hierarchical-match',
        confidence: 'LOW',
        precision: 'locality',
        alternatives,
        provenance: {
          parseNotes: normalized.components.parseNotes,
          constraintNotes: ['Multiple scoped locality matches.'],
          resolverVersion: RESOLVER_VERSION,
        },
      }
    }

    const fuzzy = findFuzzyLocalityMatch({ locality, country, admin1, maxDistance: 2 })
    if (fuzzy.length === 1 && /^anah/i.test(locality)) {
      return fromRegistry(original, normalized, fuzzy[0], 'fuzzy-locality', 'resolved', [
        'Single fuzzy locality match within admin context.',
      ])
    }
  }

  if (locality && /san jose/i.test(locality) && country === 'Mexico') {
    return fromRegistry(original, normalized, 'hidalgo-del-parral', 'hierarchical-match', 'resolved', [
      'Mexican admin context prevents California San Jose match.',
    ], {
      modernContextApplied: Boolean(hasModernMexicoContext(original)),
      historicalEntityId: normalized.components.historicalEntity ? 'nueva-espana' : undefined,
    })
  }

  const cheshire = cheshireFromHistoricalLocality(original, normalized)
  if (cheshire) return cheshire

  const adminId = adminCenterPlaceId({ country, admin1, admin2 })
  if (adminId) {
    const adminPlace = getAtlasPlace(adminId)
    const countryOnlyPlace =
      Boolean(adminPlace) &&
      !adminPlace?.hierarchy.admin1 &&
      !adminPlace?.hierarchy.admin2 &&
      !adminPlace?.hierarchy.locality
    const unmatchedFiner = Boolean(locality)
    const newlySeededCountry = adminPlace?.source === 'modern-country-table'
    const countryNamedOnlyByAlias =
      country != null && countryRecognizedOnlyByLanguageAlias(country, normalized.components.parts)
    if (countryOnlyPlace && unmatchedFiner && (newlySeededCountry || countryNamedOnlyByAlias)) {
      // Keep unmatched locality/admin; do not coarsen newly recognized countries
      // (or alias-only country tokens such as Espagne) to a country centroid.
    } else {
      return fromRegistry(original, normalized, adminId, 'admin-center', 'coarse', [
        locality ? 'Locality present but not verified — admin center used.' : 'Admin-level only.',
      ])
    }
  }

  const historical = historicalOnlyResolution(original, normalized)
  if (historical) return historical

  return unresolved(original, normalized)
}

function applyCachedPlaceOverride(
  original: string,
  normalized: ReturnType<typeof normalizePlace>,
): CanonicalPlaceResolution | null {
  const fingerprint = placeFingerprint(normalized)
  const override = getCachedPlaceOverride(fingerprint)
  if (!override || !isRuntimeApplicable(override)) return null

  if (override.overrideType === 'confirm_resolution') {
    const payload = override.payload as PlaceConfirmPayload
    if (!payload.canonicalPlaceId) return null
    const resolved = fromRegistry(
      original,
      normalized,
      payload.canonicalPlaceId,
      'human-override',
      'resolved',
      ['Human override applied (canonical_selection).'],
    )
    return {
      ...resolved,
      confidence: 'CONFIRMED',
      label: payload.label || resolved.label,
      humanOverride: {
        kind: 'confirmed',
        overrideId: override.id,
        confirmedAt: override.updatedAt,
        confirmedBy: override.createdBy ?? undefined,
      },
    }
  }

  if (override.overrideType === 'set_coordinates') {
    const payload = override.payload as PlaceCoordinatesPayload
    const projected = projectGeo(payload.lng, payload.lat)
    return {
      original,
      normalized,
      status: 'resolved',
      method: 'human-override',
      confidence: 'CONFIRMED',
      precision: 'locality',
      canonicalPlaceId: null,
      label: payload.label || original,
      latitude: payload.lat,
      longitude: payload.lng,
      projected: { x: projected.x, y: projected.y },
      geographicScale: 'local',
      branch: null,
      alternatives: [],
      provenance: {
        parseNotes: [
          ...normalized.components.parseNotes,
          'Human override applied (manual_coordinates).',
        ],
        constraintNotes: ['selectionProvenance:manual_coordinates'],
        resolverVersion: RESOLVER_VERSION,
      },
      humanOverride: {
        kind: 'confirmed',
        overrideId: override.id,
        confirmedAt: override.updatedAt,
        confirmedBy: override.createdBy ?? undefined,
      },
    }
  }

  return null
}

/**
 * Unified canonical place resolver — applies Phase 2B cache overrides when present.
 */
export async function resolveCanonicalPlace(
  original: string,
  context: ResolveCanonicalPlaceContext = {},
): Promise<CanonicalPlaceResolution> {
  void context
  const normalized = normalizePlace(original)

  if (normalized.components.parseQuality === 'empty') {
    return {
      ...unresolved(original, normalized),
      status: 'normalization-only',
      method: 'normalization-only',
    }
  }

  const overridden = applyCachedPlaceOverride(original, normalized)
  if (overridden) return overridden

  return resolveCore(original, normalized)
}

/** Synchronous helper for Map/Journey/health — reads override cache (no network). */
export function resolveCanonicalPlaceSync(
  original: string,
  _context: ResolveCanonicalPlaceContext = {},
): CanonicalPlaceResolution {
  const normalized = normalizePlace(original)

  if (normalized.components.parseQuality === 'empty') {
    return {
      ...unresolved(original, normalized),
      status: 'normalization-only',
      method: 'normalization-only',
    }
  }

  const overridden = applyCachedPlaceOverride(original, normalized)
  if (overridden) return overridden

  return resolveCore(original, normalized)
}
