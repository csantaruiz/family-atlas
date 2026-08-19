import { getCanonicalPlace } from '../documentary-engine/data/canonicalPlaceRegistry'
import type {
  AtlasConfidence,
  PipelinePlaceResolution,
  PlaceComparisonCategory,
  PlaceComparisonResult,
  ResolutionPrecision,
} from './types'

const PRECISION_RANK: Record<ResolutionPrecision, number> = {
  'exact/city': 0,
  'state/region': 1,
  country: 2,
  'approximate-region': 3,
  unresolved: 4,
}

export const COMPARISON_SEVERITY: Record<PlaceComparisonCategory, number> = {
  GEOGRAPHIC_CONFLICT: 0,
  RESOLUTION_GAP: 1,
  PRECISION_MISMATCH: 2,
  CONFIDENCE_MISMATCH: 3,
  AGREEMENT: 4,
}

/** Infer effective resolution precision for Explore (observation only). */
export function inferExplorePrecision(
  resolution: PipelinePlaceResolution,
  original: string,
): ResolutionPrecision {
  if (!resolution.resolved || resolution.method === 'empty' || resolution.method === 'unresolved') {
    return 'unresolved'
  }
  if (resolution.method === 'exact-override') return 'exact/city'
  if (resolution.method === 'region-fallback') return 'country'
  if (resolution.method === 'pattern') {
    const label = `${resolution.displayRegion ?? ''} ${resolution.region ?? ''}`.toLowerCase()
    const source = original.toLowerCase()
    if (
      /\bel paso\b|\bgloucester city\b|\bbollington\b|\bgawsworth\b|\bojinaga\b|\bcarretas\b/.test(
        source,
      )
    ) {
      return 'state/region'
    }
    if (/britain|ireland|california|southwest|eastern united states|mexico/.test(label)) {
      return 'approximate-region'
    }
    return 'state/region'
  }
  return 'unresolved'
}

/** Infer effective resolution precision for Documentary (observation only). */
export function inferDocumentaryPrecision(resolution: PipelinePlaceResolution): ResolutionPrecision {
  if (!resolution.resolved || !resolution.canonicalId) return 'unresolved'
  const place = getCanonicalPlace(resolution.canonicalId)
  if (!place) return 'unresolved'
  switch (place.geographicScale) {
    case 'local':
      return 'exact/city'
    case 'regional':
      return 'state/region'
    case 'country':
      return 'country'
    case 'continental':
    case 'world':
      return 'approximate-region'
    default:
      return 'state/region'
  }
}

