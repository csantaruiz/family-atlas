export type SoundtrackCategoryId = 'main' | 'origins' | 'migration' | 'everyday' | 'conflict' | 'legacy'

export type SoundtrackCategory = {
  id: SoundtrackCategoryId
  label: string
  /** When the Atlas reaches for this atmosphere. */
  usage: string
}

/** Ordered; the first entry is the signature theme every other category falls back to. */
export const SOUNDTRACK_CATEGORIES: readonly SoundtrackCategory[] = [
  { id: 'main', label: 'Main Theme', usage: 'Opening and broad family overview' },
  { id: 'origins', label: 'Origins', usage: 'Early generations and distant historical periods' },
  {
    id: 'migration',
    label: 'Exploration & Migration',
    usage: 'Geographic movement, discovery and family relocation',
  },
  {
    id: 'everyday',
    label: 'Everyday Life',
    usage: 'Intimate, reflective exploration of individual ancestors and families',
  },
  {
    id: 'conflict',
    label: 'Conflict & Upheaval',
    usage: 'Wars, major historical disruptions and periods of uncertainty',
  },
  {
    id: 'legacy',
    label: 'Reflection & Legacy',
    usage: 'Recent generations, remembrance and the present day',
  },
]

export const MAIN_CATEGORY: SoundtrackCategoryId = 'main'
