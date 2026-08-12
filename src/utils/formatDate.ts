const MONTHS: Record<string, string> = {
  jan: 'January',
  january: 'January',
  feb: 'February',
  february: 'February',
  mar: 'March',
  march: 'March',
  apr: 'April',
  april: 'April',
  may: 'May',
  jun: 'June',
  june: 'June',
  jul: 'July',
  july: 'July',
  aug: 'August',
  august: 'August',
  sep: 'September',
  sept: 'September',
  september: 'September',
  oct: 'October',
  october: 'October',
  nov: 'November',
  november: 'November',
  dec: 'December',
  december: 'December',
}

const QUALIFIERS: Record<string, string> = {
  abt: 'about',
  about: 'about',
  aft: 'after',
  after: 'after',
  bef: 'before',
  before: 'before',
  cal: 'calculated',
  est: 'estimated',
  circ: 'circa',
  circa: 'circa',
}

function monthName(token: string): string | null {
  return MONTHS[token.toLowerCase()] ?? null
}

function withQualifier(qualifier: string, rest: string): string {
  return qualifier ? `${qualifier} ${rest}` : rest
}

/**
 * Display GEDCOM-style dates in American form: July 16, 1949.
 * Keeps year-only and month-year values, and preserves uncertainty prefixes.
 */
export function formatAmericanDate(raw: string | number | null | undefined): string {
  if (raw == null) return ''
  if (typeof raw === 'number') return String(raw)

  const original = raw.trim()
  if (!original) return ''

  const aboutIso = original.match(/^about:(\d{4})(?:-\d{2}(?:-\d{2})?)?$/i)
  if (aboutIso) return `about ${aboutIso[1]}`

  let text = original.replace(/\./g, '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim()

  let qualifier = ''
  const qualifierMatch = text.match(/^(abt|about|aft|after|bef|before|cal|est|circ|circa)\s+/i)
  if (qualifierMatch) {
    qualifier = QUALIFIERS[qualifierMatch[1].toLowerCase()] ?? qualifierMatch[1].toLowerCase()
    text = text.slice(qualifierMatch[0].length).trim()
  }

  if (/^\d{3,4}$/.test(text)) return withQualifier(qualifier, text)

  const between = text.match(/^bet(?:ween)?\s+(.+?)\s+and\s+(.+)$/i)
  if (between) {
    const start = formatAmericanDate(between[1])
    const end = formatAmericanDate(between[2])
    if (start && end) return withQualifier(qualifier, `${start}–${end}`)
  }

  let match = text.match(/^([A-Za-z]+)\s+(\d{3,4})$/)
  if (match) {
    const month = monthName(match[1])
    if (month) return withQualifier(qualifier, `${month} ${match[2]}`)
  }

  match = text.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{3,4})$/)
  if (match) {
    const month = monthName(match[2])
    if (month) return withQualifier(qualifier, `${month} ${Number(match[1])}, ${match[3]}`)
  }

  match = text.match(/^([A-Za-z]+)\s+(\d{1,2})\s+(\d{3,4})$/)
  if (match) {
    const month = monthName(match[1])
    if (month) return withQualifier(qualifier, `${month} ${Number(match[2])}, ${match[3]}`)
  }

  return original
}

export function formatLifeSpan(
  birth: string | number | null | undefined,
  death: string | number | null | undefined,
  livingLabel = 'Living',
): string {
  const born = formatAmericanDate(birth) || 'Birth unknown'
  const died = formatAmericanDate(death) || livingLabel
  return `${born} — ${died}`
}
