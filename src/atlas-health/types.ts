/**
 * Atlas Health — Phase 1 observability types.
 * Observation only: these records never mutate Atlas presentation.
 */

/** Shared confidence vocabulary across places, dates, and future inferences. */
export type AtlasConfidence =
  | 'CONFIRMED'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'UNRESOLVED'

export type GeographicPipeline = 'explore' | 'documentary' | 'journey'

export type ExploreResolveMethod =
  | 'empty'
  | 'exact-override'
  | 'pattern'
  | 'region-fallback'
  | 'unresolved'

export type DocumentaryResolveMethod =
  | 'empty'
  | 'alias-index'
  | 'pattern-fallback'
  | 'substring-alias'
  | 'unresolved'

export type PlaceComparisonCategory =
  | 'GEOGRAPHIC_CONFLICT'
  | 'RESOLUTION_GAP'
  | 'PRECISION_MISMATCH'
  | 'CONFIDENCE_MISMATCH'
  | 'AGREEMENT'

export type ResolutionPrecision =
  | 'exact/city'
  | 'state/region'
  | 'country'
  | 'approximate-region'
  | 'unresolved'

/** Per-pipeline place resolution snapshot (does not change resolution). */
export type PipelinePlaceResolution = {
  pipeline: GeographicPipeline
  resolved: boolean
  method: string
  confidence: AtlasConfidence
  /** Effective resolution precision (diagnostic label only). */
  precision: ResolutionPrecision
  /** Human-readable label for the chosen match, when any. */
  label: string | null
  /** Documentary canonical id, when applicable. */
  canonicalId: string | null
  latitude: number | null
  longitude: number | null
  /** Explore projected coordinates (0–100 atlas space). */
  projectedX: number | null
  projectedY: number | null
  region: string | null
  displayRegion: string | null
  documentaryConfidenceRaw: string | null
  resolutionMethodRaw: string | null
  notes: string[]
}

export type PlaceComparisonResult = {
  category: PlaceComparisonCategory
  summary: string
  explorePrecision: ResolutionPrecision
  documentaryPrecision: ResolutionPrecision
  /** Lower = higher severity (for sorting findings). */
  severity: number
}

export type PlaceResolutionRecord = {
  /** Verbatim GEDCOM / database string — not repaired or trimmed. */
  original: string
  /** Diagnostic normalization only — does not alter source data. */
  normalized: string
  explore: PipelinePlaceResolution
  documentary: PipelinePlaceResolution
  comparison: PlaceComparisonResult
  humanConfirmed: false
  /** Phase 2A shadow unified resolver — does not drive production. */
  unified: import('../places/types').CanonicalPlaceResolution
  unifiedComparison: import('../places/types').UnifiedLegacyComparison
}

export type PlaceComparisonCounts = Record<PlaceComparisonCategory, number>

export type PlaceHealthFinding = {
  original: string
  category: PlaceComparisonCategory
  summary: string
  explorePrecision: ResolutionPrecision
  documentaryPrecision: ResolutionPrecision
  severity: number
}

export type EventSynthesisKind =
  | 'gedcom-person-vital'
  | 'inferred-move'
  | 'curated-special-service'
  | 'curated-marriage'
  | 'unknown'

/** Why an event is or is not visible — maps to the A–K product taxonomy. */
export type VisibilityHiddenReason =
  | 'visible'
  | 'not_in_event_set'
  | 'filtered_kind_or_branch'
  | 'outside_viewport'
  | 'landmark_budget_or_diversity'
  | 'chapter_residual_cluster'
  | 'conflict_folded'
  | 'persistent_marker_cap'
  | 'birth_period_cluster_mode'
  | 'deduped_away'
  | 'unknown'

export type VisibilityClassification = 'EXPECTED' | 'SUSPICIOUS' | 'BUG_SUSPECTED'

export type EventLifecycleRecord = {
  eventId: string
  personId: string
  personName: string
  kind: string
  year: number
  title: string
  detail: string
  placeRaw: string | null
  synthesis: {
    kind: EventSynthesisKind
    notes: string[]
  }
  importanceBase: number
  importanceLayoutScore: number | null
  filterPassed: boolean
  filterNotes: string[]
  withinViewport: boolean
  semanticZoomMode: string | null
  birthPeriodClusterMode: boolean
  selectedAsLandmark: boolean
  placedInLayout: boolean
  admittedAfterCap: boolean
  conflictFolded: boolean
  conflictClusterId: string | null
  chapterClusterId: string | null
  chapterHiddenCount: number | null
  finallyVisible: boolean
  hiddenReason: VisibilityHiddenReason
  classification: VisibilityClassification
  summary: string
  placeResolution: PlaceResolutionRecord | null
}

export type AtlasHealthPlaceSummary = {
  uniquePlaceStrings: number
  exploreResolved: number
  exploreUnresolved: number
  documentaryResolved: number
  documentaryUnresolved: number
  /** Headline counts by comparison category (includes AGREEMENT). */
  comparisonCounts: PlaceComparisonCounts
  /** Non-AGREEMENT findings only — sorted by severity. */
  actionableFindings: number
  lowConfidenceExplore: number
  /** Phase 2A unified shadow distribution. */
  unifiedResolved: number
  unifiedCoarse: number
  unifiedAmbiguous: number
  unifiedUnresolved: number
  unifiedRegressions: number
  unifiedCorrections: number
}

export type AtlasHealthEventSummary = {
  totalEvents: number
  byKind: Record<string, number>
  inferredMoves: number
  curatedServices: number
  curatedMarriages: number
}

export type AtlasHealthReport = {
  generatedAt: string
  people: number
  photographsCuratedHint: number | null
  places: AtlasHealthPlaceSummary
  events: AtlasHealthEventSummary
  /** Non-AGREEMENT place comparisons, sorted by severity. */
  placeFindings: PlaceHealthFinding[]
  /** Highest-severity subset for quick review (conflicts + resolution gaps). */
  priorityPlaces: Array<{
    original: string
    category: PlaceComparisonCategory
    summary: string
    explorePrecision: ResolutionPrecision
    documentaryPrecision: ResolutionPrecision
  }>
  notes: string[]
}

export type ExplainVisibilityInput = {
  eventId: string
  start: number
  end: number
  span: number
  width: number
  height: number
  fullSpan: number
  earliestYear: number
  presentYear: number
  rootPersonId: string
  filters: import('../types/timelineFilters').TimelineFilters
}
