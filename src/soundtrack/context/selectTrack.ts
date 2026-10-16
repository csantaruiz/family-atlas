import {
  AMBIENT_TRACKS,
  getMainTheme,
  isActiveTrack,
  type ActiveTrack,
  type AmbientTrack,
} from '../ambientManifest'
import type { SoundtrackContext } from './resolveSoundtrackContext'

export type TrackChoice = {
  /** What will actually play. */
  track: ActiveTrack
  /** Best match including placeholders — what would play once the library is filled in. */
  ideal: AmbientTrack
  /** True when the ideal is a placeholder and the main theme stands in. */
  usingFallback: boolean
}

function fit<T>(allowed: readonly T[] | 'any', value: T | null): number {
  if (allowed === 'any') return 1
  if (value == null) return 0.5
  return allowed.includes(value) ? 2 : -10
}

function score(track: AmbientTrack, context: SoundtrackContext): number {
  let value = 0
  value += fit(track.periods, context.period)
  value += fit(track.regions, context.region)
  // Mood is a soft preference within an environment.
  if (track.moods.includes(context.mood)) value += 1
  return value
}

function best(candidates: readonly AmbientTrack[], context: SoundtrackContext, currentId: string | null) {
  let top: AmbientTrack | null = null
  let topScore = -Infinity
  for (const track of candidates) {
    const value = score(track, context)
    if (value < 0) continue
    const better = value > topScore || (value === topScore && track.id === currentId)
    if (better) {
      top = track
      topScore = value
    }
  }
  return top
}

/**
 * Pick the best-fitting track for a context.
 * Environment is primary; mood/period/region refine when several tracks share an environment.
 */
export function selectTrack(
  context: SoundtrackContext,
  currentTrackId: string | null = null,
  library: readonly AmbientTrack[] = AMBIENT_TRACKS,
): TrackChoice {
  const main = getMainTheme(library)
  const inEnvironment = library.filter((track) => track.environment === context.environment)
  const ideal = best(inEnvironment, context, currentTrackId) ?? main
  const playable = best(inEnvironment.filter(isActiveTrack), context, currentTrackId)
  const track = playable && isActiveTrack(playable) ? playable : main
  return { track, ideal, usingFallback: ideal.id !== track.id }
}
