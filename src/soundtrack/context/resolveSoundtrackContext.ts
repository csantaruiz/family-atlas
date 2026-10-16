import type { SoundtrackCategoryId } from './categories'
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

export type SoundtrackContext = {
  category: SoundtrackCategoryId
  period: HistoricalPeriod | null
  region: WorldRegion | null
  /** True for broad overviews, which may return to the main theme sooner. */
  overview: boolean
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

/** Era-only choice for a year when nothing more specific is known. */
function categoryForEra(year: number, signals: SoundtrackSignals): SoundtrackCategoryId {
  if (isOriginsYear(year, signals)) return 'origins'
  if (isLegacyYear(year, signals)) return 'legacy'
  return 'everyday'
}

function context(
  category: SoundtrackCategoryId,
  year: number | null,
  places: readonly (string | null | undefined)[],
  reason: string,
  overview = false,
): SoundtrackContext {
  return {
    category,
    period: year != null ? periodForYear(year) : null,
    region: dominantGeography(places)?.region ?? null,
    overview,
    reason,
  }
}

function resolveFocus(focus: SoundtrackFocus, signals: SoundtrackSignals): SoundtrackContext {
  const year = focus.year != null ? midYear(focus.year, focus.yearEnd) : null
  const era = (fallback: string) =>
    context(year != null ? categoryForEra(year, signals) : 'everyday', year, focus.places, fallback)

  switch (focus.kind) {
    case 'historical_event':
      if (describesUpheaval(focus.text) || (year != null && isWorldWarYear(year))) {
        return context('conflict', year, focus.places, 'historical upheaval')
      }
      return era('historical event era')
    case 'migration':
      return context('migration', year, focus.places, 'migration route')
    case 'region':
      if (year != null && isOriginsYear(year, signals)) {
        return context('origins', year, focus.places, 'early region')
      }
      return context('migration', year, focus.places, 'family region')
    case 'family_event':
      if (focus.eventKind === 'move') return context('migration', year, focus.places, 'relocation')
      if (focus.eventKind === 'service') return context('conflict', year, focus.places, 'military service')
      if (focus.eventKind === 'epilogue') return context('legacy', year, focus.places, 'journey epilogue')
      return era('family event era')
    case 'ancestor': {
      const birth = focus.year
      if (birth != null && isOriginsYear(birth, signals)) {
        return context('origins', birth, focus.places, 'early ancestor')
      }
      if (birth != null && isLegacyYear(birth, signals)) {
        return context('legacy', birth, focus.places, 'recent generation')
      }
      const [first, last] = [focus.places[0], focus.places[focus.places.length - 1]]
      const from = geographyForPlace(first)?.region
      const to = geographyForPlace(last)?.region
      if (from && to && from !== to) return context('migration', year, focus.places, 'ancestor who emigrated')
      return context('everyday', year, focus.places, 'individual ancestor')
    }
    case 'insight':
      return era('insight era')
  }
}

/** Pure mapping from what the visitor is exploring to a musical atmosphere. */
export function resolveSoundtrackContext(signals: SoundtrackSignals): SoundtrackContext {
  if (signals.focus) return resolveFocus(signals.focus, signals)

  switch (signals.surface) {
    case 'about':
    case 'tree':
    case 'people':
      return context('main', null, [], 'family overview', true)
    case 'journeys':
      return context('migration', null, [], 'journeys map')
    case 'timeline': {
      const window = signals.window
      if (!window || window.coverage >= OVERVIEW_COVERAGE) {
        return context('main', null, [], 'timeline overview', true)
      }
      const year = (window.start + window.end) / 2
      const span = window.end - window.start
      const places = signals.windowPlaces
      if (span <= WARTIME_WINDOW_YEARS && isWorldWarYear(year)) {
        return context('conflict', year, places, 'wartime years')
      }
      if (isOriginsYear(year, signals)) return context('origins', year, places, 'early centuries')
      if (isLegacyYear(year, signals)) return context('legacy', year, places, 'recent decades')
      if (signals.migrationShare != null && signals.migrationShare >= MIGRATION_SHARE_THRESHOLD) {
        return context('migration', year, places, 'era of family moves')
      }
      return context('everyday', year, places, 'family era')
    }
  }
}
