import type { ActiveTrack } from '../ambientManifest'
import type { SoundtrackContext } from '../context/resolveSoundtrackContext'

/** One plain-language sentence for visitors explaining why this music accompanies the current view. */
export function connectionSentence(
  track: ActiveTrack | undefined,
  context: SoundtrackContext | null,
  usingFallback: boolean,
): string {
  if (!track) return 'Music will accompany your exploration once a track is selected.'
  if (!context || context.overview || usingFallback || track.history.authenticity === 'cinematic_atmosphere') {
    if (track.id === 'atlas-main-theme' || usingFallback) {
      return 'A calm documentary score for the broader Atlas overview when no period-specific music is available.'
    }
  }
  const year =
    context?.subjectYear != null ? ` around ${Math.round(context.subjectYear)}` : ''
  const place = track.history.geographicOrigin
  const tradition = track.history.tradition ?? track.history.genre
  if (context?.precedence === 'historical_event') {
    return `Evokes ${tradition} associated with ${place}${year}, accompanying this historical moment.`
  }
  if (context?.explicit) {
    return `A ${tradition} from ${place}${year}, chosen to sit beside this family’s documented place and time.`
  }
  return `Drawn from ${tradition} connected with ${place}.`
}

export function shortStyleDescriptor(track: ActiveTrack): string {
  const from = track.history.usableFromYear
  const to = track.history.usableToYear
  const era =
    from == null && to == null
      ? 'Contemporary atmosphere'
      : from != null && to != null
        ? `${from}–${to}`
        : from != null
          ? `From ${from}`
          : `Through ${to}`
  return `${era} · ${track.history.genre}`
}
