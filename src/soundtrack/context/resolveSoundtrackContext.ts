import { resolveAncestorSubjectYear } from './ancestorYear'
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
  /**
   * Stable timeline center year (when on the timeline). Used for ancestor year
   * resolution when the ancestor was alive then — never from camera zoom alone.
   */
  timelineYear: number | null
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
 * Historical subject for soundtrack selection.
 * Track choice is driven primarily by subjectYear + region; environment/mood refine.
 */
export type SoundtrackContext = {
  environment: SoundtrackEnvironmentId
  mood: SoundtrackCategoryId
  /** Defensible year of the focused subject (not merely camera zoom). */
  subjectYear: number | null
  /** How subjectYear was chosen (for Soundtrack Lab transparency). */
  yearSource: string | null
  period: HistoricalPeriod | null
  region: WorldRegion | null
  /** True for broad overviews, which may return to the main theme sooner. */
  overview: boolean
  /** True when the visitor explicitly selected a person, place, event, or route. */
  explicit: boolean
  /** Precedence tier that produced this context. */
  precedence: 'historical_event' | 'ancestor_or_story' | 'focused_geo_temporal' | 'viewport' | 'overview'
  reason: string
  /** Focus identity when an explicit panel is open; null when restored to underlying Atlas. */
  focusId: string | null
}

