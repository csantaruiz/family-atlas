/**
 * Structured GEDCOM DATE parsing for diagnostics.
 * Does not replace extractGedcomYear — display/timeline years stay on that legacy helper.
 */

export type GedcomDateQualifier =
  | 'exact'
  | 'about'
  | 'before'
  | 'after'
  | 'range'
  | 'from-to'
  | 'unknown'

export type GedcomDatePrecision = 'day' | 'month' | 'year' | 'none'

export type ParsedGedcomDate = {
  raw: string
  qualifier: GedcomDateQualifier
  precision: GedcomDatePrecision
  year: number | null
  month: number | null
  day: number | null
  earliestYear: number | null
  latestYear: number | null
  calendarValid: boolean
  malformed: boolean
  /** Exact enough for high-confidence contradiction checks. */
  reliableForContradiction: boolean
}

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

const YEAR_RE = /\b(\d{3,4})\b/g

function plausibleYear(year: number): boolean {
  return year >= 1000 && year <= 2100
}

function monthNumber(token: string): number | null {
  const key = token.replace(/\./g, '').toLowerCase()
  return MONTHS[key] ?? null
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function lastPlausibleYear(text: string): number | null {
  YEAR_RE.lastIndex = 0
  const years: number[] = []
  let match: RegExpExecArray | null
  while ((match = YEAR_RE.exec(text))) {
    const year = Number(match[1])
    if (plausibleYear(year)) years.push(year)
  }
  return years.length ? years[years.length - 1] : null
}

type DateAtom = {
  year: number | null
  month: number | null
  day: number | null
  precision: GedcomDatePrecision
  calendarValid: boolean
  malformed: boolean
}

function emptyAtom(): DateAtom {
  return {
    year: null,
    month: null,
    day: null,
    precision: 'none',
    calendarValid: true,
    malformed: false,
  }
}

function parseDateAtom(text: string): DateAtom {
  const trimmed = text.trim().replace(/,/g, ' ').replace(/\s+/g, ' ')
  if (!trimmed) return emptyAtom()

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    const year = Number(iso[1])
    const month = Number(iso[2])
    const day = Number(iso[3])
    if (!plausibleYear(year)) return { ...emptyAtom(), malformed: true }
    if (month === 0 && day === 0) {
      return { year, month: null, day: null, precision: 'year', calendarValid: true, malformed: false }
    }
    if (month < 1 || month > 12) {
      return { year, month, day, precision: 'day', calendarValid: false, malformed: true }
    }
    if (day === 0) {
      return { year, month, day: null, precision: 'month', calendarValid: true, malformed: false }
    }
    const valid = day >= 1 && day <= daysInMonth(year, month)
    return { year, month, day, precision: 'day', calendarValid: valid, malformed: !valid }
  }

  const dmy = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{3,4})$/)
  if (dmy) {
    const day = Number(dmy[1])
    const month = monthNumber(dmy[2])
    const year = Number(dmy[3])
    if (!month || !plausibleYear(year)) {
      return { year: plausibleYear(year) ? year : null, month, day, precision: 'day', calendarValid: false, malformed: true }
    }
    const valid = day >= 1 && day <= daysInMonth(year, month)
    return { year, month, day, precision: 'day', calendarValid: valid, malformed: !valid }
  }

  const mdy = trimmed.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})\s+(\d{3,4})$/)
  if (mdy) {
    const month = monthNumber(mdy[1])
    const day = Number(mdy[2])
    const year = Number(mdy[3])
    if (!month || !plausibleYear(year)) {
      return { year: plausibleYear(year) ? year : null, month, day, precision: 'day', calendarValid: false, malformed: true }
    }
    const valid = day >= 1 && day <= daysInMonth(year, month)
    return { year, month, day, precision: 'day', calendarValid: valid, malformed: !valid }
  }

  const my = trimmed.match(/^([A-Za-z]{3,9})\.?\s+(\d{3,4})$/)
  if (my) {
    const month = monthNumber(my[1])
    const year = Number(my[2])
    if (!month || !plausibleYear(year)) {
      return { year: plausibleYear(year) ? year : lastPlausibleYear(trimmed), month, day: null, precision: 'month', calendarValid: false, malformed: true }
    }
    return { year, month, day: null, precision: 'month', calendarValid: true, malformed: false }
  }

  const yearOnly = trimmed.match(/^(\d{3,4})$/)
  if (yearOnly) {
    const year = Number(yearOnly[1])
    if (!plausibleYear(year)) return { ...emptyAtom(), malformed: true }
    return { year, month: null, day: null, precision: 'year', calendarValid: true, malformed: false }
  }

  const year = lastPlausibleYear(trimmed)
  if (year) {
    return { year, month: null, day: null, precision: 'year', calendarValid: true, malformed: true }
  }

  if (/^\d{1,3}$/.test(trimmed)) {
    return { ...emptyAtom(), malformed: true }
  }

  return { ...emptyAtom(), malformed: true }
}

