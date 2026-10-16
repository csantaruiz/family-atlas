import {
  AMBIENT_TRACKS,
  getMainTheme,
  isActiveTrack,
  type ActiveTrack,
  type AmbientTrack,
} from '../ambientManifest'
import { isDateEligible, isRegionEligible } from './historicalMeta'
import type { SoundtrackContext } from './resolveSoundtrackContext'

export type TrackChoice = {
  track: ActiveTrack
  ideal: AmbientTrack
  usingFallback: boolean
  /** Why this recording was chosen (for Soundtrack Lab). */
  selectionReason: string
  eligibleCount: number
}

type Scored = { track: AmbientTrack; score: number; reasons: string[] }

function scoreTrack(track: AmbientTrack, context: SoundtrackContext): Scored | null {
  const meta = track.history
  if (!isDateEligible(meta, context.subjectYear, { strict: true })) return null
  if (!isRegionEligible(meta, context.region) && meta.supportableRegions !== 'any') return null

  // Wartime remembrance tracks should only win on conflict / world-war contexts.
  if (track.environment === 'wwii_1940s' && context.mood !== 'conflict' && context.period !== 'world_wars') {
    return null
  }

  let score = 0
  const reasons: string[] = []

  // 1. Historical date compatibility (already filtered) — tighter windows score higher.
  if (meta.earliestAttestationYear != null && context.subjectYear != null) {
    const lag = context.subjectYear - meta.earliestAttestationYear
    if (lag >= 0 && lag <= 40) {
      score += 8
      reasons.push('close to attestation era')
    } else if (lag > 40) {
      score += 5
      reasons.push('attested by this date')
    }
  }
  if (meta.authenticity === 'period_repertoire') {
    score += 4
    reasons.push('period repertoire')
  } else if (meta.authenticity === 'modern_interpretation') {
    score += 2
    reasons.push('modern interpretation of earlier repertoire')
  } else {
    score += 1
    reasons.push('atmospheric / non-period claim')
  }

  // 2. Geographic / cultural compatibility
  if (context.region && meta.supportableRegions !== 'any' && meta.supportableRegions.includes(context.region)) {
    score += 6
    reasons.push(`region ${context.region}`)
  } else if (meta.supportableRegions === 'any' && context.mood === 'conflict') {
    score += 3
    reasons.push('wartime remembrance (region-agnostic)')
  }

  // Soft preference for catalog environment match (not required).
  if (track.environment === context.environment) score += 2

  // 3. Contextual relevance (precedence + mood)
  if (context.precedence === 'historical_event' || context.precedence === 'ancestor_or_story') score += 2
  if (track.moods.includes(context.mood)) {
    score += 2
    reasons.push(`mood ${context.mood}`)
  }

  // 4. Confidence
  if (meta.confidence === 'high') score += 2
  else if (meta.confidence === 'medium') score += 1

  return { track, score, reasons }
}

function rotateAmong(
  ranked: Scored[],
  currentId: string | null,
  recentIds: readonly string[],
): Scored {
  if (ranked.length === 0) throw new Error('rotateAmong requires candidates')
  // Keep current if it remains among the top band (avoid thrash).
  const topScore = ranked[0].score
  const topBand = ranked.filter((entry) => entry.score >= topScore - 2)
  const current = topBand.find((entry) => entry.track.id === currentId)
  if (current) return current

  // Prefer historically valid alternatives not played recently.
  const fresh = topBand.filter((entry) => !recentIds.includes(entry.track.id))
  const pool = fresh.length > 0 ? fresh : topBand
  return pool[0]
}

/**
 * Historically informed selection:
 * date → geography → context → mood → variety.
 * Falls back to the cinematic main theme when nothing is historically supportable.
 */
export function selectTrack(
  context: SoundtrackContext,
  currentTrackId: string | null = null,
  library: readonly AmbientTrack[] = AMBIENT_TRACKS,
  recentIds: readonly string[] = [],
): TrackChoice {
  const main = getMainTheme(library)

  if (context.overview || context.subjectYear == null) {
    return {
      track: main,
      ideal: main,
      usingFallback: false,
      selectionReason: context.overview
        ? 'Broad Atlas overview — cinematic main theme'
        : 'No dated historical subject — cinematic main theme',
      eligibleCount: 1,
    }
  }

  const scored: Scored[] = []
  for (const track of library) {
    const result = scoreTrack(track, context)
    if (result) scored.push(result)
  }
  scored.sort((a, b) => b.score - a.score)

  const playable = scored.filter((entry) => isActiveTrack(entry.track))
  if (playable.length === 0) {
    return {
      track: main,
      ideal: scored[0]?.track ?? main,
      usingFallback: true,
      selectionReason:
        scored[0] != null
          ? `No playable historically eligible recording (ideal would be ${scored[0].track.title}); using cinematic main theme`
          : `No historically eligible recording for ${context.subjectYear} / ${context.region ?? 'unknown region'}; using cinematic main theme`,
      eligibleCount: 0,
    }
  }

  const chosen = rotateAmong(playable, currentTrackId, recentIds)
  const active = chosen.track
  if (!isActiveTrack(active)) {
    return {
      track: main,
      ideal: active,
      usingFallback: true,
      selectionReason: 'Selected catalog entry is a placeholder; using cinematic main theme',
      eligibleCount: playable.length,
    }
  }

  return {
    track: active,
    ideal: active,
    usingFallback: false,
    selectionReason: `${chosen.reasons.join('; ') || 'best historical match'} (score ${chosen.score})`,
    eligibleCount: playable.length,
  }
}
