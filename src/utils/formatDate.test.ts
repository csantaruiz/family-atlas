import { describe, expect, it } from 'vitest'
import { formatAmericanDate, formatLifeSpan } from './formatDate'

describe('formatAmericanDate', () => {
  it('converts day-month-year GEDCOM dates', () => {
    expect(formatAmericanDate('16 July 1949')).toBe('July 16, 1949')
    expect(formatAmericanDate('4 Jun 1975')).toBe('June 4, 1975')
    expect(formatAmericanDate('1 Jul 1900')).toBe('July 1, 1900')
    expect(formatAmericanDate('11 Dec. 1938')).toBe('December 11, 1938')
    expect(formatAmericanDate('11 January 1941')).toBe('January 11, 1941')
    expect(formatAmericanDate('14 oct 1882')).toBe('October 14, 1882')
  })

  it('normalizes month-day-year variants', () => {
    expect(formatAmericanDate('Oct 11 1867')).toBe('October 11, 1867')
    expect(formatAmericanDate('Feb 8 1896')).toBe('February 8, 1896')
    expect(formatAmericanDate('March 28, 1932')).toBe('March 28, 1932')
    expect(formatAmericanDate('apr 5 1877')).toBe('April 5, 1877')
  })

  it('keeps month-year and year-only values readable', () => {
    expect(formatAmericanDate('Mar 1889')).toBe('March 1889')
    expect(formatAmericanDate('May 1679')).toBe('May 1679')
    expect(formatAmericanDate('1870')).toBe('1870')
    expect(formatAmericanDate(1975)).toBe('1975')
  })

  it('preserves uncertainty prefixes', () => {
    expect(formatAmericanDate('abt 1908')).toBe('about 1908')
    expect(formatAmericanDate('Abt Nov 1898')).toBe('about November 1898')
    expect(formatAmericanDate('Aft 1 Mar 1881')).toBe('after March 1, 1881')
    expect(formatAmericanDate('About:1869-00-00')).toBe('about 1869')
  })

  it('formats a life span line', () => {
    expect(formatLifeSpan('16 July 1949', '')).toBe('July 16, 1949 — Living')
    expect(formatLifeSpan('4 Jun 1975', '8 Jan 2020')).toBe('June 4, 1975 — January 8, 2020')
  })
})