function macroGeography(resolution: PipelinePlaceResolution): 'europe' | 'mexico' | 'us' | 'other' | null {
  const text = [
    resolution.region,
    resolution.displayRegion,
    resolution.label,
    resolution.canonicalId,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (!text) return null
  if (/england|britain|scotland|ireland|cheshire|gawsworth|united kingdom|europe|spain/.test(text)) {
    return 'europe'
  }
  if (/mexico|chihuahua|ojinaga|coahuila|durango|zacatecas/.test(text)) return 'mexico'
  if (
    /united states|california|texas|jersey|pennsylvania|florida|new-jersey|el-paso|el paso|southwest|eastern us|arizona|new mexico|colorado/.test(
      text,
    )
  ) {
    return 'us'
  }
  return 'other'
}

function coordinatesMateriallyDisagree(
  explore: PipelinePlaceResolution,
  documentary: PipelinePlaceResolution,
): boolean {
  if (
    explore.latitude == null ||
    explore.longitude == null ||
    documentary.latitude == null ||
    documentary.longitude == null
  ) {
    return false
  }
  const dLat = Math.abs(explore.latitude - documentary.latitude)
  const dLon = Math.abs(explore.longitude - documentary.longitude)
  return dLat > 8 || dLon > 8
}

/** True when both resolved placements refer to compatible geography. */
export function geographyCompatible(
  explore: PipelinePlaceResolution,
  documentary: PipelinePlaceResolution,
): boolean {
  if (!explore.resolved || !documentary.resolved) return false

  const exploreMacro = macroGeography(explore)
  const docMacro = macroGeography(documentary)

  if (exploreMacro && docMacro && exploreMacro !== 'other' && docMacro !== 'other') {
    if (exploreMacro !== docMacro) return false
  }

  if (coordinatesMateriallyDisagree(explore, documentary)) return false

  const er = (explore.region || explore.displayRegion || explore.label || '').toLowerCase()
  const dr = (documentary.region || documentary.displayRegion || documentary.label || '').toLowerCase()
  if (!er || !dr) return true

  const exploreEngland = /england|britain|scotland|ireland|united kingdom/.test(er)
  const exploreMexico = /mexico|chihuahua/.test(er)
  const exploreUs = /united states|california|texas|jersey|pennsylvania|southwest|eastern/.test(er)
  const docEngland = /england|britain|scotland|ireland|united kingdom|cheshire|gawsworth/.test(dr)
  const docMexico = /mexico|chihuahua|ojinaga/.test(dr)
  const docUs =
    /united states|california|texas|jersey|pennsylvania|el-paso|el paso|new-jersey|florida/.test(dr)

  if (exploreEngland && (docMexico || docUs)) return false
  if (exploreMexico && (docEngland || docUs) && !docMexico) return false
  if (exploreUs && docEngland) return false
  if (exploreUs && docMexico && !/southwest|el paso|texas|arizona|new mexico/.test(er)) return false

  return true
}

function precisionMateriallyDiffers(a: ResolutionPrecision, b: ResolutionPrecision): boolean {
  return PRECISION_RANK[a] !== PRECISION_RANK[b]
}

function confidenceEquivalent(a: AtlasConfidence, b: AtlasConfidence): boolean {
  return a === b
}

/** Classify an Explore vs Documentary observation pair (does not alter resolution). */
export function classifyPlaceComparison(
  explore: PipelinePlaceResolution,
  documentary: PipelinePlaceResolution,
  explorePrecision: ResolutionPrecision,
  documentaryPrecision: ResolutionPrecision,
): PlaceComparisonResult {
  if (!explore.resolved && !documentary.resolved) {
    return {
      category: 'AGREEMENT',
      summary: 'Both pipelines unresolved.',
      explorePrecision,
      documentaryPrecision,
      severity: COMPARISON_SEVERITY.AGREEMENT,
    }
  }

  if (explore.resolved !== documentary.resolved) {
    const side = explore.resolved ? 'Explore' : 'Documentary'
    const resolved = explore.resolved ? explore : documentary
    const unresolvedSide = explore.resolved ? 'Documentary' : 'Explore'
    return {
      category: 'RESOLUTION_GAP',
      summary: `${side} resolved (${resolved.method} → ${resolved.label ?? 'unknown'}); ${unresolvedSide} unresolved.`,
      explorePrecision,
      documentaryPrecision,
      severity: COMPARISON_SEVERITY.RESOLUTION_GAP,
    }
  }

  if (!geographyCompatible(explore, documentary)) {
    return {
      category: 'GEOGRAPHIC_CONFLICT',
      summary: `Explore “${explore.label}” vs documentary “${documentary.label}” are geographically incompatible.`,
      explorePrecision,
      documentaryPrecision,
      severity: COMPARISON_SEVERITY.GEOGRAPHIC_CONFLICT,
    }
  }

  if (precisionMateriallyDiffers(explorePrecision, documentaryPrecision)) {
    return {
      category: 'PRECISION_MISMATCH',
      summary: `Compatible geography but different specificity: explore ${explorePrecision} (${explore.label}) vs documentary ${documentaryPrecision} (${documentary.label}).`,
      explorePrecision,
      documentaryPrecision,
      severity: COMPARISON_SEVERITY.PRECISION_MISMATCH,
    }
  }

  if (!confidenceEquivalent(explore.confidence, documentary.confidence)) {
    return {
      category: 'CONFIDENCE_MISMATCH',
      summary: `Equivalent geography and precision; confidence differs (explore ${explore.confidence} vs documentary ${documentary.confidence}).`,
      explorePrecision,
      documentaryPrecision,
      severity: COMPARISON_SEVERITY.CONFIDENCE_MISMATCH,
    }
  }

  return {
    category: 'AGREEMENT',
    summary: `Materially equivalent (${explorePrecision}, ${explore.confidence}).`,
    explorePrecision,
    documentaryPrecision,
    severity: COMPARISON_SEVERITY.AGREEMENT,
  }
}

export function sortPlaceFindingsBySeverity<T extends { severity: number }>(findings: T[]): T[] {
  return [...findings].sort((a, b) => a.severity - b.severity)
}
