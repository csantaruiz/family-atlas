import { projectGeo } from '../../utils/mapProjection'
import { allCanonicalPlaces, type ProjectedPlace } from '../../documentary-engine/data/canonicalPlaceRegistry'
import type { GeographicScale } from '../../documentary-engine/types/choreography'
import type { DocumentaryBranch } from '../../documentary-engine/types/manifest'
import type { PlaceConfidence } from '../../documentary-engine/data/canonicalPlaceRegistry'

export type AtlasPlaceEntry = {
  id: string
  canonicalName: string
  hierarchy: {
    country: string
    admin1?: string
    admin2?: string
    locality?: string
  }
  latitude: number
  longitude: number
  geographicScale: GeographicScale
  branch?: DocumentaryBranch
  confidence: PlaceConfidence
  source: string
  resolutionMethod: string
  exactAliases: string[]
}

type ScopedAlias = {
  aliasKey: string
  placeId: string
  requiredCountry?: string
  requiredAdmin1?: string
}

const EXTRA_ENTRIES: Omit<AtlasPlaceEntry, 'latitude' | 'longitude'>[] = [
  {
    id: 'ireland',
    canonicalName: 'Ireland',
    hierarchy: { country: 'Ireland' },
    geographicScale: 'country',
    branch: 'british',
    confidence: 'high',
    source: 'atlas-place-registry',
    resolutionMethod: 'country-center',
    exactAliases: ['ireland'],
  },
  {
    id: 'united-states',
    canonicalName: 'United States',
    hierarchy: { country: 'United States' },
    geographicScale: 'country',
    branch: 'eastern-us',
    confidence: 'high',
    source: 'atlas-place-registry',
    resolutionMethod: 'country-center',
    exactAliases: ['united states', 'united states of america', 'usa', 'u.s.a.'],
  },
  {
    id: 'mexico',
    canonicalName: 'Mexico',
    hierarchy: { country: 'Mexico' },
    geographicScale: 'country',
    branch: 'spanish-mexican',
    confidence: 'high',
    source: 'atlas-place-registry',
    resolutionMethod: 'country-center',
    exactAliases: ['mexico', 'mexique'],
  },
  {
    id: 'virginia',
    canonicalName: 'Virginia',
    hierarchy: { country: 'United States', admin1: 'Virginia' },
    geographicScale: 'regional',
    branch: 'eastern-us',
    confidence: 'high',
    source: 'atlas-place-registry',
    resolutionMethod: 'admin-center',
    exactAliases: ['virginia'],
  },
  {
    id: 'west-virginia',
    canonicalName: 'West Virginia',
    hierarchy: { country: 'United States', admin1: 'West Virginia' },
    geographicScale: 'regional',
    branch: 'eastern-us',
    confidence: 'high',
    source: 'atlas-place-registry',
    resolutionMethod: 'admin-center',
    exactAliases: ['west virginia'],
  },
  {
    id: 'massachusetts',
    canonicalName: 'Massachusetts',
    hierarchy: { country: 'United States', admin1: 'Massachusetts' },
    geographicScale: 'regional',
    branch: 'eastern-us',
    confidence: 'high',
    source: 'atlas-place-registry',
    resolutionMethod: 'admin-center',
    exactAliases: ['massachusetts'],
  },
  {
    id: 'missouri',
    canonicalName: 'Missouri',
    hierarchy: { country: 'United States', admin1: 'Missouri' },
    geographicScale: 'regional',
    branch: 'eastern-us',
    confidence: 'high',
    source: 'atlas-place-registry',
    resolutionMethod: 'admin-center',
    exactAliases: ['missouri'],
  },
  {
    id: 'connecticut',
    canonicalName: 'Connecticut',
    hierarchy: { country: 'United States', admin1: 'Connecticut' },
    geographicScale: 'regional',
    branch: 'eastern-us',
    confidence: 'high',
    source: 'atlas-place-registry',
    resolutionMethod: 'admin-center',
    exactAliases: ['connecticut'],
  },
  {
    id: 'florida',
    canonicalName: 'Florida',
    hierarchy: { country: 'United States', admin1: 'Florida' },
    geographicScale: 'regional',
    branch: 'eastern-us',
    confidence: 'high',
    source: 'atlas-place-registry',
    resolutionMethod: 'admin-center',
    exactAliases: ['florida'],
  },
  {
    id: 'oregon',
    canonicalName: 'Oregon',
    hierarchy: { country: 'United States', admin1: 'Oregon' },
    geographicScale: 'regional',
    branch: 'eastern-us',
    confidence: 'high',
    source: 'atlas-place-registry',
    resolutionMethod: 'admin-center',
    exactAliases: ['oregon'],
  },
  {
    id: 'san-antonio-tx',
    canonicalName: 'San Antonio',
    hierarchy: { country: 'United States', admin1: 'Texas', locality: 'San Antonio' },
    geographicScale: 'local',
    branch: 'spanish-mexican',
    confidence: 'verified',
    source: 'atlas-place-registry',
    resolutionMethod: 'locality-coordinates',
    exactAliases: ['san antonio, tx, usa', 'san antonio, texas, usa', 'san antonio, texas'],
  },
  {
    id: 'anaheim-ca',
    canonicalName: 'Anaheim',
    hierarchy: { country: 'United States', admin1: 'California', locality: 'Anaheim' },
    geographicScale: 'local',
    branch: 'eastern-us',
    confidence: 'high',
    source: 'atlas-place-registry',
    resolutionMethod: 'locality-coordinates',
    exactAliases: ['anaheim, ca usa', 'anaheim, california, usa', 'anahiem, ca usa', 'anahiem, california, usa'],
  },
  {
    id: 'jacksonville-fl',
    canonicalName: 'Jacksonville',
    hierarchy: {
      country: 'United States',
      admin1: 'Florida',
      admin2: 'St Johns',
      locality: 'Jacksonville',
    },
    geographicScale: 'local',
    branch: 'eastern-us',
    confidence: 'high',
    source: 'atlas-place-registry',
    resolutionMethod: 'locality-coordinates',
    exactAliases: ['jacksonville, st johns, florida, united states'],
  },
  {
    id: 'hidalgo-del-parral',
    canonicalName: 'Hidalgo del Parral',
    hierarchy: { country: 'Mexico', admin1: 'Chihuahua', locality: 'Hidalgo del Parral' },
    geographicScale: 'local',
    branch: 'spanish-mexican',
    confidence: 'high',
    source: 'atlas-place-registry',
    resolutionMethod: 'locality-coordinates',
    exactAliases: [
      'san jose, hidalgo del parral, chihuahua, mexique',
      'san jose del parral, nueva vizcaya, nueva espana (hidalgo del parral, chihuahua, mexico)',
    ],
  },
  {
    id: 'ledyard-ct',
    canonicalName: 'Ledyard',
    hierarchy: { country: 'United States', admin1: 'Connecticut', admin2: 'New London', locality: 'Ledyard' },
    geographicScale: 'local',
    branch: 'eastern-us',
    confidence: 'high',
    source: 'atlas-place-registry',
    resolutionMethod: 'locality-coordinates',
    exactAliases: ['ledyard, new london, connecticut, usa'],
  },
  {
    id: 'medford-or',
    canonicalName: 'Medford',
    hierarchy: { country: 'United States', admin1: 'Oregon', locality: 'Medford' },
    geographicScale: 'local',
    branch: 'eastern-us',
    confidence: 'medium',
    source: 'atlas-place-registry',
    resolutionMethod: 'locality-coordinates',
    exactAliases: ['medford, oregon, usa'],
  },
  {
    id: 'new-york-city',
    canonicalName: 'New York City',
    hierarchy: { country: 'United States', admin1: 'New York', locality: 'New York' },
    geographicScale: 'local',
    branch: 'eastern-us',
    confidence: 'medium',
    source: 'atlas-place-registry',
    resolutionMethod: 'locality-coordinates',
    exactAliases: ['new york, new york'],
  },
  {
    id: 'new-york-state',
    canonicalName: 'New York',
    hierarchy: { country: 'United States', admin1: 'New York' },
    geographicScale: 'regional',
    branch: 'eastern-us',
    confidence: 'medium',
    source: 'atlas-place-registry',
    resolutionMethod: 'admin-center',
    exactAliases: ['new york state'],
  },
  {
    id: 'texas',
    canonicalName: 'Texas',
    hierarchy: { country: 'United States', admin1: 'Texas' },
    geographicScale: 'regional',
    branch: 'spanish-mexican',
    confidence: 'high',
    source: 'atlas-place-registry',
    resolutionMethod: 'admin-center',
    exactAliases: ['texas', 'texas, usa', 'texas, united states'],
  },
  {
    id: 'susquehanna-county-pa',
    canonicalName: 'Susquehanna County',
    hierarchy: { country: 'United States', admin1: 'Pennsylvania', admin2: 'Susquehanna' },
    geographicScale: 'regional',
    branch: 'eastern-us',
    confidence: 'high',
    source: 'atlas-place-registry',
    resolutionMethod: 'admin-center',
    exactAliases: ['of clifford,susquehanna,pa', 'clifford, susquehanna, pennsylvania'],
  },
  {
    id: 'wyoming-county-pa',
    canonicalName: 'Wyoming County',
    hierarchy: { country: 'United States', admin1: 'Pennsylvania', admin2: 'Wyoming' },
    geographicScale: 'regional',
    branch: 'eastern-us',
    confidence: 'high',
    source: 'atlas-place-registry',
    resolutionMethod: 'admin-center',
    exactAliases: ['of forkston,wyoming,pa', 'forkston, wyoming, pennsylvania'],
  },
]

