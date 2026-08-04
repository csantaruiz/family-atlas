import type { PersonImage } from '../types'
import silhouetteFemale from '../assets/portraits/silhouette-female.png'
import silhouetteMale from '../assets/portraits/silhouette-male.png'
import silhouetteNeutral from '../assets/portraits/silhouette-neutral.png'

export type PortraitSex = 'M' | 'F' | 'unknown'

function normalizePortraitSex(sex?: string | null): PortraitSex {
  const value = sex?.trim().toUpperCase()
  if (value === 'M' || value === 'MALE') return 'M'
  if (value === 'F' || value === 'FEMALE') return 'F'
  return 'unknown'
}

const MALE_SILHOUETTE_PLACEHOLDER: PersonImage = {
  src: silhouetteMale,
  alt: 'Vintage male portrait silhouette placeholder',
  caption: 'Portrait unavailable',
  isPlaceholder: true,
}

const FEMALE_SILHOUETTE_PLACEHOLDER: PersonImage = {
  src: silhouetteFemale,
  alt: 'Vintage female portrait silhouette placeholder',
  caption: 'Portrait unavailable',
  isPlaceholder: true,
}

const NEUTRAL_SILHOUETTE_PLACEHOLDER: PersonImage = {
  src: silhouetteNeutral,
  alt: 'Vintage portrait silhouette placeholder',
  caption: 'Portrait unavailable',
  isPlaceholder: true,
}

/** Gendered vintage portrait placeholders when a person has no photograph. */
export function portraitPlaceholderForSex(sex?: string | null): PersonImage {
  const side = normalizePortraitSex(sex)
  if (side === 'M') return MALE_SILHOUETTE_PLACEHOLDER
  if (side === 'F') return FEMALE_SILHOUETTE_PLACEHOLDER
  return NEUTRAL_SILHOUETTE_PLACEHOLDER
}

/** @deprecated Prefer `portraitPlaceholderForSex` — kept for documentary fallbacks. */
export const ARCHIVAL_PORTRAIT_PLACEHOLDER = NEUTRAL_SILHOUETTE_PLACEHOLDER
