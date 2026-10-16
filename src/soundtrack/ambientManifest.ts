import { DEFAULT_DOCUMENTARY_SOUNDTRACK } from '../documentary-engine/data/soundtrackConfig'
import type { SoundtrackCategoryId } from './context/categories'
import type { SoundtrackEnvironmentId } from './context/environments'
import type { WorldRegion } from './context/geography'
import type { HistoricalPeriod } from './context/periods'

export type AmbientTrackRights = {
  license: string
  licenseUrl: string
  /** Where the file came from; prose when there is no stable public URL. */
  source: string
  sourceUrl: string | null
  /** Credit line to show if the license asks for one; null when none is required. */
  attribution: string | null
  /** Who confirmed rights for both composition and recording, and when. */
  verifiedBy: string
  verifiedOn: string
  compositionNotes: string
  recordingNotes: string
  /** Approximate duration in seconds (for inventory / preview UI). */
  durationSec: number
  recordingYear: number | null
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
  environment: SoundtrackEnvironmentId
  /** Narrative moods this track suits when refining within an environment. */
  moods: readonly SoundtrackCategoryId[]
  periods: readonly HistoricalPeriod[] | 'any'
  regions: readonly WorldRegion[] | 'any'
  tags: readonly string[]
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
 * Shared reusable soundtrack library. Environments are keyed for any imported GEDCOM;
 * activating a placeholder requires a same-origin file and verified composition + recording rights.
 */
export const AMBIENT_TRACKS: readonly AmbientTrack[] = [
  {
    id: MAIN_THEME_ID,
    status: 'active',
    title: 'History Documentary',
    artist: 'Leberch',
    environment: 'main',
    moods: ['main', 'legacy', 'everyday'],
    periods: 'any',
    regions: 'any',
    tags: ['cinematic', 'warm', 'expansive'],
    src: DEFAULT_DOCUMENTARY_SOUNDTRACK.src,
    gain: 0.35,
    playback: {},
    rights: {
      license: 'Pixabay Content License',
      licenseUrl: 'https://pixabay.com/service/license-summary/',
      source: 'Pixabay track #589943, supplied by the site owner (also the documentary score)',
      sourceUrl: 'https://pixabay.com/music/',
      attribution: null,
      verifiedBy: 'Site owner',
      verifiedOn: '2026-09-09',
      compositionNotes: 'Modern royalty-free composition under Pixabay Content License.',
      recordingNotes: 'Same commercial recording used as the documentary score; redistributable with the site.',
      durationSec: 390,
      recordingYear: null,
    },
  },
  {
    id: 'mexico-la-guacamaya',
    status: 'active',
    title: 'La Guacamaya (Son Jarocho)',
    artist: 'Soneros del Tesechoacán (field recording by Lenguaverde)',
    environment: 'mexico_southwest',
    moods: ['origins', 'everyday', 'migration'],
    periods: 'any',
    regions: ['latin_america'],
    tags: ['jarana', 'requinto', 'archival-character', 'veracruz'],
    src: '/audio/soundtrack/mexico-la-guacamaya.mp3',
    gain: 0.28,
    playback: { loopCrossfadeSec: 4 },
    rights: {
      license: 'CC0 1.0 Universal',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      source: 'Freesound #177562 — street/field recording of traditional son jarocho, Oakland CA, Jan 2012',
      sourceUrl: 'https://freesound.org/people/Lenguaverde/sounds/177562/',
      attribution: null,
      verifiedBy: 'Atlas soundtrack research',
      verifiedOn: '2026-10-16',
      compositionNotes: 'Traditional Mexican son jarocho repertoire; folk melody treated as public-domain traditional.',
      recordingNotes:
        'Uploader Lenguaverde released the recording under CC0 on Freesound (commercial reuse allowed without attribution).',
      durationSec: 435,
      recordingYear: 2012,
    },
  },
  {
    id: 'britain-londonderry-air',
    status: 'active',
    title: 'Londonderry Air',
    artist: 'Traditional Irish air; piano arrangement by Jon Hall',
    environment: 'britain_ireland',
    moods: ['origins', 'everyday', 'legacy'],
    periods: 'any',
    regions: ['british_isles'],
    tags: ['irish', 'piano', 'reflective'],
    src: '/audio/soundtrack/britain-ireland-londonderry-air.mp3',
    gain: 0.42,
    playback: { loopCrossfadeSec: 3.5 },
    rights: {
      license: 'Public Domain',
      licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
      source: 'Wikimedia Commons — File:Londonderry_Air.ogg',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Londonderry_Air.ogg',
      attribution: null,
      verifiedBy: 'Atlas soundtrack research',
      verifiedOn: '2026-10-16',
      compositionNotes: 'Traditional Irish air (Petrie collection, mid-19th century); melody in the public domain.',
      recordingNotes:
        'Piano arrangement released into the public domain by Jon Hall (en.wikipedia / Commons).',
      durationSec: 144,
      recordingYear: 2010,
    },
  },
  {
    id: 'industrial-maple-leaf-rag',
    status: 'active',
    title: "Maple Leaf Rag",
    artist: 'Scott Joplin; United States Marine Band',
    environment: 'industrial_america',
    moods: ['everyday', 'migration', 'origins'],
    periods: ['c19', 'early_20th'],
    regions: ['north_america'],
    tags: ['ragtime', 'archival', '1906', 'piano-band'],
    src: '/audio/soundtrack/industrial-america-maple-leaf-rag.mp3',
    gain: 0.3,
    playback: { loopCrossfadeSec: 3 },
    rights: {
      license: 'Public Domain (US federal work + pre-1926 sound recording)',
      licenseUrl: 'https://commons.wikimedia.org/wiki/Commons:Copyright_tags/Country-specific_tags#United_States_of_America',
      source: 'Wikimedia Commons — 1906 United States Marine Band recording',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:1906_-_Scott_Joplin%27s_Maple_Leaf_Rag_(1899)_played_by_the_United_States_Marine_Band.ogg',
      attribution: null,
      verifiedBy: 'Atlas soundtrack research',
      verifiedOn: '2026-10-16',
      compositionNotes: 'Scott Joplin, Maple Leaf Rag (1899); composition public domain in the US.',
      recordingNotes:
        'US Marine Band performance (1906): US federal government work and PD-US-record-expired (published before 1926).',
      durationSec: 115,
      recordingYear: 1906,
    },
  },
  {
    id: 'wwii-goin-home',
    status: 'active',
    title: "Goin' Home",
    artist: 'After Antonín Dvořák; United States Air Force Band',
    environment: 'wwii_1940s',
    moods: ['conflict', 'legacy', 'migration'],
    periods: ['world_wars', 'early_20th', 'postwar'],
    regions: 'any',
    tags: ['restrained', 'remembrance', 'concert-band'],
    src: '/audio/soundtrack/wwii-goin-home.mp3',
    gain: 0.3,
    playback: { loopCrossfadeSec: 4 },
    rights: {
      license: 'Public Domain (US federal performance; Dvořák composition PD)',
      licenseUrl: 'https://www.music.af.mil/Multimedia/Music/Public-Domain-Music/',
      source: 'US Air Force Public Domain Music — Concert Band recording on Wikimedia Commons',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Goin%27_Home_-_Concert_Band_-_United_States_Air_Force_Band.mp3',
      attribution: null,
      verifiedBy: 'Atlas soundtrack research',
      verifiedOn: '2026-10-16',
      compositionNotes:
        "Derived from Dvořák Symphony No. 9 Largo (1893); composer died 1904 — composition public domain.",
      recordingNotes:
        'United States Air Force Band concert-band performance published as US federal public-domain music.',
      durationSec: 187,
      recordingYear: 2004,
    },
  },
  {
    id: 'iberia-spanish-romance',
    status: 'active',
    title: 'Romance Anónimo (Spanish Romance)',
    artist: 'Anonymous; performed by Jim Greeninger (Musopen)',
    environment: 'iberia',
    moods: ['origins', 'everyday', 'legacy'],
    periods: 'any',
    regions: ['southern_europe'],
    tags: ['classical-guitar', 'spain', 'reflective'],
    src: '/audio/soundtrack/iberia-spanish-romance.mp3',
    gain: 0.4,
    playback: { loopCrossfadeSec: 3.5 },
    rights: {
      license: 'CC0 1.0 Universal',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      source: 'Musopen via Wikimedia Commons — Romance Anónimo (Jeux interdits)',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Romance_An%C3%B3nimo_(Jeux_interdits).ogg',
      attribution: null,
      verifiedBy: 'Atlas soundtrack research',
      verifiedOn: '2026-10-16',
      compositionNotes:
        'Anonymous 19th-century guitar romance (authorship disputed); treated as public domain on Musopen/Commons.',
      recordingNotes: 'Jim Greeninger performance released under CC0 via Musopen.',
      durationSec: 167,
      recordingYear: null,
    },
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

export function tracksForEnvironment(
  environment: SoundtrackEnvironmentId,
  library: readonly AmbientTrack[] = AMBIENT_TRACKS,
): AmbientTrack[] {
  return library.filter((track) => track.environment === environment)
}

export function activeTracks(library: readonly AmbientTrack[] = AMBIENT_TRACKS): ActiveTrack[] {
  return library.filter(isActiveTrack)
}
