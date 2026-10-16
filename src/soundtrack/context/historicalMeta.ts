import type { WorldRegion } from './geography'

/** How honestly we can describe the relationship between repertoire and recording. */
export type HistoricalAuthenticity =
  | 'period_repertoire'
  | 'modern_interpretation'
  | 'cinematic_atmosphere'

export type HistoricalConfidence = 'high' | 'medium' | 'low'

/**
 * Structured historical curation metadata for a soundtrack entry.
 * `earliestAttestationYear` is the first credible documentation of the *composition/tune*,
 * never inferred from a modern recording date.
 */
export type TrackHistoricalMeta = {
  composer: string | null
  tradition: string | null
  /** First credible composition / print / collection date; null for cinematic works. */
  earliestAttestationYear: number | null
  attestationNotes: string
  /** Inclusive earliest subject year this track may accompany in strict mode. */
  usableFromYear: number | null
  /** Inclusive latest subject year; null = no upper bound. */
  usableToYear: number | null
  geographicOrigin: string
  supportableRegions: readonly WorldRegion[] | 'any'
  genre: string
  instrumentation: readonly string[]
  authenticity: HistoricalAuthenticity
  confidence: HistoricalConfidence
}

export function isDateEligible(
  meta: TrackHistoricalMeta,
  subjectYear: number | null,
  opts: { strict?: boolean } = {},
): boolean {
  const strict = opts.strict !== false

  // Undated overview: only open-ended cinematic/neutral material (e.g. main theme).
  if (subjectYear == null) {
    return (
      meta.authenticity === 'cinematic_atmosphere' &&
      meta.usableFromYear == null &&
      meta.usableToYear == null
    )
  }

  if (meta.usableFromYear != null && subjectYear < meta.usableFromYear) return false
  if (meta.usableToYear != null && subjectYear > meta.usableToYear) return false

  // Strict period mode: never present a tune as period music before its first attestation.
  if (
    strict &&
    meta.authenticity !== 'cinematic_atmosphere' &&
    meta.earliestAttestationYear != null &&
    subjectYear < meta.earliestAttestationYear
  ) {
    return false
  }

  // Open-ended cinematic (main theme) is a fallback, not a primary dated match.
  if (
    meta.authenticity === 'cinematic_atmosphere' &&
    meta.usableFromYear == null &&
    meta.usableToYear == null
  ) {
    return false
  }

  return true
}

export function isRegionEligible(
  meta: TrackHistoricalMeta,
  region: WorldRegion | null,
): boolean {
  if (meta.supportableRegions === 'any') return true
  if (region == null) return false
  return meta.supportableRegions.includes(region)
}

export function authenticityLabel(kind: HistoricalAuthenticity): string {
  switch (kind) {
    case 'period_repertoire':
      return 'Authentic period repertoire (modern or archival performance)'
    case 'modern_interpretation':
      return 'Modern interpretation of traditional / earlier repertoire'
    case 'cinematic_atmosphere':
      return 'Cinematic atmosphere — not claimed as period music'
  }
}
