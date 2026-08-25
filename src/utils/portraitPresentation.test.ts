import { describe, expect, it } from 'vitest'
import { resolvePortraitPresentation } from './portraitPresentation'

describe('resolvePortraitPresentation', () => {
  it('keeps a reserved pending frame while availability is still loading', () => {
    expect(
      resolvePortraitPresentation({
        hasConcreteImage: false,
        availability: 'loading',
        decodeFailed: false,
      }),
    ).toBe('pending')
  })

  it('does not use the placeholder when a concrete portrait is already known', () => {
    expect(
      resolvePortraitPresentation({
        hasConcreteImage: true,
        availability: 'loading',
        decodeFailed: false,
      }),
    ).toBe('photo')
  })

  it('shows the placeholder only after availability resolves to none', () => {
    expect(
      resolvePortraitPresentation({
        hasConcreteImage: false,
        availability: 'empty',
        decodeFailed: false,
      }),
    ).toBe('placeholder')
  })

  it('falls back to the placeholder if the raster fails', () => {
    expect(
      resolvePortraitPresentation({
        hasConcreteImage: true,
        availability: 'ready',
        decodeFailed: true,
      }),
    ).toBe('placeholder')
  })
})
