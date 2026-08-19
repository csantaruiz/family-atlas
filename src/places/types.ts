import type { GeographicScale } from '../documentary-engine/types/choreography'
import type { DocumentaryBranch } from '../documentary-engine/types/manifest'

/** Shared confidence vocabulary — mirrored from atlas-health for decoupling. */
export type AtlasConfidence =
  | 'CONFIRMED'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'UNRESOLVED'

/** Verbatim GEDCOM PLAC — never modified by the resolver. */
export type OriginalPlaceString = string

export type ResolutionStatus =
  | 'normalization-only'
  | 'resolved'
  | 'coarse'
  | 'ambiguous'
  | 'unresolved'

export type ResolutionMethod =
  | 'human-override'
  | 'exact-registry'
  | 'hierarchical-match'
  | 'admin-center'
  | 'fuzzy-locality'
  | 'historical-entity'
  | 'normalization-only'
  | 'unresolved'

export type GeographicPrecision =
  | 'locality'
  | 'county'
  | 'state'
  | 'country'
  | 'macro-region'
  | 'historical-region'
  | 'unresolved'

export type ParseQuality = 'clean' | 'partial' | 'malformed' | 'empty'

export type ParsedPlaceComponents = {
  parts: string[]
  locality: string | null
  admin2: string | null
  admin1: string | null
  country: string | null
  /** Historical geographic entity when present (e.g. Nueva España). */
  historicalEntity: string | null
  parseQuality: ParseQuality
  parseNotes: string[]
}

export type NormalizedPlace = {
  compact: string
  matchKey: string
  parseForm: string
  components: ParsedPlaceComponents
}

export type PlaceAlternative = {
  canonicalPlaceId: string
  label: string
  latitude: number
  longitude: number
  precision: GeographicPrecision
  confidence: AtlasConfidence
  reason: string
}

export type HumanOverrideState =
  | { kind: 'none' }
  | { kind: 'confirmed'; overrideId: string; confirmedAt: string; confirmedBy?: string }
  | { kind: 'rejected-auto'; overrideId: string; reason?: string }

export type CanonicalPlaceResolution = {
  original: OriginalPlaceString
  normalized: NormalizedPlace

  status: ResolutionStatus
  method: ResolutionMethod
  confidence: AtlasConfidence
  precision: GeographicPrecision

  canonicalPlaceId: string | null
  label: string | null
  latitude: number | null
  longitude: number | null
  projected: { x: number; y: number } | null

  geographicScale: GeographicScale | null
  branch: DocumentaryBranch | null

  alternatives: PlaceAlternative[]

  provenance: {
    matchedRegistryEntry?: string
    matchedAdminPath?: string[]
    historicalEntityId?: string
    modernContextApplied?: boolean
    parseNotes: string[]
    constraintNotes: string[]
    resolverVersion: string
  }

  humanOverride: HumanOverrideState
}

/** Shadow migration snapshot — legacy pipelines unchanged in production. */
export type UnifiedShadowSnapshot = {
  resolution: CanonicalPlaceResolution
  legacyComparison: UnifiedLegacyComparison
}

export type UnifiedLegacyComparisonCategory =
  | 'UNIFIED_AGREES_ACCEPTABLE'
  | 'UNIFIED_CORRECTS_LEGACY'
  | 'UNIFIED_COARSER_THAN_ACCEPTABLE'
  | 'UNIFIED_AMBIGUOUS_SAFE'
  | 'UNIFIED_REGRESSION'
  | 'UNIFIED_UNRESOLVED'
  | 'NO_ACCEPTABLE_BASELINE'

export type UnifiedLegacyComparison = {
  category: UnifiedLegacyComparisonCategory
  summary: string
  severity: number
  acceptableBaseline: 'explore' | 'documentary' | 'both' | 'none'
}

export type ResolveCanonicalPlaceContext = {
  atlasId?: string
  resolverVersion?: string
}

export const RESOLVER_VERSION = '2a.1'

/** Persisted human correction — production storage via Atlas database/backend. */
export type PlaceOverrideRecord = {
  id: string
  atlasId: string
  fingerprint: string
  originalExamples: string[]
  canonicalPlaceId?: string
  customCoordinates?: { lat: number; lng: number }
  precisionCap: GeographicPrecision
  label?: string
  status: 'confirmed' | 'rejected-auto'
  notes?: string
  createdAt: string
  updatedAt: string
  createdBy?: string
}