function withReliability(parsed: Omit<ParsedGedcomDate, 'reliableForContradiction'>): ParsedGedcomDate {
  const reliableForContradiction =
    !parsed.malformed &&
    parsed.calendarValid &&
    parsed.qualifier === 'exact' &&
    (parsed.precision === 'day' || parsed.precision === 'month') &&
    parsed.year != null &&
    parsed.year >= 1700
  return { ...parsed, reliableForContradiction }
}

function fromAtom(
  raw: string,
  qualifier: GedcomDateQualifier,
  atom: DateAtom,
  earliestYear: number | null,
  latestYear: number | null,
): ParsedGedcomDate {
  return withReliability({
    raw,
    qualifier,
    precision: atom.precision,
    year: atom.year,
    month: atom.month,
    day: atom.day,
    earliestYear,
    latestYear,
    calendarValid: atom.calendarValid,
    malformed: atom.malformed,
  })
}

export function parseGedcomDate(raw: string | null | undefined): ParsedGedcomDate {
  const text = (raw ?? '').trim()
  if (!text) {
    return withReliability({
      raw: '',
      qualifier: 'unknown',
      precision: 'none',
      year: null,
      month: null,
      day: null,
      earliestYear: null,
      latestYear: null,
      calendarValid: true,
      malformed: false,
    })
  }

  const upper = text.replace(/\s+/g, ' ')
  const bet = upper.match(/^(?:BET|BETWEEN)\s+(.+?)\s+AND\s+(.+)$/i)
  if (bet) {
    const from = parseDateAtom(bet[1])
    const to = parseDateAtom(bet[2])
    const earliest = from.year
    const latest = to.year
    return withReliability({
      raw: text,
      qualifier: 'range',
      precision: from.precision === to.precision ? from.precision : 'year',
      year: latest,
      month: to.month,
      day: to.day,
      earliestYear: earliest,
      latestYear: latest,
      calendarValid: from.calendarValid && to.calendarValid,
      malformed: from.malformed || to.malformed || earliest == null || latest == null,
    })
  }

  const fromTo = upper.match(/^(?:FROM)\s+(.+?)\s+TO\s+(.+)$/i)
  if (fromTo) {
    const from = parseDateAtom(fromTo[1])
    const to = parseDateAtom(fromTo[2])
    return withReliability({
      raw: text,
      qualifier: 'from-to',
      precision: from.precision === to.precision ? from.precision : 'year',
      year: to.year,
      month: to.month,
      day: to.day,
      earliestYear: from.year,
      latestYear: to.year,
      calendarValid: from.calendarValid && to.calendarValid,
      malformed: from.malformed || to.malformed,
    })
  }

  const about = upper.match(/^(?:ABT|ABOUT|CAL|EST|ESTIMATED|CIR|CIRCA|C\.?)\s*:?\s*(.+)$/i)
  if (about) {
    const atom = parseDateAtom(about[1])
    return fromAtom(text, 'about', atom, atom.year, atom.year)
  }

  const aboutIso = text.match(/^About:(\d{4})(?:-\d{2}-\d{2})?$/i)
  if (aboutIso) {
    const year = Number(aboutIso[1])
    const atom: DateAtom = {
      year: plausibleYear(year) ? year : null,
      month: null,
      day: null,
      precision: 'year',
      calendarValid: true,
      malformed: !plausibleYear(year),
    }
    return fromAtom(text, 'about', atom, atom.year, atom.year)
  }

  const before = upper.match(/^(?:BEF|BEFORE)\s+(.+)$/i)
  if (before) {
    const atom = parseDateAtom(before[1])
    const latest = atom.year == null ? null : atom.precision === 'year' ? atom.year - 1 : atom.year
    return fromAtom(text, 'before', atom, null, latest)
  }

  const after = upper.match(/^(?:AFT|AFTER)\s+(.+)$/i)
  if (after) {
    const atom = parseDateAtom(after[1])
    return fromAtom(text, 'after', atom, atom.year, null)
  }

  const atom = parseDateAtom(text)
  return fromAtom(text, atom.malformed ? 'unknown' : 'exact', atom, atom.year, atom.year)
}

export function dateRangesDisjoint(earlier: ParsedGedcomDate, later: ParsedGedcomDate): boolean {
  if (earlier.latestYear == null || later.earliestYear == null) return false
  return earlier.latestYear < later.earliestYear
}
