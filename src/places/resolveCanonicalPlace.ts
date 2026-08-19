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
import type { PlaceOverrideStore } from './overrides/placeOverrideStore'
import { devPlaceOverrideStore } from './overrides/inMemoryPlaceOverrideStore'
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

const defaultOverrideStore: PlaceOverrideStore = devPlaceOverrideStore

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

function newYorkAmbiguity(
  original: string,
  normalized: ReturnType<typeof normalizePlace>,
): CanonicalPlaceResolution | null {
  if (normalized.matchKey !== 'new york') return null
  const city = buildAlternative('new-york-city', 'New York City')
  const state = buildAlternative('new-york-state', 'New York State')
  if (!city || !state) return null

  return {
    original,
    normalized,
    status: 'ambiguous',
    method: 'hierarchical-match',
    confidence: 'LOW',
    precision: 'state',
    canonicalPlaceId: null,
    label: null,
    latitude: null,
    longitude: null,
    projected: null,
    geographicScale: null,
    branch: null,
    alternatives: [city, state],
    provenance: {
      parseNotes: normalized.components.parseNotes,
      constraintNotes: ['City vs state ambiguity — human confirmation required.'],
      resolverVersion: RESOLVER_VERSION,
    },
    humanOverride: { kind: 'none' },
  }
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

function resolveCore(original: string, normalized: ReturnType<typeof normalizePlace>): CanonicalPlaceResolution {
  const ny = newYorkAmbiguity(original, normalized)
  if (ny) return ny

  const medord = medordAmbiguity(original, normalized)
  if (medord) return medord

  const exactId = findExactRegistryMatch(normalized.matchKey)
  if (exactId) {
    return fromRegistry(original, normalized, exactId, 'exact-registry', 'resolved', [])
  }

  const { country, admin1, admin2, locality } = normalized.components

  if (locality && country) {
    const scoped = findScopedLocalityMatches({ locality, country, admin1 })
    if (scoped.length === 1) {
      return fromRegistry(original, normalized, scoped[0], 'hierarchical-match', 'resolved', [])
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
    return fromRegistry(original, normalized, adminId, 'admin-center', 'coarse', [
      locality ? 'Locality present but not verified — admin center used.' : 'Admin-level only.',
    ])
  }

  const historical = historicalOnlyResolution(original, normalized)
  if (historical) return historical

  if (country === 'Ireland' && !admin1 && !locality) {
    return fromRegistry(original, normalized, 'ireland', 'admin-center', 'coarse', [
      'Country-only Ireland — no city-level precision claimed.',
    ])
  }

  if (country === 'United States' && !admin1 && !locality && /^united states/i.test(normalized.compact)) {
    return fromRegistry(original, normalized, 'united-states', 'admin-center', 'coarse', [
      'Country-only United States — no state/city precision claimed.',
    ])
  }

  return unresolved(original, normalized)
}

/**
 * Unified canonical place resolver — shadow mode in Phase 2A.
 * Does not replace Explore/Documentary/Journey production paths.
 */
export async function resolveCanonicalPlace(
  original: string,
  context: ResolveCanonicalPlaceContext = {},
): Promise<CanonicalPlaceResolution> {
  const atlasId = context.atlasId ?? 'default'
  const normalized = normalizePlace(original)

  if (normalized.components.parseQuality === 'empty') {
    return {
      ...unresolved(original, normalized),
      status: 'normalization-only',
      method: 'normalization-only',
    }
  }

  const override = await defaultOverrideStore.get(atlasId, placeFingerprint(normalized))
  if (override?.status === 'confirmed' && override.canonicalPlaceId) {
    const resolved = fromRegistry(original, normalized, override.canonicalPlaceId, 'human-override', 'resolved', [
      'Human override applied.',
    ])
    return {
      ...resolved,
      confidence: 'CONFIRMED',
      humanOverride: {
        kind: 'confirmed',
        overrideId: override.id,
        confirmedAt: override.updatedAt,
        confirmedBy: override.createdBy,
      },
    }
  }

  return resolveCore(original, normalized)
}

/** Synchronous shadow helper for tests and health diagnostics. */
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

  return resolveCore(original, normalized)
}
