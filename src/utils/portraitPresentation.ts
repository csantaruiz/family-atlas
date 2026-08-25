export type PortraitAvailability = 'unknown' | 'loading' | 'empty' | 'ready' | 'failed'

export type PortraitPresentation = 'pending' | 'photo' | 'placeholder'

/** Decide the portrait chrome before the raster has necessarily decoded. */
export function resolvePortraitPresentation(input: {
  hasConcreteImage: boolean
  availability: PortraitAvailability
  decodeFailed: boolean
}): PortraitPresentation {
  if (input.decodeFailed) return 'placeholder'
  if (input.hasConcreteImage) return 'photo'
  if (input.availability === 'empty' || input.availability === 'failed') return 'placeholder'
  return 'pending'
}
