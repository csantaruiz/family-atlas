import { getCuratedPersonPortrait } from '../data/personPortraits'
import { portraitPlaceholderForSex } from '../data/portraitPlaceholder'
import type { Person, PersonImage } from '../types'
import { getPersonPortrait } from './personPortraitStore'

export type ResolvedPersonPortrait = {
  image: PersonImage
  /** True when showing the silhouette / unavailable treatment. */
  isUnavailablePlaceholder: boolean
}

/**
 * Portrait precedence for family people:
 * 1. Person.image on the database record
 * 2. Curated file in src/assets/portraits/people/{id}.*
 * 3. Private Atlas cloud upload (media_assets → /api/media/:id)
 * 4. Sexed silhouette placeholder
 */
export function resolvePersonPortrait(
  person: Pick<Person, 'id' | 'name' | 'sex' | 'image'>,
  uploaded?: PersonImage,
): ResolvedPersonPortrait {
  const curated = getCuratedPersonPortrait(person.id, person.name)
  const localUpload = uploaded ?? getPersonPortrait(person.id)
  const image = person.image ?? curated ?? localUpload ?? portraitPlaceholderForSex(person.sex)
  const isUnavailablePlaceholder = !person.image && !curated && !localUpload
  return { image, isUnavailablePlaceholder }
}
