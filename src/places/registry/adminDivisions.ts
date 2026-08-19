/** Modern administrative divisions — reusable geographic knowledge, not family-specific strings. */

export type AdminDivision = {
  id: string
  name: string
  aliases: string[]
  kind: 'country' | 'state' | 'county'
  country: string
  admin1?: string
  latitude: number
  longitude: number
}

export type CountryEntry = AdminDivision & { kind: 'country' }

const COUNTRIES: CountryEntry[] = [
  {
    id: 'united-states',
    name: 'United States',
    aliases: ['usa', 'u.s.a.', 'u.s.', 'us', 'united states of america', 'america'],
    kind: 'country',
    country: 'United States',
    latitude: 39.8283,
    longitude: -98.5795,
  },
  {
    id: 'mexico',
    name: 'Mexico',
    aliases: ['mexique', 'méxico', 'mx'],
    kind: 'country',
    country: 'Mexico',
    latitude: 23.6345,
    longitude: -102.5528,
  },
  {
    id: 'england',
    name: 'England',
    aliases: ['england', 'uk', 'united kingdom', 'great britain', 'britain'],
    kind: 'country',
    country: 'England',
    latitude: 52.3555,
    longitude: -1.1743,
  },
  {
    id: 'scotland',
    name: 'Scotland',
    aliases: ['scotland'],
    kind: 'country',
    country: 'Scotland',
    latitude: 56.4907,
    longitude: -4.2026,
  },
  {
    id: 'ireland',
    name: 'Ireland',
    aliases: ['ireland', 'eire'],
    kind: 'country',
    country: 'Ireland',
    latitude: 53.4129,
    longitude: -8.2439,
  },
  {
    id: 'spain',
    name: 'Spain',
    aliases: ['spain', 'espana', 'españa'],
    kind: 'country',
    country: 'Spain',
    latitude: 40.4637,
    longitude: -3.7492,
  },
  {
    id: 'panama',
    name: 'Panama',
    aliases: ['panama'],
    kind: 'country',
    country: 'Panama',
    latitude: 8.538,
    longitude: -80.7821,
  },
]

const US_STATES: AdminDivision[] = [
  { id: 'us-ca', name: 'California', aliases: ['california', 'ca', 'calif.'], kind: 'state', country: 'United States', latitude: 36.7783, longitude: -119.4179 },
  { id: 'us-tx', name: 'Texas', aliases: ['texas', 'tx'], kind: 'state', country: 'United States', latitude: 31.9686, longitude: -99.9018 },
  { id: 'us-nj', name: 'New Jersey', aliases: ['new jersey', 'n.j.', 'nj'], kind: 'state', country: 'United States', latitude: 40.0583, longitude: -74.4057 },
  { id: 'us-pa', name: 'Pennsylvania', aliases: ['pennsylvania', 'pa', 'penn.'], kind: 'state', country: 'United States', latitude: 41.2033, longitude: -77.1945 },
  { id: 'us-va', name: 'Virginia', aliases: ['virginia', 'va'], kind: 'state', country: 'United States', latitude: 37.4316, longitude: -78.6569 },
  { id: 'us-wv', name: 'West Virginia', aliases: ['west virginia', 'w.v.', 'wv'], kind: 'state', country: 'United States', latitude: 38.5976, longitude: -80.4549 },
  { id: 'us-ma', name: 'Massachusetts', aliases: ['massachusetts', 'ma', 'mass.'], kind: 'state', country: 'United States', latitude: 42.4072, longitude: -71.3824 },
  { id: 'us-mo', name: 'Missouri', aliases: ['missouri', 'mo'], kind: 'state', country: 'United States', latitude: 37.9643, longitude: -91.8318 },
  { id: 'us-ct', name: 'Connecticut', aliases: ['connecticut', 'ct', 'conn.'], kind: 'state', country: 'United States', latitude: 41.6032, longitude: -73.0877 },
  { id: 'us-fl', name: 'Florida', aliases: ['florida', 'fl', 'fla.'], kind: 'state', country: 'United States', latitude: 27.6648, longitude: -81.5158 },
  { id: 'us-or', name: 'Oregon', aliases: ['oregon', 'or', 'ore.'], kind: 'state', country: 'United States', latitude: 43.8041, longitude: -120.5542 },
  { id: 'us-ny', name: 'New York', aliases: ['new york state', 'n.y.', 'ny state'], kind: 'state', country: 'United States', latitude: 43.2994, longitude: -74.2179 },
  { id: 'us-nh', name: 'New Hampshire', aliases: ['new hampshire', 'n.h.', 'nh'], kind: 'state', country: 'United States', latitude: 43.1939, longitude: -71.5724 },
]

