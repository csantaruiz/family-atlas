export type HistoricalPeriod =
  | 'medieval_early_modern'
  | 'c17_18'
  | 'c19'
  | 'early_20th'
  | 'world_wars'
  | 'postwar'
  | 'contemporary'

export const HISTORICAL_PERIODS: readonly HistoricalPeriod[] = [
  'medieval_early_modern',
  'c17_18',
  'c19',
  'early_20th',
  'world_wars',
  'postwar',
  'contemporary',
]

const WORLD_WAR_YEARS: readonly [number, number][] = [
  [1914, 1918],
  [1939, 1945],
]

export function isWorldWarYear(year: number): boolean {
  return WORLD_WAR_YEARS.some(([start, end]) => year >= start && year <= end)
}

export function periodForYear(year: number): HistoricalPeriod {
  if (year < 1600) return 'medieval_early_modern'
  if (year < 1800) return 'c17_18'
  if (year < 1900) return 'c19'
  if (isWorldWarYear(year)) return 'world_wars'
  if (year < 1946) return 'early_20th'
  if (year < 1990) return 'postwar'
  return 'contemporary'
}

const UPHEAVAL_PATTERN =
  /\b(wars?|warfare|revolution|revolt|rebellion|uprising|insurrection|invasion|siege|battle|conquest|occupation|famine|plague|pandemic|epidemic|depression|genocide|holocaust|attacks?|independence|blitz|armistice)\b/i

/** True for titles such as "Mexican War of Independence" or "Great Depression". */
export function describesUpheaval(text: string | null | undefined): boolean {
  return Boolean(text && UPHEAVAL_PATTERN.test(text))
}
