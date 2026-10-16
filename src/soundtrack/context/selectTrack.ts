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
  return fit(track.periods, context.period) + fit(track.regions, context.region)
}

function best(candidates: readonly AmbientTrack[], context: SoundtrackContext, currentId: string | null) {
  let top: AmbientTrack | null = null
  let topScore = -Infinity
  for (const track of candidates) {
    const value = score(track, context)
    // A clear period or region mismatch is worse than the main theme.
    if (value < 0) continue
    // Equal fit keeps whatever is already playing, so similar contexts never trade tracks.
    const better = value > topScore || (value === topScore && track.id === currentId)
    if (better) {
      top = track
      topScore = value
    }
  }
  return top
}

/** Pick the best-fitting track for a context, preferring the current one on ties. */
export function selectTrack(
  context: SoundtrackContext,
  currentTrackId: string | null = null,
  library: readonly AmbientTrack[] = AMBIENT_TRACKS,
): TrackChoice {
  const main = getMainTheme(library)
  const inCategory = library.filter((track) => track.categories.includes(context.category))
  const ideal = best(inCategory, context, currentTrackId) ?? main
  const playable = best(inCategory.filter(isActiveTrack), context, currentTrackId)
  const track = playable && isActiveTrack(playable) ? playable : main
  return { track, ideal, usingFallback: ideal.id !== track.id }
}