const US_COUNTIES: AdminDivision[] = [
  { id: 'us-nj-camden', name: 'Camden', aliases: ['camden'], kind: 'county', country: 'United States', admin1: 'New Jersey', latitude: 39.8023, longitude: -75.001 },
  { id: 'us-pa-susquehanna', name: 'Susquehanna', aliases: ['susquehanna'], kind: 'county', country: 'United States', admin1: 'Pennsylvania', latitude: 41.82, longitude: -75.8 },
  { id: 'us-pa-wyoming', name: 'Wyoming', aliases: ['wyoming'], kind: 'county', country: 'United States', admin1: 'Pennsylvania', latitude: 41.52, longitude: -76.015 },
  { id: 'us-va-hampshire', name: 'Hampshire', aliases: ['hampshire'], kind: 'county', country: 'United States', admin1: 'Virginia', latitude: 39.32, longitude: -78.82 },
  { id: 'us-ma-hampshire', name: 'Hampshire', aliases: ['hampshire'], kind: 'county', country: 'United States', admin1: 'Massachusetts', latitude: 42.34, longitude: -72.66 },
  { id: 'us-mo-knox', name: 'Knox', aliases: ['knox'], kind: 'county', country: 'United States', admin1: 'Missouri', latitude: 40.13, longitude: -92.15 },
  { id: 'us-ct-new-london', name: 'New London', aliases: ['new london'], kind: 'county', country: 'United States', admin1: 'Connecticut', latitude: 41.49, longitude: -72.104 },
  { id: 'us-fl-st-johns', name: 'St Johns', aliases: ['st johns', 'st. johns', 'saint johns'], kind: 'county', country: 'United States', admin1: 'Florida', latitude: 29.901, longitude: -81.312 },
]

const MEXICAN_STATES: AdminDivision[] = [
  {
    id: 'mx-chihuahua',
    name: 'Chihuahua',
    aliases: ['chihuahua', 'chih.'],
    kind: 'state',
    country: 'Mexico',
    latitude: 28.6353,
    longitude: -106.0889,
  },
]

export const ADMIN_DIVISIONS: AdminDivision[] = [...COUNTRIES, ...US_STATES, ...US_COUNTIES, ...MEXICAN_STATES]

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ')
}

export function matchCountry(part: string): CountryEntry | null {
  const token = normalizeToken(part)
  for (const country of COUNTRIES) {
    if (normalizeToken(country.name) === token) return country
    if (country.aliases.some((alias) => normalizeToken(alias) === token)) return country
  }
  return null
}

export function matchAdmin1(part: string, country: string): AdminDivision | null {
  const token = normalizeToken(part)
  for (const admin of [...US_STATES, ...MEXICAN_STATES]) {
    if (admin.country !== country) continue
    if (normalizeToken(admin.name) === token) return admin
    if (admin.aliases.some((alias) => normalizeToken(alias) === token)) return admin
  }
  return null
}

export function matchAdmin2(part: string, country: string, admin1: string): AdminDivision | null {
  const token = normalizeToken(part)
  for (const admin of US_COUNTIES) {
    if (admin.country !== country || admin.admin1 !== admin1) continue
    if (normalizeToken(admin.name) === token) return admin
    if (admin.aliases.some((alias) => normalizeToken(alias) === token)) return admin
  }
  return null
}

export function findCountryInParts(parts: string[]): CountryEntry | null {
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const match = matchCountry(parts[i])
    if (match) return match
  }
  return null
}

export function findAdmin1InParts(parts: string[], country: string): { admin: AdminDivision; index: number } | null {
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const match = matchAdmin1(parts[i], country)
    if (match) return { admin: match, index: i }
  }
  return null
}

export function findAdmin2InParts(
  parts: string[],
  country: string,
  admin1: string,
  skipIndices: Set<number>,
): { admin: AdminDivision; index: number } | null {
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (skipIndices.has(i)) continue
    const match = matchAdmin2(parts[i], country, admin1)
    if (match) return { admin: match, index: i }
  }
  return null
}
