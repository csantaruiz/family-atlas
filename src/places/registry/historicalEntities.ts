/**
 * Historical geographic entities — not simple modern-country synonyms.
 * Modern geography is applied only when contextual evidence (explicit modern admin) is present.
 */

export type HistoricalGeographicEntity = {
  id: string
  canonicalName: string
  aliases: string[]
  /** Representative center for coarse historical display only. */
  latitude: number
  longitude: number
  /** Human-readable scope — avoids implying equivalence to a modern nation-state. */
  scopeNote: string
}

export const HISTORICAL_ENTITIES: HistoricalGeographicEntity[] = [
  {
    id: 'nueva-espana',
    canonicalName: 'Nueva España',
    aliases: [
      'nueva espana',
      'nueva españa',
      'nueva vizcaya',
      'new spain',
      'northern new spain',
      'nuevo reino de leon',
    ],
    latitude: 28.6,
    longitude: -106.1,
    scopeNote:
      'Colonial New Spain jurisdiction; not equivalent to modern Mexico without explicit modern admin context.',
  },
  {
    id: 'british-america-colonial',
    canonicalName: 'Colonial British America',
    aliases: ['british america', 'american colonies'],
    latitude: 39.0,
    longitude: -77.0,
    scopeNote: 'Historical colonial-era region; modern US admin required for state-level resolution.',
  },
]

const ALIAS_INDEX = new Map<string, HistoricalGeographicEntity>()

for (const entity of HISTORICAL_ENTITIES) {
  for (const alias of entity.aliases) {
    ALIAS_INDEX.set(alias, entity)
  }
  ALIAS_INDEX.set(entity.canonicalName.toLowerCase(), entity)
}

export function matchHistoricalEntity(text: string): HistoricalGeographicEntity | null {
  const lower = text.toLowerCase()
  for (const [alias, entity] of ALIAS_INDEX.entries()) {
    if (lower.includes(alias)) return entity
  }
  return null
}

/** True when the string contains explicit modern country/admin evidence alongside historical names. */
export function hasModernMexicoContext(text: string): boolean {
  return /\b(mexico|mexique|chihuahua|coahuila|durango|zacatecas|sonora|nuevo leon)\b/i.test(text)
}

export function hasModernUsContext(text: string): boolean {
  return /\b(united states|usa|u\.s\.a\.|california|texas|new jersey|pennsylvania|florida|connecticut|virginia|oregon|massachusetts|missouri)\b/i.test(
    text,
  )
}
