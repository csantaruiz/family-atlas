import type { SoundtrackCategoryId } from './categories'
import { MAIN_ENVIRONMENT, type SoundtrackEnvironmentId } from './environments'
import { dominantGeography, geographyForPlace, type WorldRegion } from './geography'
import { describesUpheaval, isWorldWarYear, periodForYear, type HistoricalPeriod } from './periods'

/** Which part of the Atlas the visitor is looking at. */
export type SoundtrackSurface = 'timeline' | 'tree' | 'people' | 'journeys' | 'about'

export type SoundtrackFocusKind =
  | 'ancestor'
  | 'family_event'
  | 'historical_event'
  | 'migration'
  | 'region'
  | 'insight'

/** The single thing the visitor has settled on, described without Atlas types. */
export type SoundtrackFocus = {
  kind: SoundtrackFocusKind
  /** Stable identity so the same focus is never re-evaluated as a change. */
  id: string
  year: number | null
  yearEnd?: number | null
  /** Free-text places, most significant first (e.g. birth then death). */
  places: readonly (string | null | undefined)[]
  /** Family-event or journey-beat kind, e.g. 'move', 'service', 'epilogue'. */
  eventKind?: string
  /** Title or summary, used to recognise wars and upheavals. */
  text?: string
}

export type SoundtrackSignals = {
  surface: SoundtrackSurface
  presentYear: number
  /** Earliest and latest years in the loaded family; "early generations" are relative to these. */
  familyRange: { start: number; end: number }
  /** Visible timeline years and how much of the family span they cover (0–1). */
  window: { start: number; end: number; coverage: number } | null
  /** Share of visible family events that are relocations; null when too few to judge. */
  migrationShare: number | null
  /** Places of family events in the visible window, for regional colour while browsing. */
  windowPlaces: readonly string[]
  focus: SoundtrackFocus | null
}

/**
 * Geography + period choose a musical environment; narrative mood refines selection
 * when multiple tracks exist for that environment.
 */
export type SoundtrackContext = {
  environment: SoundtrackEnvironmentId
  mood: SoundtrackCategoryId
  period: HistoricalPeriod | null
  region: WorldRegion | null
  /** True for broad overviews, which may return to the main theme sooner. */
  overview: boolean
  /** True when the visitor explicitly selected a person, place, event, or route. */
  explicit: boolean
  reason: string
}

/** Timeline windows covering at least this share of the family span count as the overview. */
export const OVERVIEW_COVERAGE = 0.55
/** Windows narrower than this (years) inside a world war read as wartime. */
const WARTIME_WINDOW_YEARS = 30
const MIGRATION_SHARE_THRESHOLD = 0.3
/** Recent generations: within this many years of today. */
const LEGACY_YEARS = 50
const ORIGINS_ABSOLUTE_YEAR = 1700
/** The earliest fifth of a family's documented span counts as its origins. */
const ORIGINS_FAMILY_SHARE = 0.2

function midYear(start: number, end: number | null | undefined): number {
  return end != null && end > start ? (start + end) / 2 : start
}

function isOriginsYear(year: number, signals: SoundtrackSignals): boolean {
  const { start, end } = signals.familyRange
  const relative = start + (end - start) * ORIGINS_FAMILY_SHARE
  return year < ORIGINS_ABSOLUTE_YEAR || year < relative
}

function isLegacyYear(year: number, signals: SoundtrackSignals): boolean {
  return year >= signals.presentYear - LEGACY_YEARS
}

function moodForEra(year: number | null, signals: SoundtrackSignals): SoundtrackCategoryId {
  if (year == null) return 'everyday'
  if (isOriginsYear(year, signals)) return 'origins'
  if (isLegacyYear(year, signals)) return 'legacy'
  return 'everyday'
}

/** Geography + period → musical environment. Unsupported contexts fall back to main. */
export function environmentForPlaceAndPeriod(
  region: WorldRegion | null,
  period: HistoricalPeriod | null,
  opts: { wartimeHint?: boolean; militaryService?: boolean } = {},
): { environment: SoundtrackEnvironmentId; reason: string } {
  if (opts.militaryService && (period === 'world_wars' || opts.wartimeHint)) {
    return { environment: 'wwii_1940s', reason: 'documented military service in wartime years' }
  }
  if (period === 'world_wars' || opts.wartimeHint) {
    return { environment: 'wwii_1940s', reason: 'world-war years' }
  }
  if (region === 'latin_america') {
    return { environment: 'mexico_southwest', reason: 'Latin American geography' }
  }
  if (region === 'british_isles') {
    return { environment: 'britain_ireland', reason: 'Britain & Ireland geography' }
  }
  if (region === 'southern_europe') {
    return { environment: 'iberia', reason: 'Iberian / southern European geography' }
  }
  if (region === 'north_america' && (period === 'c19' || period === 'early_20th')) {
    return { environment: 'industrial_america', reason: 'industrial-era North America' }
  }
  return { environment: MAIN_ENVIRONMENT, reason: 'no matching regional catalog entry' }
}

function pack(
  environment: SoundtrackEnvironmentId,
  mood: SoundtrackCategoryId,
  year: number | null,
  places: readonly (string | null | undefined)[],
  reason: string,
  overview: boolean,
  explicit: boolean,
): SoundtrackContext {
  return {
    environment,
    mood,
    period: year != null ? periodForYear(year) : null,
    region: dominantGeography(places)?.region ?? null,
    overview,
    explicit,
    reason,
  }
}

