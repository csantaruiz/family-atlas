/**
 * Phase 2B persistent override types.
 * Corrections sit above GEDCOM import and automated inference; they never mutate source GEDCOM.
 */

export type OverrideEntityType = 'place' | 'event' | 'diagnostic' | 'person'

export type OverrideStatus = 'active' | 'reverted' | 'orphaned' | 'needs_review'

export type OverrideMatchConfidence = 'exact' | 'probable' | 'ambiguous'

export type DiagnosticReviewState = 'unresolved' | 'confirmed' | 'corrected' | 'ignored'

/** Distinguishes how a place correction was produced. */
export type PlaceSelectionProvenance = 'canonical_selection' | 'manual_coordinates'

export type PlaceOverrideType = 'confirm_resolution' | 'set_coordinates' | 'set_label'

export type EventOverrideType =
  | 'suppress'
  | 'force_include'
  | 'confirm_inferred'
  | 'correct_year'
  | 'correct_place'

export type DiagnosticOverrideType = 'disposition'

export type PersonDateField = 'birth' | 'death'

export type PersonOverrideType = 'confirm_date' | 'set_date' | 'confirm_name' | 'set_name'

export type OverrideType = PlaceOverrideType | EventOverrideType | DiagnosticOverrideType | PersonOverrideType

export type PlaceConfirmPayload = {
  fingerprint: string
  originalExamples: string[]
  canonicalPlaceId: string
  label?: string
  precisionCap?: string
  selectionProvenance: 'canonical_selection'
  autoCanonicalPlaceId?: string | null
}

export type PlaceCoordinatesPayload = {
  fingerprint: string
  originalExamples: string[]
  lat: number
  lng: number
  label?: string
  precisionCap?: string
  selectionProvenance: 'manual_coordinates'
  autoCanonicalPlaceId?: string | null
}

export type PlaceLabelPayload = {
  fingerprint: string
  originalExamples: string[]
  label: string
  selectionProvenance?: PlaceSelectionProvenance
  autoCanonicalPlaceId?: string | null
}

export type EventSuppressPayload = { reason?: string; eventFingerprint: string }
export type EventForceIncludePayload = {
  reason?: string
  eventFingerprint: string
  /**
   * Eligible for display only — does NOT bypass clustering, semantic zoom,
   * density limits, or layout collision rules.
   */
  eligibilityOnly: true
}
export type EventConfirmInferredPayload = { reason?: string; eventFingerprint: string }
export type EventCorrectYearPayload = { year: number; reason?: string; eventFingerprint: string }
export type EventCorrectPlacePayload = {
  placeString: string
  reason?: string
  eventFingerprint: string
}

export type DiagnosticDispositionPayload = {
  category: string
  disposition: DiagnosticReviewState
  originalRef?: string
  eventId?: string
}

export type PersonNamePayload = {
  originalRaw: string
  interpretedRaw: string
}

export type PersonDatePayload = {
  field: PersonDateField
  originalRaw: string
  interpretedRaw: string
  interpretedYear: number | null
  parsedOriginal: {
    raw: string
    qualifier: string
    precision: string
    year: number | null
    earliestYear: number | null
    latestYear: number | null
  }
  parsedInterpreted: {
    raw: string
    qualifier: string
    precision: string
    year: number | null
    earliestYear: number | null
    latestYear: number | null
  }
}

export type OverridePayload =
  | PlaceConfirmPayload
  | PlaceCoordinatesPayload
  | PlaceLabelPayload
  | EventSuppressPayload
  | EventForceIncludePayload
  | EventConfirmInferredPayload
  | EventCorrectYearPayload
  | EventCorrectPlacePayload
  | DiagnosticDispositionPayload
  | PersonDatePayload
  | PersonNamePayload

export type AtlasOverrideRecord = {
  id: string
  atlasId: string
  entityType: OverrideEntityType
  entityKey: string
  overrideType: OverrideType
  payload: OverridePayload
  status: OverrideStatus
  reviewState: DiagnosticReviewState | null
  source: string
  matchConfidence: OverrideMatchConfidence
  sourceSignature: string | null
  notes: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type UpsertOverrideInput = {
  entityType: OverrideEntityType
  entityKey: string
  overrideType: OverrideType
  payload: OverridePayload
  source?: string
  matchConfidence?: OverrideMatchConfidence
  sourceSignature?: string | null
  notes?: string | null
  createdBy?: string | null
  reviewState?: DiagnosticReviewState | null
  /** When true, soft-reverts any prior active row for same key+type before insert. */
  replaceActive?: boolean
}
