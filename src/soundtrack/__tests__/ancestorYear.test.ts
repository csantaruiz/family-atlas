import { describe, expect, it } from 'vitest'
import { resolveAncestorSubjectYear } from '../context/ancestorYear'

describe('resolveAncestorSubjectYear', () => {
  it('never uses lifespan midpoint', () => {
    // Theresa Helene Jackson: 1925–1998 — midpoint would be ~1961 and wrongly skip period music.
    const result = resolveAncestorSubjectYear(1925, 1998, null)
    expect(result.year).toBe(1925)
    expect(result.source).toBe('birth')
    expect(result.year).not.toBe(1961)
  })

  it('prefers the timeline year when the ancestor was alive then', () => {
    const result = resolveAncestorSubjectYear(1925, 1998, 1944)
    expect(result.year).toBe(1944)
    expect(result.source).toBe('timeline_while_living')
  })

  it('falls back to birth when the timeline year is outside the life span', () => {
    const result = resolveAncestorSubjectYear(1925, 1998, 1910)
    expect(result.year).toBe(1925)
    expect(result.source).toBe('birth')
  })

  it('uses birth for living people without a death year (Alfred Ruiz pattern)', () => {
    const result = resolveAncestorSubjectYear(1943, null, null)
    expect(result.year).toBe(1943)
    expect(result.source).toBe('birth')
  })
})
