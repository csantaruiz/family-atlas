import { normalizePlace } from '../../places/normalizePlace'
import { MODERN_COUNTRIES } from '../../places/registry/modernCountries'
import { matchHistoricalEntity } from '../../places/registry/historicalEntities'

export type WorldRegion =
  | 'british_isles'
  | 'western_europe'
  | 'northern_europe'
  | 'southern_europe'
  | 'central_eastern_europe'
  | 'north_america'
  | 'latin_america'
  | 'africa'
  | 'middle_east'
  | 'asia'
  | 'oceania'

export type PlaceGeography = { country: string | null; region: WorldRegion }

const COUNTRY_REGIONS: Record<string, WorldRegion> = {
  England: 'british_isles',
  Scotland: 'british_isles',
  Wales: 'british_isles',
  Ireland: 'british_isles',
  France: 'western_europe',
  Germany: 'western_europe',
  Netherlands: 'western_europe',
  Belgium: 'western_europe',
  Luxembourg: 'western_europe',
  Switzerland: 'western_europe',
  Austria: 'central_eastern_europe',
  Spain: 'southern_europe',
  Portugal: 'southern_europe',
  Italy: 'southern_europe',
  Greece: 'southern_europe',
  Denmark: 'northern_europe',
  Norway: 'northern_europe',
  Sweden: 'northern_europe',
  Finland: 'northern_europe',
  Iceland: 'northern_europe',
  Poland: 'central_eastern_europe',
  Hungary: 'central_eastern_europe',
  Romania: 'central_eastern_europe',
  Russia: 'central_eastern_europe',
  Ukraine: 'central_eastern_europe',
  Turkey: 'middle_east',
  Israel: 'middle_east',
  Egypt: 'middle_east',
  'United States': 'north_america',
  Canada: 'north_america',
  Mexico: 'latin_america',
  Panama: 'latin_america',
  Cuba: 'latin_america',
  Brazil: 'latin_america',
  Argentina: 'latin_america',
  Chile: 'latin_america',
  Peru: 'latin_america',
  Colombia: 'latin_america',
  'South Africa': 'africa',
  China: 'asia',
  Japan: 'asia',
  India: 'asia',
  Philippines: 'asia',
  Australia: 'oceania',
  'New Zealand': 'oceania',
}

/** Names the place registry does not treat as countries but that appear in history data. */
const EXTRA_ALIASES: Record<string, PlaceGeography> = {
  britain: { country: 'United Kingdom', region: 'british_isles' },
  'great britain': { country: 'United Kingdom', region: 'british_isles' },
  'united kingdom': { country: 'United Kingdom', region: 'british_isles' },
  uk: { country: 'United Kingdom', region: 'british_isles' },
  'new spain': { country: 'Mexico', region: 'latin_america' },
}

/** Coarse fallback for countries without an explicit mapping. */
function regionFromCoordinate(latitude: number, longitude: number): WorldRegion {
  if (longitude < -30) return latitude > 15 ? 'north_america' : 'latin_america'
  if (longitude > 110 && latitude < -10) return 'oceania'
  if (longitude > 60) return 'asia'
  if (latitude < 30 && longitude > -20) return 'africa'
  if (longitude > 30 && latitude < 42) return 'middle_east'
  if (latitude > 55) return 'northern_europe'
  if (latitude < 44) return 'southern_europe'
  return longitude > 15 ? 'central_eastern_europe' : 'western_europe'
}

function regionForCountry(name: string): WorldRegion | null {
  const mapped = COUNTRY_REGIONS[name]
  if (mapped) return mapped
  const entry = MODERN_COUNTRIES.find((country) => country.name === name)
  return entry ? regionFromCoordinate(entry.latitude, entry.longitude) : null
}

const cache = new Map<string, PlaceGeography | null>()

/** Country and world region for a free-text place (GEDCOM PLAC or a history country label). */
export function geographyForPlace(place: string | null | undefined): PlaceGeography | null {
  const text = place?.trim()
  if (!text) return null
  const cached = cache.get(text)
  if (cached !== undefined) return cached

  let result: PlaceGeography | null = EXTRA_ALIASES[text.toLowerCase()] ?? null
  if (!result) {
    const { components } = normalizePlace(text)
    if (components.country) {
      const region = regionForCountry(components.country)
      if (region) result = { country: components.country, region }
    }
  }
  if (!result) {
    const historical = matchHistoricalEntity(text)
    if (historical) {
      result = {
        country: null,
        region: regionFromCoordinate(historical.latitude, historical.longitude),
      }
    }
  }
  cache.set(text, result)
  return result
}

/** Most frequent geography across several places (first wins ties); null when none resolve. */
export function dominantGeography(places: readonly (string | null | undefined)[]): PlaceGeography | null {
  const counts = new Map<WorldRegion, { geo: PlaceGeography; count: number }>()
  for (const place of places) {
    const geo = geographyForPlace(place)
    if (!geo) continue
    const entry = counts.get(geo.region)
    if (entry) entry.count += 1
    else counts.set(geo.region, { geo, count: 1 })
  }
  let best: { geo: PlaceGeography; count: number } | null = null
  for (const entry of counts.values()) if (!best || entry.count > best.count) best = entry
  return best?.geo ?? null
}
