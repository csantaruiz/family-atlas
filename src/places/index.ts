export type {
  CanonicalPlaceResolution,
  GeographicPrecision,
  HumanOverrideState,
  NormalizedPlace,
  ParsedPlaceComponents,
  PlaceAlternative,
  PlaceOverrideRecord,
  ResolutionMethod,
  ResolutionStatus,
  ResolveCanonicalPlaceContext,
  UnifiedLegacyComparison,
  UnifiedLegacyComparisonCategory,
  UnifiedShadowSnapshot,
} from './types'
export { RESOLVER_VERSION } from './types'

export { normalizePlace, normalizeMatchKey } from './normalizePlace'
export { parsePlaceComponents } from './parsePlaceComponents'
export { placeFingerprint } from './placeFingerprint'
export { resolveCanonicalPlace, resolveCanonicalPlaceSync } from './resolveCanonicalPlace'

export { getAtlasPlace, findExactRegistryMatch, allAtlasPlaceIds } from './registry/atlasPlaceRegistry'
export type { AtlasPlaceEntry } from './registry/atlasPlaceRegistry'

export type { PlaceOverrideStore } from './overrides/placeOverrideStore'
export { InMemoryPlaceOverrideStore, devPlaceOverrideStore } from './overrides/inMemoryPlaceOverrideStore'

export {
  classifyUnifiedLegacyComparison,
  unifiedMacroGeography,
  geographyAcceptableBaseline,
} from './unifiedLegacyComparison'

export { isUnifiedPlacesEnabled } from './featureFlag'
export { mapCoordinateFromUnified } from './adapters/exploreMapCoordinate'
