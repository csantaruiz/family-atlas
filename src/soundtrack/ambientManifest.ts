import { DEFAULT_DOCUMENTARY_SOUNDTRACK } from '../documentary-engine/data/soundtrackConfig'

export type SoundtrackEnvironment =
  | 'main'
  | 'mexico'
  | 'britain_ireland'
  | 'industrial_america'
  | 'wwii'
  | 'california'

export type AmbientTrackRights = {
  license: string
  licenseUrl: string
  /** Where the file came from; prose when there is no stable public URL. */
  source: string
  /** Credit line to show if the license asks for one; null when none is required. */
  attribution: string | null
  /** Who confirmed rights for both composition and recording, and when. */
  verifiedBy: string
  verifiedOn: string
}

export type AmbientTrack = {
  id: string
  title: string
  artist: string
  environment: SoundtrackEnvironment
  /** Same-origin path — Web Audio routing goes silent for cross-origin media without CORS. */
  src: string
  /** Per-track level before the visitor's volume; keeps tracks loudness-matched. */
  gain: number
  /** Crossfade out before this point instead of the natural end (e.g. to skip a closing cadence). */
  loopEndSec?: number
  rights: AmbientTrackRights
}

/** Only tracks with verified rights belong here — see the manifest test. */
export const AMBIENT_TRACKS: readonly AmbientTrack[] = [
  {
    id: 'atlas-main-theme',
    title: 'History Documentary',
    artist: 'Leberch',
    environment: 'main',
    src: DEFAULT_DOCUMENTARY_SOUNDTRACK.src,
    gain: 0.35,
    rights: {
      license: 'Pixabay Content License',
      licenseUrl: 'https://pixabay.com/service/license-summary/',
      source: 'Pixabay track #589943, supplied by the site owner (also the documentary score)',
      attribution: null,
      verifiedBy: 'Site owner',
      verifiedOn: '2026-09-09',
    },
  },
]

export const DEFAULT_SOUNDTRACK_ENVIRONMENT: SoundtrackEnvironment = 'main'

/** Environments without curated tracks fall back to the main theme. */
export function tracksForEnvironment(environment: SoundtrackEnvironment): readonly AmbientTrack[] {
  const tracks = AMBIENT_TRACKS.filter((track) => track.environment === environment)
  if (tracks.length > 0) return tracks
  return AMBIENT_TRACKS.filter((track) => track.environment === DEFAULT_SOUNDTRACK_ENVIRONMENT)
}
