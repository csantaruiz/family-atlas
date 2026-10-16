import { DEFAULT_DOCUMENTARY_SOUNDTRACK } from '../documentary-engine/data/soundtrackConfig'
import type { SoundtrackCategoryId } from './context/categories'
import type { SoundtrackEnvironmentId } from './context/environments'
import type { TrackHistoricalMeta } from './context/historicalMeta'

export type AmbientTrackRights = {
  license: string
  licenseUrl: string
  source: string
  sourceUrl: string | null
  attribution: string | null
  verifiedBy: string
  verifiedOn: string
  compositionNotes: string
  recordingNotes: string
  durationSec: number
  recordingYear: number | null
}

export type TrackPlayback = {
  loopCrossfadeSec?: number
  loopStartSec?: number
  loopEndSec?: number
}

type TrackBase = {
  id: string
  title: string
  /** Soft catalog grouping for the lab UI — selection is driven by historical meta. */
  environment: SoundtrackEnvironmentId
  moods: readonly SoundtrackCategoryId[]
  tags: readonly string[]
  history: TrackHistoricalMeta
}

export type ActiveTrack = TrackBase & {
  status: 'active'
  artist: string
  src: string
  gain: number
  playback: TrackPlayback
  rights: AmbientTrackRights
}

export type PlaceholderTrack = TrackBase & {
  status: 'placeholder'
  src: null
  rights: null
  brief: string
}

export type AmbientTrack = ActiveTrack | PlaceholderTrack

export const MAIN_THEME_ID = 'atlas-main-theme'

/**
 * Historically curated library. Placeholders are explicit coverage gaps — never silent “fake” actives.
 */
