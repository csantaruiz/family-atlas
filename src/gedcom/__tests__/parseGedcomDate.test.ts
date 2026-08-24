import { describe, expect, it } from 'vitest'
import { extractGedcomYear } from '../parseGedcom'
import { parseGedcomDate } from '../parseGedcomDate'

describe('parseGedcomDate', () => {
  it('parses exact day/month/year without inventing extra precision', () => {
    const parsed = parseGedcomDate('4 Jun 1975')
    expect(parsed.qualifier).toBe('exact')
    expect(parsed.precision).toBe('day')
    expect(parsed.year).toBe(1975)
    expect(parsed.month).toBe(6)
    expect(parsed.day).toBe(4)
    expect(parsed.earliestYear).toBe(1975)
    expect(parsed.latestYear).toBe(1975)
    expect(parsed.reliableForContradiction).toBe(true)
    expect(parsed.malformed).toBe(false)
  })

  it('parses month/day/year order used in some Ancestry strings', () => {
    const parsed = parseGedcomDate('apr 5 1877')
    expect(parsed.qualifier).toBe('exact')
    expect(parsed.precision).toBe('day')
    expect(parsed.year).toBe(1877)
    expect(parsed.month).toBe(4)
    expect(parsed.day).toBe(5)
    expect(parsed.reliableForContradiction).toBe(true)
  })

  it('parses year-only dates as year precision, not exact days', () => {
    const parsed = parseGedcomDate('1850')
    expect(parsed.qualifier).toBe('exact')
    expect(parsed.precision).toBe('year')
    expect(parsed.year).toBe(1850)
    expect(parsed.reliableForContradiction).toBe(false)
  })

  it('treats ABT / BEF / AFT as uncertain bounds, not exact years', () => {
    const about = parseGedcomDate('Abt 1908')
    expect(about.qualifier).toBe('about')
    expect(about.year).toBe(1908)
    expect(about.reliableForContradiction).toBe(false)

    const before = parseGedcomDate('BEF 1900')
    expect(before.qualifier).toBe('before')
    expect(before.latestYear).toBe(1899)
    expect(before.reliableForContradiction).toBe(false)

    const after = parseGedcomDate('Aft 1 Mar 1881')
    expect(after.qualifier).toBe('after')
    expect(after.earliestYear).toBe(1881)
    expect(after.latestYear).toBeNull()
    expect(after.reliableForContradiction).toBe(false)
  })

  it('keeps BET/AND as a range instead of collapsing to the last year', () => {
    const parsed = parseGedcomDate('BET 1840 AND 1845')
    expect(parsed.qualifier).toBe('range')
    expect(parsed.earliestYear).toBe(1840)
    expect(parsed.latestYear).toBe(1845)
    expect(parsed.reliableForContradiction).toBe(false)
    expect(extractGedcomYear('BET 1840 AND 1845')).toBe(1845)
  })

  it('marks malformed and impossible calendar dates', () => {
    expect(parseGedcomDate('69').malformed).toBe(true)
    expect(parseGedcomDate('31 Feb 1900').calendarValid).toBe(false)
    expect(parseGedcomDate('29 Feb 1900').calendarValid).toBe(false)
    expect(parseGedcomDate('29 Feb 1904').calendarValid).toBe(true)
  })
})