function fromCanonical(place: ProjectedPlace): AtlasPlaceEntry {
  return {
    id: place.id,
    canonicalName: place.canonicalName,
    hierarchy: {
      country: place.country ?? place.region ?? place.canonicalName,
      admin1: place.region,
      admin2: undefined,
      locality: place.locality,
    },
    latitude: place.latitude,
    longitude: place.longitude,
    geographicScale: place.geographicScale,
    branch: place.branch,
    confidence: place.confidence,
    source: place.source,
    resolutionMethod: place.resolutionMethod,
    exactAliases: [
      place.canonicalName.toLowerCase(),
      place.gedcomString?.toLowerCase() ?? '',
    ].filter(Boolean),
  }
}

function buildRegistry(): {
  byId: Map<string, AtlasPlaceEntry & { x: number; y: number }>
  exactAlias: Map<string, string>
  scopedAliases: ScopedAlias[]
} {
  const byId = new Map<string, AtlasPlaceEntry & { x: number; y: number }>()
  const exactAlias = new Map<string, string>()
  const scopedAliases: ScopedAlias[] = []

  const seed = [...allCanonicalPlaces().map(fromCanonical)]
  for (const extra of EXTRA_ENTRIES) {
    if (!seed.some((entry) => entry.id === extra.id)) {
      const coords = defaultCoordsForExtra(extra.id)
      seed.push({ ...extra, latitude: coords.lat, longitude: coords.lon })
    }
  }

  for (const entry of seed) {
    const projected = projectGeo(entry.longitude, entry.latitude)
    byId.set(entry.id, { ...entry, x: projected.x, y: projected.y })
    for (const alias of entry.exactAliases) {
      exactAlias.set(alias.toLowerCase().replace(/\s+/g, ' ').trim(), entry.id)
    }
    if (entry.hierarchy.locality) {
      scopedAliases.push({
        aliasKey: entry.hierarchy.locality.toLowerCase(),
        placeId: entry.id,
        requiredCountry: entry.hierarchy.country,
        requiredAdmin1: entry.hierarchy.admin1,
      })
    }
  }

  // Gloucester City NJ scoped aliases — reusable abbreviation knowledge.
  scopedAliases.push(
    {
      aliasKey: 'gloucester city',
      placeId: 'gloucester-city',
      requiredCountry: 'United States',
      requiredAdmin1: 'New Jersey',
    },
    {
      aliasKey: 'gloucester',
      placeId: 'gloucester-city',
      requiredCountry: 'United States',
      requiredAdmin1: 'New Jersey',
    },
  )

  return { byId, exactAlias, scopedAliases }
}