export const AMBIENT_TRACKS: readonly AmbientTrack[] = [
  {
    id: MAIN_THEME_ID,
    status: 'active',
    title: 'History Documentary',
    artist: 'Leberch',
    environment: 'main',
    moods: ['main', 'legacy', 'everyday'],
    tags: ['cinematic', 'neutral-fallback'],
    history: {
      composer: 'Leberch',
      tradition: null,
      earliestAttestationYear: null,
      attestationNotes: 'Modern cinematic composition; not historical repertoire.',
      usableFromYear: null,
      usableToYear: null,
      geographicOrigin: 'Contemporary studio',
      supportableRegions: 'any',
      genre: 'cinematic ambient',
      instrumentation: ['orchestra', 'pads'],
      authenticity: 'cinematic_atmosphere',
      confidence: 'high',
    },
    src: DEFAULT_DOCUMENTARY_SOUNDTRACK.src,
    gain: 0.35,
    playback: {},
    rights: {
      license: 'Pixabay Content License',
      licenseUrl: 'https://pixabay.com/service/license-summary/',
      source: 'Pixabay track #589943 (documentary score)',
      sourceUrl: 'https://pixabay.com/music/',
      attribution: null,
      verifiedBy: 'Site owner',
      verifiedOn: '2026-09-09',
      compositionNotes: 'Modern royalty-free composition.',
      recordingNotes: 'Same commercial recording as the documentary score.',
      durationSec: 390,
      recordingYear: null,
    },
  },
  {
    id: 'britain-greensleeves',
    status: 'active',
    title: 'Greensleeves',
    artist: 'Traditional English; performance by CambridgeBayWeather',
    environment: 'britain_ireland',
    moods: ['origins', 'everyday'],
    tags: ['tudor', 'early-modern', 'england'],
    history: {
      composer: null,
      tradition: 'English broadside / courtly popular song',
      earliestAttestationYear: 1580,
      attestationNotes:
        'Registered / circulating in England by 1580; widely attested through the early modern period.',
      usableFromYear: 1580,
      usableToYear: 1820,
      geographicOrigin: 'England',
      supportableRegions: ['british_isles'],
      genre: 'English traditional air',
      instrumentation: ['instrumental transcription'],
      authenticity: 'modern_interpretation',
      confidence: 'high',
    },
    src: '/audio/soundtrack/britain-greensleeves.mp3',
    gain: 0.38,
    playback: { loopCrossfadeSec: 3 },
    rights: {
      license: 'CC BY 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
      source: 'Wikimedia Commons — File:Greensleeves.ogg',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Greensleeves.ogg',
      attribution: 'Greensleeves performance by CambridgeBayWeather (CC BY 3.0)',
      verifiedBy: 'Atlas soundtrack research',
      verifiedOn: '2026-10-16',
      compositionNotes: 'Traditional English melody; composition public domain.',
      recordingNotes: 'Modern instrumental transcription licensed CC BY 3.0.',
      durationSec: 79,
      recordingYear: 2007,
    },
  },
  {
    id: 'britain-early-one-morning',
    status: 'active',
    title: 'Early One Morning',
    artist: 'Traditional English; performance by CambridgeBayWeather',
    environment: 'britain_ireland',
    moods: ['everyday', 'origins', 'legacy'],
    tags: ['georgian', 'victorian-bridge', 'england'],
    history: {
      composer: null,
      tradition: 'English folk song',
      earliestAttestationYear: 1787,
      attestationNotes:
        'English folk air circulating in the late 18th century; printed collections appear by the turn of the 19th.',
      usableFromYear: 1787,
      usableToYear: 1900,
      geographicOrigin: 'England',
      supportableRegions: ['british_isles'],
      genre: 'English folk air',
      instrumentation: ['instrumental transcription'],
      authenticity: 'modern_interpretation',
      confidence: 'medium',
    },
    src: '/audio/soundtrack/britain-early-one-morning.mp3',
    gain: 0.4,
    playback: { loopCrossfadeSec: 3 },
    rights: {
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      source: 'Wikimedia Commons — File:Early_One_Morning.ogg',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Early_One_Morning.ogg',
      attribution: 'Early One Morning performance by CambridgeBayWeather (CC BY-SA 3.0)',
      verifiedBy: 'Atlas soundtrack research',
      verifiedOn: '2026-10-16',
      compositionNotes: 'Traditional English folk melody; composition public domain.',
      recordingNotes: 'Modern instrumental transcription licensed CC BY-SA 3.0.',
      durationSec: 103,
      recordingYear: 2009,
    },
  },
  {
    id: 'britain-londonderry-air',
    status: 'active',
    title: 'Londonderry Air',
    artist: 'Traditional Irish air; piano arrangement by Jon Hall',
    environment: 'britain_ireland',
    moods: ['everyday', 'legacy', 'origins'],
    tags: ['irish', 'romantic-era-collection'],
    history: {
      composer: null,
      tradition: 'Irish traditional air (Ulster)',
      earliestAttestationYear: 1855,
      attestationNotes:
        'First published in George Petrie’s 1855 collection of the ancient music of Ireland. Not attested as a 17th/early-18th-century repertoire piece.',
      usableFromYear: 1855,
      usableToYear: null,
      geographicOrigin: 'Ireland (Ulster)',
      supportableRegions: ['british_isles'],
      genre: 'Irish traditional air',
      instrumentation: ['piano'],
      authenticity: 'modern_interpretation',
      confidence: 'high',
    },
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
      compositionNotes: 'Irish air as published by Petrie (1855); melody public domain.',
      recordingNotes: 'Piano arrangement released into the public domain by Jon Hall.',
      durationSec: 144,
      recordingYear: 2010,
    },
  },
  {
    id: 'ireland-brian-boru-march',
    status: 'active',
    title: "Brian Boru's March",
    artist: 'Traditional Irish; United States Marine Band',
    environment: 'britain_ireland',
    moods: ['origins', 'conflict', 'migration'],
    tags: ['irish', 'pipe-march-tradition'],
    history: {
      composer: null,
      tradition: 'Irish march named for Brian Boru; pipe-band march form',
      earliestAttestationYear: 1800,
      attestationNotes:
        'Associated with Irish martial/pipe tradition; this march form is securely documented in the 19th century. Earlier legendary association is not treated as a secure composition date.',
      usableFromYear: 1800,
      usableToYear: 1950,
      geographicOrigin: 'Ireland',
      supportableRegions: ['british_isles'],
      genre: 'Irish march',
      instrumentation: ['concert band'],
      authenticity: 'modern_interpretation',
      confidence: 'medium',
    },
    src: '/audio/soundtrack/ireland-brian-boru-march.mp3',
    gain: 0.28,
    playback: { loopCrossfadeSec: 3 },
    rights: {
      license: 'Public Domain (US federal performance)',
      licenseUrl: 'https://commons.wikimedia.org/wiki/Commons:Copyright_tags#United_States',
      source: "Wikimedia Commons — Brian Boru's March, U.S. Marine Band",
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Brian_Boru%27s_March_-_U.S._Marine_Band.ogg',
      attribution: null,
      verifiedBy: 'Atlas soundtrack research',
      verifiedOn: '2026-10-16',
      compositionNotes: 'Traditional Irish march repertoire; composition treated as public domain.',
      recordingNotes: 'United States Marine Band performance — US federal government work.',
      durationSec: 147,
      recordingYear: null,
    },
  },
  {
    id: 'mexico-la-guacamaya',
    status: 'active',
    title: 'La Guacamaya (Son Jarocho)',
    artist: 'Soneros del Tesechoacán (field recording by Lenguaverde)',
    environment: 'mexico_southwest',
    moods: ['everyday', 'origins', 'migration'],
    tags: ['son-jarocho', 'veracruz'],
    history: {
      composer: null,
      tradition: 'Son jarocho (Veracruz)',
      earliestAttestationYear: 1780,
      attestationNotes:
        'Son jarocho as a regional practice is documented from the late 18th / 19th centuries in Veracruz. Not used as secure repertoire for early-colonial (pre-1780) New Spain.',
      usableFromYear: 1780,
      usableToYear: null,
      geographicOrigin: 'Veracruz, Mexico',
      supportableRegions: ['latin_america'],
      genre: 'son jarocho',
      instrumentation: ['jarana', 'requinto'],
      authenticity: 'modern_interpretation',
      confidence: 'medium',
    },
    src: '/audio/soundtrack/mexico-la-guacamaya.mp3',
    gain: 0.28,
    playback: { loopCrossfadeSec: 4 },
    rights: {
      license: 'CC0 1.0 Universal',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      source: 'Freesound #177562',
      sourceUrl: 'https://freesound.org/people/Lenguaverde/sounds/177562/',
      attribution: null,
      verifiedBy: 'Atlas soundtrack research',
      verifiedOn: '2026-10-16',
      compositionNotes: 'Traditional son jarocho repertoire.',
      recordingNotes: 'Field recording released CC0 by Lenguaverde (2012).',
      durationSec: 435,
      recordingYear: 2012,
    },
  },
  {
    id: 'iberia-spanish-romance',
    status: 'active',
    title: 'Romance Anónimo (Spanish Romance)',
    artist: 'Anonymous; performed by Jim Greeninger (Musopen)',
    environment: 'iberia',
    moods: ['everyday', 'origins', 'legacy'],
    tags: ['classical-guitar', 'romantic-era'],
    history: {
      composer: null,
      tradition: 'Spanish guitar romance (authorship disputed)',
      earliestAttestationYear: 1900,
      attestationNotes:
        'Widely circulated as a 19th/early-20th-century Spanish guitar romance; authorship disputed. Not treated as secure colonial-era (1600s–1700s) New Spain repertoire.',
      usableFromYear: 1850,
      usableToYear: null,
      geographicOrigin: 'Spain',
      supportableRegions: ['southern_europe'],
      genre: 'classical guitar romance',
      instrumentation: ['classical guitar'],
      authenticity: 'modern_interpretation',
      confidence: 'low',
    },
    src: '/audio/soundtrack/iberia-spanish-romance.mp3',
    gain: 0.4,
    playback: { loopCrossfadeSec: 3.5 },
    rights: {
      license: 'CC0 1.0 Universal',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      source: 'Musopen via Wikimedia Commons',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Romance_An%C3%B3nimo_(Jeux_interdits).ogg',
      attribution: null,
      verifiedBy: 'Atlas soundtrack research',
      verifiedOn: '2026-10-16',
      compositionNotes: 'Anonymous Spanish romance; treated as public domain on Musopen/Commons with uncertain dating.',
      recordingNotes: 'Jim Greeninger performance released under CC0.',
      durationSec: 167,
      recordingYear: null,
    },
  },
  {
    id: 'industrial-maple-leaf-rag',
    status: 'active',
    title: 'Maple Leaf Rag',
    artist: 'Scott Joplin; United States Marine Band',
    environment: 'industrial_america',
    moods: ['everyday', 'migration'],
    tags: ['ragtime', '1906-recording'],
    history: {
      composer: 'Scott Joplin',
      tradition: 'American ragtime',
      earliestAttestationYear: 1899,
      attestationNotes: 'Published 1899; this Marine Band recording dates from 1906.',
      usableFromYear: 1899,
      usableToYear: 1930,
      geographicOrigin: 'United States',
      supportableRegions: ['north_america'],
      genre: 'ragtime',
      instrumentation: ['military band'],
      authenticity: 'period_repertoire',
      confidence: 'high',
    },
    src: '/audio/soundtrack/industrial-america-maple-leaf-rag.mp3',
    gain: 0.3,
    playback: { loopCrossfadeSec: 3 },
    rights: {
      license: 'Public Domain (composition + pre-1926 / federal recording)',
      licenseUrl: 'https://commons.wikimedia.org/wiki/Commons:Copyright_tags/Country-specific_tags#United_States_of_America',
      source: 'Wikimedia Commons — 1906 U.S. Marine Band',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:1906_-_Scott_Joplin%27s_Maple_Leaf_Rag_(1899)_played_by_the_United_States_Marine_Band.ogg',
      attribution: null,
      verifiedBy: 'Atlas soundtrack research',
      verifiedOn: '2026-10-16',
      compositionNotes: 'Scott Joplin, Maple Leaf Rag (1899) — public domain.',
      recordingNotes: '1906 U.S. Marine Band — federal work and pre-1926 recording PD in the US.',
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
    tags: ['remembrance', 'not-1940s-popular-song'],
    history: {
      composer: 'Antonín Dvořák (theme); later song adaptation',
      tradition: 'Concert remembrance repertoire drawn from Symphony No. 9',
      earliestAttestationYear: 1893,
      attestationNotes:
        'Theme from Dvořák Symphony No. 9 (1893). Used here as restrained remembrance atmosphere for world-war contexts — not claimed as 1940s popular/military repertoire.',
      usableFromYear: 1914,
      usableToYear: 1955,
      geographicOrigin: 'Euro-American concert tradition',
      supportableRegions: 'any',
      genre: 'concert band / remembrance',
      instrumentation: ['concert band'],
      authenticity: 'cinematic_atmosphere',
      confidence: 'medium',
    },
    src: '/audio/soundtrack/wwii-goin-home.mp3',
    gain: 0.3,
    playback: { loopCrossfadeSec: 4 },
    rights: {
      license: 'Public Domain (composition PD; USAF federal performance)',
      licenseUrl: 'https://www.music.af.mil/Multimedia/Music/Public-Domain-Music/',
      source: 'US Air Force Public Domain Music via Commons',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Goin%27_Home_-_Concert_Band_-_United_States_Air_Force_Band.mp3',
      attribution: null,
      verifiedBy: 'Atlas soundtrack research',
      verifiedOn: '2026-10-16',
      compositionNotes: 'Dvořák theme (1893) public domain.',
      recordingNotes: 'USAF Band federal public-domain performance.',
      durationSec: 187,
      recordingYear: 2004,
    },
  },
  // Explicit coverage gaps (placeholders) — heavily needed by this family's data density.
  {
    id: 'placeholder-new-spain-baroque',
    status: 'placeholder',
    title: 'New Spain / early colonial Iberian guitar',
    environment: 'mexico_southwest',
    moods: ['origins', 'everyday'],
    tags: ['gap', '1600-1780', 'new-spain'],
    history: {
      composer: null,
      tradition: 'Iberian baroque guitar / villancico instrumental colour',
      earliestAttestationYear: 1674,
      attestationNotes: 'Target: Gaspar Sanz / Santiago de Murcia era repertoire with verified recording rights.',
      usableFromYear: 1600,
      usableToYear: 1780,
      geographicOrigin: 'Spain / New Spain',
      supportableRegions: ['latin_america', 'southern_europe'],
      genre: 'baroque guitar',
      instrumentation: ['baroque guitar'],
      authenticity: 'period_repertoire',
      confidence: 'medium',
    },
    src: null,
    rights: null,
    brief: 'Licensed or PD recording of Sanz/Murcia-era guitar suitable for 1600–1780 New Spain contexts.',
  },
  {
    id: 'placeholder-irish-early-modern',
    status: 'placeholder',
    title: 'Early modern Irish harp / air (pre-Petrie)',
    environment: 'britain_ireland',
    moods: ['origins', 'everyday'],
    tags: ['gap', '1600-1780', 'ireland'],
    history: {
      composer: null,
      tradition: 'Irish harp / early modern Gaelic air',
      earliestAttestationYear: 1600,
      attestationNotes: 'Need a tune with credible pre-1855 Irish attestation (e.g. securely early O’Carolan or earlier collection).',
      usableFromYear: 1600,
      usableToYear: 1780,
      geographicOrigin: 'Ireland',
      supportableRegions: ['british_isles'],
      genre: 'Irish traditional air',
      instrumentation: ['harp', 'fiddle'],
      authenticity: 'period_repertoire',
      confidence: 'medium',
    },
    src: null,
    rights: null,
    brief: 'Verified recording of an Irish air securely attested before the mid-19th century.',
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
