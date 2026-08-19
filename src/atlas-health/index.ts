export type {
  AtlasConfidence,
  AtlasHealthReport,
  EventLifecycleRecord,
  EventSynthesisKind,
  ExplainVisibilityInput,
  GeographicPipeline,
  PlaceComparisonCategory,
  PlaceComparisonCounts,
  PlaceComparisonResult,
  PlaceHealthFinding,
  PlaceResolutionRecord,
  PipelinePlaceResolution,
  ResolutionPrecision,
  VisibilityClassification,
  VisibilityHiddenReason,
} from './types'

export {
  classifyPlaceComparison,
  COMPARISON_SEVERITY,
  geographyCompatible,
  inferDocumentaryPrecision,
  inferExplorePrecision,
  sortPlaceFindingsBySeverity,
} from './placeComparison'
export { buildPlaceResolutionRecord, collectUniquePlaceStrings } from './placeResolution'
export { classifyEventSynthesis, eventPlaceRaw } from './eventProvenance'
export {
  explainEventVisibility,
  explainEventVisibilityWithDefaults,
  findEventsForPerson,
  listCanonicalEventIds,
  listFamilyEvents,
} from './explainVisibility'
export { isActionablePlaceComparison, runAtlasHealthCheck } from './healthCheck'
export { isAtlasDebugEnabled } from './dev/atlasDebugEnabled'