function resolveFocus(focus: SoundtrackFocus, signals: SoundtrackSignals): SoundtrackContext {
  const year = focus.year != null ? midYear(focus.year, focus.yearEnd) : null
  const period = year != null ? periodForYear(year) : null
  const region = dominantGeography(focus.places)?.region ?? null
  const wartimeHint = Boolean(
    (year != null && isWorldWarYear(year)) || describesUpheaval(focus.text),
  )

  switch (focus.kind) {
    case 'historical_event': {
      const env = environmentForPlaceAndPeriod(region, period, {
        wartimeHint: wartimeHint || describesUpheaval(focus.text),
      })
      return pack(
        env.environment,
        wartimeHint || describesUpheaval(focus.text) ? 'conflict' : moodForEra(year, signals),
        year,
        focus.places,
        env.reason,
        false,
        true,
      )
    }
    case 'migration': {
      const env = environmentForPlaceAndPeriod(region, period)
      return pack(
        env.environment === MAIN_ENVIRONMENT ? env.environment : env.environment,
        'migration',
        year,
        focus.places,
        env.environment === MAIN_ENVIRONMENT ? 'migration without regional catalog match' : env.reason,
        false,
        true,
      )
    }
    case 'region': {
      const env = environmentForPlaceAndPeriod(region, period)
      const mood =
        year != null && isOriginsYear(year, signals) ? 'origins' : ('migration' as SoundtrackCategoryId)
      return pack(env.environment, mood, year, focus.places, env.reason, false, true)
    }
    case 'family_event': {
      if (focus.eventKind === 'service') {
        const env = environmentForPlaceAndPeriod(region, period, {
          militaryService: true,
          wartimeHint: wartimeHint || period === 'world_wars',
        })
        return pack(env.environment, 'conflict', year, focus.places, env.reason, false, true)
      }
      if (focus.eventKind === 'move') {
        const env = environmentForPlaceAndPeriod(region, period)
        return pack(env.environment, 'migration', year, focus.places, env.reason, false, true)
      }
      if (focus.eventKind === 'epilogue') {
        return pack(MAIN_ENVIRONMENT, 'legacy', year, focus.places, 'journey epilogue', false, true)
      }
      const env = environmentForPlaceAndPeriod(region, period, { wartimeHint })
      return pack(env.environment, moodForEra(year, signals), year, focus.places, env.reason, false, true)
    }
    case 'ancestor': {
      const birth = focus.year
      const [first, last] = [focus.places[0], focus.places[focus.places.length - 1]]
      const from = geographyForPlace(first)?.region
      const to = geographyForPlace(last)?.region
      const emigrated = Boolean(from && to && from !== to)
      // Prefer the birthplace region for the musical environment; destination colours migration mood.
      const env = environmentForPlaceAndPeriod(from ?? region, period, { wartimeHint })
      const mood: SoundtrackCategoryId = emigrated
        ? 'migration'
        : birth != null && isOriginsYear(birth, signals)
          ? 'origins'
          : birth != null && isLegacyYear(birth, signals)
            ? 'legacy'
            : 'everyday'
      return pack(env.environment, mood, year, focus.places, env.reason, false, true)
    }
    case 'insight': {
      const env = environmentForPlaceAndPeriod(region, period, { wartimeHint })
      return pack(env.environment, moodForEra(year, signals), year, focus.places, env.reason, false, true)
    }
  }
}

/** Pure mapping from what the visitor is exploring to a musical atmosphere. */
export function resolveSoundtrackContext(signals: SoundtrackSignals): SoundtrackContext {
  if (signals.focus) return resolveFocus(signals.focus, signals)

  switch (signals.surface) {
    case 'about':
    case 'tree':
    case 'people':
      return pack(MAIN_ENVIRONMENT, 'main', null, [], 'family overview', true, false)
    case 'journeys':
      return pack(MAIN_ENVIRONMENT, 'migration', null, [], 'journeys overview', true, false)
    case 'timeline': {
      const window = signals.window
      if (!window || window.coverage >= OVERVIEW_COVERAGE) {
        return pack(MAIN_ENVIRONMENT, 'main', null, [], 'timeline overview', true, false)
      }
      const year = (window.start + window.end) / 2
      const span = window.end - window.start
      const places = signals.windowPlaces
      const region = dominantGeography(places)?.region ?? null
      const period = periodForYear(year)
      const wartime = span <= WARTIME_WINDOW_YEARS && isWorldWarYear(year)
      const env = environmentForPlaceAndPeriod(region, period, { wartimeHint: wartime })

      let mood: SoundtrackCategoryId = 'everyday'
      if (wartime) mood = 'conflict'
      else if (isOriginsYear(year, signals)) mood = 'origins'
      else if (isLegacyYear(year, signals)) mood = 'legacy'
      else if (signals.migrationShare != null && signals.migrationShare >= MIGRATION_SHARE_THRESHOLD) {
        mood = 'migration'
      }

      return pack(
        env.environment,
        mood,
        year,
        places,
        env.environment === MAIN_ENVIRONMENT ? `${env.reason} (${mood} era)` : env.reason,
        false,
        false,
      )
    }
  }
}
