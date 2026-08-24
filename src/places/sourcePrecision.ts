import type { GeographicPrecision, ParsedPlaceComponents } from './types'
import { adminCenterPlaceId, getAtlasPlace } from './registry/atlasPlaceRegistry'
import type { AtlasPlaceEntry } from './registry/atlasPlaceRegistry'

export type SourcePrecision = Exclude<GeographicPrecision, 'macro-region' | 'historical-region'>

const RANK: Record<SourcePrecision, number> = {
  unresolved: 0,
  country: 1,
  state: 2,
  county: 3,
  locality: 4,
}

export function sourcePrecisionFromComponents(
  components: ParsedPlaceComponents,
): SourcePrecision {
  if (components.locality) return 'locality'
  if (components.admin2) return 'county'
  if (components.admin1) return 'state'
  if (components.country) return 'country'
  return 'unresolved'
}

export function placePrecisionFromHierarchy(
  hierarchy: AtlasPlaceEntry['hierarchy'],
): SourcePrecision {
  if (hierarchy.locality) return 'locality'
  if (hierarchy.admin2) return 'county'
  if (hierarchy.admin1) return 'state'
  if (hierarchy.country) return 'country'
  return 'unresolved'
}

export function precisionRank(precision: SourcePrecision): number {
  return RANK[precision]
}

/** True when `child` is the same place as `parent` plus extra nested admin/locality. */
export function isNestedFinerPlace(
  child: Pick<AtlasPlaceEntry, 'id' | 'hierarchy'>,
  parent: Pick<AtlasPlaceEntry, 'id' | 'hierarchy'>,
): boolean {
  if (child.id === parent.id) return false
  const c = child.hierarchy
  const p = parent.hierarchy
  if (p.country && c.country !== p.country) return false
  if (p.admin1 && c.admin1 !== p.admin1) return false
  if (p.admin2 && c.admin2 !== p.admin2) return false
  if (p.locality && c.locality !== p.locality) return false
  return precisionRank(placePrecisionFromHierarchy(c)) > precisionRank(placePrecisionFromHierarchy(p))
}

export function parentPlaceIdAtPrecision(
  place: AtlasPlaceEntry,
  target: SourcePrecision,
): string | null {
  if (target === 'unresolved' || target === 'locality') return null
  if (target === 'county') {
    return adminCenterPlaceId({
      country: place.hierarchy.country,
      admin1: place.hierarchy.admin1 ?? null,
      admin2: place.hierarchy.admin2 ?? null,
    })
  }
  if (target === 'state') {
    return adminCenterPlaceId({
      country: place.hierarchy.country,
      admin1: place.hierarchy.admin1 ?? null,
      admin2: null,
    })
  }
  return adminCenterPlaceId({
    country: place.hierarchy.country,
    admin1: null,
    admin2: null,
  })
}

/**
 * Never keep a canonical place finer than the source demonstrated.
 * Nested child localities sharing a parent's name are collapsed to the parent.
 * Same-depth places under different parents are left as identity ambiguity.
 */
export function collapsePlaceIdsToSourcePrecision(
  placeIds: string[],
  components: ParsedPlaceComponents,
): string[] {
  const source = sourcePrecisionFromComponents(components)
  const sourceRank = precisionRank(source)
  const capped: AtlasPlaceEntry[] = []

  for (const id of [...new Set(placeIds)]) {
    const place = getAtlasPlace(id)
    if (!place) continue
    const placeRank = precisionRank(placePrecisionFromHierarchy(place.hierarchy))
    if (placeRank <= sourceRank) {
      capped.push(place)
      continue
    }
    const parentId = parentPlaceIdAtPrecision(place, source)
    const parent = parentId ? getAtlasPlace(parentId) : null
    if (parent) capped.push(parent)
  }

  const unique = [...new Map(capped.map((place) => [place.id, place])).values()]
  const atSource = unique.filter(
    (place) => precisionRank(placePrecisionFromHierarchy(place.hierarchy)) === sourceRank,
  )
  const chosen = atSource.length > 0 ? atSource : unique
  return chosen.map((place) => place.id)
}

export function placeIdHonoringSourcePrecision(
  placeId: string,
  components: ParsedPlaceComponents,
): string | null {
  const collapsed = collapsePlaceIdsToSourcePrecision([placeId], components)
  return collapsed[0] ?? null
}