function defaultCoordsForExtra(id: string): { lat: number; lon: number } {
  const table: Record<string, { lat: number; lon: number }> = {
    ireland: { lat: 53.4129, lon: -8.2439 },
    'united-states': { lat: 39.8283, lon: -98.5795 },
    mexico: { lat: 23.6345, lon: -102.5528 },
    virginia: { lat: 37.4316, lon: -78.6569 },
    'west-virginia': { lat: 38.5976, lon: -80.4549 },
    massachusetts: { lat: 42.4072, lon: -71.3824 },
    missouri: { lat: 37.9643, lon: -91.8318 },
    connecticut: { lat: 41.6032, lon: -73.0877 },
    florida: { lat: 27.6648, lon: -81.5158 },
    oregon: { lat: 43.8041, lon: -120.5542 },
    'san-antonio-tx': { lat: 29.4241, lon: -98.4936 },
    'anaheim-ca': { lat: 33.8366, lon: -117.9143 },
    'jacksonville-fl': { lat: 30.3322, lon: -81.6557 },
    'hidalgo-del-parral': { lat: 26.933, lon: -105.667 },
    'ledyard-ct': { lat: 41.465, lon: -72.014 },
    'medford-or': { lat: 42.3265, lon: -122.8756 },
    'new-york-city': { lat: 40.7128, lon: -74.006 },
    'new-york-state': { lat: 43.2994, lon: -74.2179 },
    texas: { lat: 31.9686, lon: -99.9018 },
    'susquehanna-county-pa': { lat: 41.82, lon: -75.8 },
    'wyoming-county-pa': { lat: 41.52, lon: -76.015 },
  }
  return table[id] ?? { lat: 0, lon: 0 }
}

