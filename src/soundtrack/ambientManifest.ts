import { DEFAULT_DOCUMENTARY_SOUNDTRACK } from '../documentary-engine/data/soundtrackConfig'
import type { SoundtrackCategoryId } from './context/categories'
import type { WorldRegion } from './context/geography'
import type { HistoricalPeriod } from './context/periods'

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

export type TrackPlayback = {
  /** Seconds of overlap when the track loops into itself (default: the engine crossfade). */
  loopCrossfadeSec?: number
  /** Loop back to here instead of 0 (e.g. to skip an intro on repeats). */
  loopStartSec?: number
  /** Crossfade out before this point instead of the natural end (e.g. to skip a closing cadence). */
  loopEndSec?: number
}

type TrackBase = {
  id: string
  title: string
  categories: readonly SoundtrackCategoryId[]
  periods: readonly HistoricalPeriod[] | 'any'
  regions: readonly WorldRegion[] | 'any'
  mood: readonly string[]
}

export type ActiveTrack = TrackBase & {
  status: 'active'
  artist: string
  /** Same-origin path — Web Audio routing goes silent for cross-origin media without CORS. */
  src: string
  /** Per-track level before the visitor's volume; keeps tracks loudness-matched. */
  gain: number
  playback: TrackPlayback
  rights: AmbientTrackRights
}

/** A slot the selector understands but never plays; it falls back to the main theme. */
export type PlaceholderTrack = TrackBase & {
  status: 'placeholder'
  src: null
  rights: null
  /** What to source: instrumentation and atmosphere. */
  brief: string
}

export type AmbientTrack = ActiveTrack | PlaceholderTrack

export const MAIN_THEME_ID = 'atlas-main-theme'

/**
 * The soundtrack library. Activating a placeholder requires a same-origin file and verified rights
 * for both the composition and the specific recording — see the manifest test.
 */
export const AMBIENT_TRACKS: readonly AmbientTrack[] = [
  {
    id: MAIN_THEME_ID,
    status: 'active',
    title: 'History Documentary',
    artist: 'Leberch',
    categories: ['main'],
    periods: 'any',
    regions: 'any',
    mood: ['cinematic', 'warm', 'expansive'],
    src: DEFAULT_DOCUMENTARY_SOUNDTRACK.src,
    gain: 0.35,
    playback: {},
    rights: {
      license: 'Pixabay Content License',
      licenseUrl: 'https://pixabay.com/service/license-summary/',
      source: 'Pixabay track #589943, supplied by the site owner (also the documentary score)',
      attribution: null,
      verifiedBy: 'Site owner',
      verifiedOn: '2026-09-09',
    },
  },
  {
    id: 'placeholder-origins-northern-europe',
    status: 'placeholder',
    title: 'Origins — Northern & Western Europe',
    categories: ['origins'],
    periods: ['medieval_early_modern', 'c17_18'],
    regions: ['british_isles', 'western_europe', 'northern_europe', 'central_eastern_europe'],
    mood: ['ancient', 'modal', 'spacious'],
    src: null,
    rights: null,
    brief: 'Slow modal strings or viol consort over a soft drone; early-music colour, no vocals.',
  },
  {
    id: 'placeholder-origins-iberia-americas',
    status: 'placeholder',
    title: 'Origins — Iberia & the colonial Americas',
    categories: ['origins'],
    periods: ['medieval_early_modern', 'c17_18'],
    regions: ['southern_europe', 'latin_america'],
    mood: ['ancient', 'warm', 'restrained'],
    src: null,
    rights: null,
    brief: 'Vihuela or baroque guitar with sustained strings; cinematic and unhurried.',
  },
  {
    id: 'placeholder-migration-voyage',
    status: 'placeholder',
    title: 'Exploration & Migration — Voyage',
    categories: ['migration'],
    periods: 'any',
    regions: 'any',
    mood: ['forward', 'hopeful', 'open'],
    src: null,
    rights: null,
    brief: 'Broad orchestral or string piece suggesting travel and open horizons; steady, not heroic.',
  },
  {
    id: 'placeholder-migration-frontier',
    status: 'placeholder',
    title: 'Exploration & Migration — Frontier',
    categories: ['migration'],
    periods: ['c19', 'early_20th'],
    regions: ['north_america', 'latin_america'],
    mood: ['open', 'dusty', 'resolute'],
    src: null,
    rights: null,
    brief: 'Sparse guitar and strings evoking borderlands and westward crossings.',
  },
  {
    id: 'placeholder-everyday-hearth',
    status: 'placeholder',
    title: 'Everyday Life — Hearth',
    categories: ['everyday'],
    periods: 'any',
    regions: 'any',
    mood: ['intimate', 'warm', 'reflective'],
    src: null,
    rights: null,
    brief: 'Solo piano or small chamber ensemble; gentle, domestic and unobtrusive.',
  },
  {
    id: 'placeholder-everyday-latin',
    status: 'placeholder',
    title: 'Everyday Life — Latin America & Iberia',
    categories: ['everyday'],
    periods: ['c19', 'early_20th', 'postwar'],
    regions: ['latin_america', 'southern_europe'],
    mood: ['lyrical', 'warm', 'intimate'],
    src: null,
    rights: null,
    brief: 'Nylon-string guitar, soft and lyrical; regional colour without dance tempos.',
  },
  {
    id: 'placeholder-conflict',
    status: 'placeholder',
    title: 'Conflict & Upheaval',
    categories: ['conflict'],
    periods: 'any',
    regions: 'any',
    mood: ['tense', 'somber', 'restrained'],
    src: null,
    rights: null,
    brief: 'Low strings, muted brass and a slow pulse; somber rather than martial.',
  },
  {
    id: 'placeholder-legacy',
    status: 'placeholder',
    title: 'Reflection & Legacy',
    categories: ['legacy'],
    periods: ['postwar', 'contemporary'],
    regions: 'any',
    mood: ['tender', 'hopeful', 'reflective'],
    src: null,
    rights: null,
    brief: 'Contemporary cinematic piano with strings; memory and continuity.',
  },
]

export function isActiveTrack(track: AmbientTrack): track is ActiveTrack {
  return track.status === 'active'
}

export function getMainTheme(library: readonly AmbientTrack[] = AMBIENT_TRACKS): ActiveTrack {
  const theme = library.find((track) => track.id === MAIN_THEME_ID)
  if (!theme || !isActiveTrack(theme)) throw new Error('The soundtrack library needs an active main theme')
  return theme
}