/** Timeline windows covering at least this share of the family span count as the overview. */
export const OVERVIEW_COVERAGE = 0.55
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
  opts: { wartimeContext?: boolean; militaryService?: boolean } = {},
): { environment: SoundtrackEnvironmentId; reason: string } {
  // Wartime soundtrack only for explicit war/service contexts — not merely "born in 1943".
  if (opts.militaryService) {
    return { environment: 'wwii_1940s', reason: 'documented military service' }
  }
  if (opts.wartimeContext) {
    return { environment: 'wwii_1940s', reason: 'explicit wartime / upheaval context' }
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
  if (
    region === 'north_america' &&
    (period === 'c19' ||
      period === 'early_20th' ||
      period === 'world_wars' ||
      period === 'postwar')
  ) {
    return { environment: 'industrial_america', reason: 'North American family geography' }
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
  precedence: SoundtrackContext['precedence'],
  extras: { yearSource?: string | null; focusId?: string | null } = {},
): SoundtrackContext {
  return {
    environment,
    mood,
    subjectYear: year,
    yearSource: extras.yearSource ?? (year != null ? 'subject date' : null),
    period: year != null ? periodForYear(year) : null,
    region: dominantGeography(places)?.region ?? null,
    overview,
    explicit,
    precedence,
    reason,
    focusId: extras.focusId ?? null,
  }
}

function resolveFocus(focus: SoundtrackFocus, signals: SoundtrackSignals): SoundtrackContext {
  const region = dominantGeography(focus.places)?.region ?? null
  const upheaval = describesUpheaval(focus.text)
  const focusExtras = { focusId: focus.id }

  switch (focus.kind) {
    case 'historical_event': {
      const year = focus.year != null ? midYear(focus.year, focus.yearEnd) : null
      const period = year != null ? periodForYear(year) : null
      const wartimeContext = upheaval || (year != null && isWorldWarYear(year))
      const env = environmentForPlaceAndPeriod(region, period, { wartimeContext })
      return pack(
        env.environment,
        wartimeContext ? 'conflict' : moodForEra(year, signals),
        year,
        focus.places,
        env.reason,
        false,
        true,
        'historical_event',
        { ...focusExtras, yearSource: year != null ? 'historical event date' : null },
      )
    }
    case 'migration': {
      const year = focus.year != null ? midYear(focus.year, focus.yearEnd) : null
      const period = year != null ? periodForYear(year) : null
      const env = environmentForPlaceAndPeriod(region, period)
      return pack(
        env.environment,
        'migration',
        year,
        focus.places,
        env.environment === MAIN_ENVIRONMENT ? 'migration without regional catalog match' : env.reason,
        false,
        true,
        'focused_geo_temporal',
        { ...focusExtras, yearSource: year != null ? 'migration / journey date' : null },
      )
    }
    case 'region': {
      const year = focus.year != null ? midYear(focus.year, focus.yearEnd) : null
      const period = year != null ? periodForYear(year) : null
      const env = environmentForPlaceAndPeriod(region, period)
      const mood =
        year != null && isOriginsYear(year, signals) ? 'origins' : ('migration' as SoundtrackCategoryId)
      return pack(
        env.environment,
        mood,
        year,
        focus.places,
        env.reason,
        false,
        true,
        'focused_geo_temporal',
        { ...focusExtras, yearSource: year != null ? 'region date range' : null },
      )
    }
    case 'family_event': {
      const year = focus.year != null ? midYear(focus.year, focus.yearEnd) : null
      const period = year != null ? periodForYear(year) : null
      if (focus.eventKind === 'service') {
        const env = environmentForPlaceAndPeriod(region, period, { militaryService: true })
        return pack(
          env.environment,
          'conflict',
          year,
          focus.places,
          env.reason,
          false,
          true,
          'ancestor_or_story',
          { ...focusExtras, yearSource: year != null ? 'service event date' : null },
        )
      }
      if (focus.eventKind === 'move') {
        const env = environmentForPlaceAndPeriod(region, period)
        return pack(
          env.environment,
          'migration',
          year,
          focus.places,
          env.reason,
          false,
          true,
          'ancestor_or_story',
          { ...focusExtras, yearSource: year != null ? 'move event date' : null },
        )
      }
      if (focus.eventKind === 'epilogue') {
        return pack(
          MAIN_ENVIRONMENT,
          'legacy',
          year,
          focus.places,
          'journey epilogue',
          false,
          true,
          'ancestor_or_story',
          { ...focusExtras, yearSource: year != null ? 'epilogue date' : null },
        )
      }
      const wartimeContext = upheaval
      const env = environmentForPlaceAndPeriod(region, period, { wartimeContext })
      return pack(
        env.environment,
        wartimeContext ? 'conflict' : moodForEra(year, signals),
        year,
        focus.places,
        env.reason,
        false,
        true,
        'ancestor_or_story',
        { ...focusExtras, yearSource: year != null ? 'family event date' : null },
      )
    }
    case 'ancestor': {
      // Never lifespan midpoint — prefer timeline year while living, else birth.
      const resolved = resolveAncestorSubjectYear(focus.year, focus.yearEnd ?? null, signals.timelineYear)
      const year = resolved.year
      const period = year != null ? periodForYear(year) : null
      const [first, last] = [focus.places[0], focus.places[focus.places.length - 1]]
      const from = geographyForPlace(first)?.region
      const to = geographyForPlace(last)?.region
      const emigrated = Boolean(from && to && from !== to)
      // Civilian ancestor profiles are not wartime contexts merely because birth falls in 1939–45.
      const env = environmentForPlaceAndPeriod(from ?? region, period, { wartimeContext: false })
      const mood: SoundtrackCategoryId = emigrated
        ? 'migration'
        : year != null && isOriginsYear(year, signals)
          ? 'origins'
          : year != null && isLegacyYear(year, signals)
            ? 'legacy'
            : 'everyday'
      return pack(
        env.environment,
        mood,
        year,
        focus.places,
        `${env.reason}; ${resolved.reason}`,
        false,
        true,
        'ancestor_or_story',
        { ...focusExtras, yearSource: resolved.reason },
      )
    }
    case 'insight': {
      const year = focus.year != null ? midYear(focus.year, focus.yearEnd) : null
      const period = year != null ? periodForYear(year) : null
      const wartimeContext = upheaval
      const env = environmentForPlaceAndPeriod(region, period, { wartimeContext })
      return pack(
        env.environment,
        wartimeContext ? 'conflict' : moodForEra(year, signals),
        year,
        focus.places,
        env.reason,
        false,
        true,
        'ancestor_or_story',
        { ...focusExtras, yearSource: year != null ? 'insight date range' : null },
      )
    }
  }
}

/**
 * Pure mapping from what the visitor is exploring to a musical atmosphere.
 *
 * Phase 2.3: with no explicit panel/journey focus, the base Atlas soundtrack is always
 * History Documentary. Passive timeline zoom must not keep (or reselect) period music
 * after a description panel closes.
 */
export function resolveSoundtrackContext(signals: SoundtrackSignals): SoundtrackContext {
  // Explicit panel / selection always wins over the base Atlas soundtrack.
  if (signals.focus) return resolveFocus(signals.focus, signals)

  // Base layer — documentary theme for every surface when nothing is explicitly open.
  switch (signals.surface) {
    case 'journeys':
      return pack(MAIN_ENVIRONMENT, 'migration', null, [], 'journeys overview', true, false, 'overview', {
        yearSource: null,
        focusId: null,
      })
    case 'about':
    case 'tree':
    case 'people':
    case 'timeline':
      return pack(
        MAIN_ENVIRONMENT,
        'main',
        null,
        [],
        'base Atlas soundtrack (History Documentary)',
        true,
        false,
        'overview',
        { yearSource: null, focusId: null },
      )
  }
}
