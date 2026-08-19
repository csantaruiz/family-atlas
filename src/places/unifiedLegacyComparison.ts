import type { PipelinePlaceResolution, PlaceComparisonResult } from '../atlas-health/types'
import { geographyCompatible } from '../atlas-health/placeComparison'
import type {
  CanonicalPlaceResolution,
  UnifiedLegacyComparison,
  UnifiedLegacyComparisonCategory,
} from './types'

const SEVERITY: Record<UnifiedLegacyComparisonCategory, number> = {
  UNIFIED_REGRESSION: 0,
  UNIFIED_UNRESOLVED: 1,
  UNIFIED_COARSER_THAN_ACCEPTABLE: 2,
  NO_ACCEPTABLE_BASELINE: 3,
  UNIFIED_AMBIGUOUS_SAFE: 4,
  UNIFIED_CORRECTS_LEGACY: 5,
  UNIFIED_AGREES_ACCEPTABLE: 6,
}

export function unifiedMacroGeography(
  resolution: Pick<CanonicalPlaceResolution, 'label' | 'canonicalPlaceId' | 'provenance'>,
): 'europe' | 'mexico' | 'us' | 'other' | null {
  const text = [
    resolution.label,
    resolution.canonicalPlaceId,
    ...(resolution.provenance.matchedAdminPath ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (!text) return null
  if (/england|britain|scotland|ireland|cheshire|united kingdom|europe|spain/.test(text)) return 'europe'
  if (/mexico|chihuahua|ojinaga|parral|nueva/.test(text)) return 'mexico'
  if (/united states|california|texas|jersey|pennsylvania|florida|connecticut|virginia|oregon|massachusetts|missouri/.test(text)) {
    return 'us'
  }
  return 'other'
}

function pipelineMacro(resolution: PipelinePlaceResolution): 'europe' | 'mexico' | 'us' | 'other' | null {
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
  if (/england|britain|scotland|ireland|cheshire|united kingdom|europe|spain/.test(text)) return 'europe'
  if (/mexico|chihuahua|ojinaga/.test(text)) return 'mexico'
  if (/united states|california|texas|jersey|pennsylvania|florida|connecticut|virginia|oregon|massachusetts|missouri|southwest|eastern/.test(text)) {
    return 'us'
  }
  return 'other'
}

/** Which legacy pipeline(s) represent geography already judged acceptable for this string. */
export function geographyAcceptableBaseline(
  explore: PipelinePlaceResolution,
  documentary: PipelinePlaceResolution,
  legacyComparison: PlaceComparisonResult,
): 'explore' | 'documentary' | 'both' | 'none' {
  if (legacyComparison.category === 'GEOGRAPHIC_CONFLICT') return 'none'
  if (legacyComparison.category === 'AGREEMENT' || legacyComparison.category === 'CONFIDENCE_MISMATCH') {
    if (explore.resolved && documentary.resolved) return 'both'
    if (explore.resolved) return 'explore'
    if (documentary.resolved) return 'documentary'
  }
  if (legacyComparison.category === 'PRECISION_MISMATCH') {
    if (explore.resolved && documentary.resolved && geographyCompatible(explore, documentary)) {
      return 'both'
    }
  }
  if (legacyComparison.category === 'RESOLUTION_GAP') {
    if (explore.resolved && !documentary.resolved) return 'explore'
    if (documentary.resolved && !explore.resolved) return 'documentary'
  }
  return 'none'
}

function macroMatches(
  unified: CanonicalPlaceResolution,
  pipeline: PipelinePlaceResolution,
): boolean {
  const u = unifiedMacroGeography(unified)
  const p = pipelineMacro(pipeline)
  if (!u || !p || u === 'other' || p === 'other') return true
  return u === p
}

function coordinatesRoughlyMatch(
  unified: CanonicalPlaceResolution,
  pipeline: PipelinePlaceResolution,
): boolean {
  if (unified.latitude == null || unified.longitude == null) return unified.status === 'ambiguous' || unified.status === 'unresolved'
  if (pipeline.latitude == null || pipeline.longitude == null) return true
  return Math.abs(unified.latitude - pipeline.latitude) <= 8 && Math.abs(unified.longitude - pipeline.longitude) <= 8
}

/**
 * Compare unified shadow resolution against legacy pipelines.
 * Legacy is not automatically truth — regressions are judged against acceptable geography.
 */
export function classifyUnifiedLegacyComparison(input: {
  original: string
  unified: CanonicalPlaceResolution
  explore: PipelinePlaceResolution
  documentary: PipelinePlaceResolution
  legacyComparison: PlaceComparisonResult
}): UnifiedLegacyComparison {
  const { original, unified, explore, documentary, legacyComparison } = input
  const baseline = geographyAcceptableBaseline(explore, documentary, legacyComparison)

  if (unified.status === 'unresolved' || unified.status === 'normalization-only') {
    if (baseline === 'none') {
      return {
        category: 'UNIFIED_UNRESOLVED',
        summary: 'Unified unresolved; no acceptable legacy baseline to regress against.',
        severity: SEVERITY.UNIFIED_UNRESOLVED,
        acceptableBaseline: baseline,
      }
    }
    return {
      category: 'UNIFIED_REGRESSION',
      summary: 'Unified unresolved where acceptable legacy geography existed.',
      severity: SEVERITY.UNIFIED_REGRESSION,
      acceptableBaseline: baseline,
    }
  }

  if (unified.status === 'ambiguous') {
    return {
      category: 'UNIFIED_AMBIGUOUS_SAFE',
      summary: 'Unified deliberately ambiguous — preferable to false precision.',
      severity: SEVERITY.UNIFIED_AMBIGUOUS_SAFE,
      acceptableBaseline: baseline,
    }
  }

  if (legacyComparison.category === 'GEOGRAPHIC_CONFLICT') {
    const exploreMacro = pipelineMacro(explore)
    const docMacro = pipelineMacro(documentary)
    const unifiedMacro = unifiedMacroGeography(unified)
    const legacyWrong =
      (exploreMacro && unifiedMacro && exploreMacro !== unifiedMacro) ||
      (docMacro && unifiedMacro && docMacro !== unifiedMacro)
    if (legacyWrong) {
      return {
        category: 'UNIFIED_CORRECTS_LEGACY',
        summary: 'Unified resolves known legacy geographic conflict.',
        severity: SEVERITY.UNIFIED_CORRECTS_LEGACY,
        acceptableBaseline: baseline,
      }
    }
  }

  if (baseline === 'none') {
    return {
      category: 'NO_ACCEPTABLE_BASELINE',
      summary: 'Legacy pipelines conflicted — unified outcome recorded without regression test.',
      severity: SEVERITY.NO_ACCEPTABLE_BASELINE,
      acceptableBaseline: baseline,
    }
  }

  const ref = baseline === 'documentary' ? documentary : baseline === 'explore' ? explore : explore
  const refOk = macroMatches(unified, ref)

  if (!refOk) {
    if (
      legacyComparison.category === 'RESOLUTION_GAP' ||
      legacyComparison.category === 'GEOGRAPHIC_CONFLICT'
    ) {
      return {
        category: 'UNIFIED_CORRECTS_LEGACY',
        summary: 'Unified improves on legacy resolution gap or geographic conflict.',
        severity: SEVERITY.UNIFIED_CORRECTS_LEGACY,
        acceptableBaseline: baseline,
      }
    }

    const unifiedMacro = unifiedMacroGeography(unified)
    const exploreMacro = pipelineMacro(explore)
    const usContext = /\b(united states|usa|u\.s\.a\.|california|texas|new jersey|pennsylvania|virginia|connecticut|massachusetts|missouri|florida|oregon|new hampshire)\b/i.test(
      original,
    )
    if (usContext && unifiedMacro === 'us' && exploreMacro === 'europe') {
      return {
        category: 'UNIFIED_CORRECTS_LEGACY',
        summary: 'Unified US context overrides legacy Europe heuristic misfire.',
        severity: SEVERITY.UNIFIED_CORRECTS_LEGACY,
        acceptableBaseline: baseline,
      }
    }

    return {
      category: 'UNIFIED_REGRESSION',
      summary: 'Unified geography contradicts acceptable legacy baseline.',
      severity: SEVERITY.UNIFIED_REGRESSION,
      acceptableBaseline: baseline,
    }
  }

  // Coarse unified outcomes are acceptable when macro geography aligns — even if
  // coordinates differ from legacy heuristic centers (prefer honest coarse over false precision).
  if (unified.status === 'coarse') {
    if (legacyComparison.category === 'RESOLUTION_GAP' || legacyComparison.category === 'GEOGRAPHIC_CONFLICT') {
      return {
        category: 'UNIFIED_CORRECTS_LEGACY',
        summary: 'Unified coarse resolution improves on legacy gap or conflict.',
        severity: SEVERITY.UNIFIED_CORRECTS_LEGACY,
        acceptableBaseline: baseline,
      }
    }
    return {
      category: 'UNIFIED_AGREES_ACCEPTABLE',
      summary: 'Unified coarse resolution compatible with acceptable legacy macro geography.',
      severity: SEVERITY.UNIFIED_AGREES_ACCEPTABLE,
      acceptableBaseline: baseline,
    }
  }

  if (!coordinatesRoughlyMatch(unified, ref) && unified.status === 'resolved') {
    if (legacyComparison.category === 'RESOLUTION_GAP') {
      return {
        category: 'UNIFIED_CORRECTS_LEGACY',
        summary: 'Unified locality resolution fills legacy resolution gap.',
        severity: SEVERITY.UNIFIED_CORRECTS_LEGACY,
        acceptableBaseline: baseline,
      }
    }
    return {
      category: 'UNIFIED_REGRESSION',
      summary: 'Unified city-level coordinates contradict acceptable legacy baseline.',
      severity: SEVERITY.UNIFIED_REGRESSION,
      acceptableBaseline: baseline,
    }
  }

  if (legacyComparison.category === 'GEOGRAPHIC_CONFLICT' || legacyComparison.category === 'RESOLUTION_GAP') {
    return {
      category: 'UNIFIED_CORRECTS_LEGACY',
      summary: 'Unified improves on legacy resolution gap or conflict.',
      severity: SEVERITY.UNIFIED_CORRECTS_LEGACY,
      acceptableBaseline: baseline,
    }
  }

  return {
    category: 'UNIFIED_AGREES_ACCEPTABLE',
    summary: 'Unified compatible with acceptable legacy geography.',
    severity: SEVERITY.UNIFIED_AGREES_ACCEPTABLE,
    acceptableBaseline: baseline,
  }
}

export { SEVERITY as UNIFIED_COMPARISON_SEVERITY }
