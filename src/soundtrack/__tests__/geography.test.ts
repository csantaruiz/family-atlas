import { describe, expect, it } from 'vitest'
import { dominantGeography, geographyForPlace } from '../context/geography'

describe('geographyForPlace', () => {
  it('maps free-text places to coarse world regions without family-specific rules', () => {
    expect(geographyForPlace('Cheshire, England')?.region).toBe('british_isles')
    expect(geographyForPlace('Chihuahua, Mexico')?.region).toBe('latin_america')
    expect(geographyForPlace('Philadelphia, Pennsylvania, United States')?.region).toBe(
      'north_america',
    )
    expect(geographyForPlace('Madrid, Spain')?.region).toBe('southern_europe')
  })

  it('returns the dominant region across a window of places', () => {
    const geo = dominantGeography([
      'England',
      'Cheshire, England',
      'Mexico',
      'Sandbach, Cheshire, England',
    ])
    expect(geo?.region).toBe('british_isles')
  })
})