const REGISTRY = buildRegistry()

export function getAtlasPlace(id: string): (AtlasPlaceEntry & { x: number; y: number }) | null {
  return REGISTRY.byId.get(id) ?? null
}

export function findExactRegistryMatch(matchKey: string): string | null {
  return REGISTRY.exactAlias.get(matchKey) ?? null
}

export function findScopedLocalityMatches(input: {
  locality: string
  country: string | null
  admin1: string | null
}): string[] {
  const key = input.locality.toLowerCase()
  const matches: string[] = []
  for (const alias of REGISTRY.scopedAliases) {
    if (!key.includes(alias.aliasKey) && alias.aliasKey !== key) continue
    if (alias.requiredCountry && input.country && alias.requiredCountry !== input.country) continue
    if (alias.requiredAdmin1 && input.admin1 && alias.requiredAdmin1 !== input.admin1) continue
    if (alias.requiredCountry && !input.country) continue
    if (alias.requiredAdmin1 && !input.admin1) continue
    matches.push(alias.placeId)
  }
  return [...new Set(matches)]
}

export function levenshtein(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0),
  )
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }
  return matrix[a.length][b.length]
}

export function findFuzzyLocalityMatch(input: {
  locality: string
  country: string | null
  admin1: string | null
  maxDistance: number
}): string[] {
  const candidates: Array<{ id: string; distance: number }> = []
  for (const entry of REGISTRY.byId.values()) {
    if (!entry.hierarchy.locality) continue
    if (input.country && entry.hierarchy.country !== input.country) continue
    if (input.admin1 && entry.hierarchy.admin1 && entry.hierarchy.admin1 !== input.admin1) continue
    const distance = levenshtein(
      input.locality.toLowerCase(),
      entry.hierarchy.locality.toLowerCase(),
    )
    if (distance <= input.maxDistance) {
      candidates.push({ id: entry.id, distance })
    }
  }
  return candidates
    .sort((a, b) => a.distance - b.distance)
    .map((item) => item.id)
}

export function adminCenterPlaceId(input: {
  country: string | null
  admin1: string | null
  admin2: string | null
}): string | null {
  if (input.admin2 && input.admin1 && input.country === 'United States') {
    const countyKey = `${input.admin2}-${input.admin1}`.toLowerCase()
    if (countyKey.includes('susquehanna') && input.admin1 === 'Pennsylvania') {
      return 'susquehanna-county-pa'
    }
    if (countyKey.includes('wyoming') && input.admin1 === 'Pennsylvania') {
      return 'wyoming-county-pa'
    }
    if (input.admin2 === 'Camden' && input.admin1 === 'New Jersey') {
      return 'camden'
    }
    if (input.admin2 === 'New London' && input.admin1 === 'Connecticut') {
      return 'ledyard-ct'
    }
  }
  if (input.admin1) {
    const byAdmin = [...REGISTRY.byId.values()].find(
      (entry) =>
        entry.hierarchy.admin1 === input.admin1 &&
        entry.hierarchy.country === input.country &&
        !entry.hierarchy.locality &&
        !entry.hierarchy.admin2,
    )
    if (byAdmin) return byAdmin.id
  }
  if (input.country) {
    const direct = [...REGISTRY.byId.values()].find(
      (entry) => entry.hierarchy.country === input.country && !entry.hierarchy.admin1,
    )
    if (direct) return direct.id
  }
  return null
}

export function allAtlasPlaceIds(): string[] {
  return [...REGISTRY.byId.keys()]
}
