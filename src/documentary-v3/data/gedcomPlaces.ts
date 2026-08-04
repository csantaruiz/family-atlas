import type { LngLat } from '../types'

/** Family GEDCOM place strings → WGS84 decimal degrees (MapLibre: [longitude, latitude]). */
const GEDCOM_COORDINATES: Record<string, { latitude: number; longitude: number; label: string }> = {
  'Cheshire, England': { latitude: 53.2, longitude: -2.4, label: 'Cheshire' },
  'Gawsworth, Cheshire, , England': { latitude: 53.2, longitude: -2.2, label: 'Gawsworth' },
  'Gawsworth, Cheshire, England': { latitude: 53.2, longitude: -2.2, label: 'Gawsworth' },
  England: { latitude: 52.8, longitude: -1.5, label: 'England' },
}

/** North Atlantic overview — Europe and approaches visible, not West Africa. */
const WORLD_OVERVIEW: LngLat = [-35, 52]

/** British Isles representative center for the Britain cue. */
const BRITAIN_CENTER: LngLat = [-3.4, 55.2]

export function gedcomLngLat(gedcomString: string): LngLat {
  const entry = GEDCOM_COORDINATES[gedcomString]
  if (!entry) {
    throw new Error(`Unknown GEDCOM place for documentary-v3: ${gedcomString}`)
  }
  return [entry.longitude, entry.latitude]
}

export function gedcomLabel(gedcomString: string): string {
  return GEDCOM_COORDINATES[gedcomString]?.label ?? gedcomString
}

export const V3_PLACES = {
  world: WORLD_OVERVIEW,
  britain: BRITAIN_CENTER,
  cheshire: gedcomLngLat('Cheshire, England'),
  gawsworth: gedcomLngLat('Gawsworth, Cheshire, , England'),
} as const

export const V3_LABELS = {
  britain: 'Britain',
  cheshire: gedcomLabel('Cheshire, England'),
  gawsworth: gedcomLabel('Gawsworth, Cheshire, , England'),
} as const

/** Reject coordinates that land in West Africa / Gulf of Guinea framing band. */
export function isAfricaCenter(center: LngLat): boolean {
  const [lng, lat] = center
  return lat < 45 && lng > -20 && lng < 25
}
