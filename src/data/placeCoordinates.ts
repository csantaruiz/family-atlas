import { placeRegion } from '../utils/placeUtils'
import { projectGeo } from '../utils/mapProjection'

/** Map position (0–100%) via Natural Earth projection fitted to the family atlas extent. */
export type MapCoordinate = {
  x: number
  y: number
  resolved: boolean
  region: string
  displayRegion?: string
}

type PlaceGeo = {
  lat: number
  lon: number
  region: string
  displayRegion?: string
}

/** Regional anchors from reference-v4-10.html, expressed as geographic coordinates. */
const REGION_GEO: Record<string, PlaceGeo> = {
  England: { lat: 53.2, lon: -2.2, region: 'England', displayRegion: 'Britain & Ireland' },
  Scotland: { lat: 58.3, lon: -3.4, region: 'Scotland', displayRegion: 'Britain & Ireland' },
  Ireland: { lat: 53.4, lon: -8.0, region: 'Ireland', displayRegion: 'Britain & Ireland' },
  Mexico: { lat: 28.6, lon: -106.1, region: 'Mexico', displayRegion: 'Mexico' },
  'United States': { lat: 40.5, lon: -75.0, region: 'United States', displayRegion: 'Eastern United States' },
}

/** Explicit place-string overrides with geographic coordinates from the family GEDCOM. */
const PLACE_GEO_OVERRIDES: Record<string, PlaceGeo> = {
  'Gawsworth, Cheshire, , England': { lat: 53.2, lon: -2.2, region: 'England' },
  'Gawsworth, Cheshire, England': { lat: 53.2, lon: -2.2, region: 'England' },
  'Bollington, Cheshire, , England': { lat: 53.1, lon: -2.1, region: 'England' },
  'Astbury, Cheshire, England': { lat: 53.25, lon: -2.2, region: 'England' },
  'Cheshire, England': { lat: 53.2, lon: -2.4, region: 'England' },
  'Latheron, Caithness, , Scotland': { lat: 58.3, lon: -3.4, region: 'Scotland' },
  'Carretas, Chihuahua, Mexico': { lat: 28.0, lon: -105.6, region: 'Mexico' },
  'Chihuahua, Chihuahua, Mexico': { lat: 28.6, lon: -106.1, region: 'Mexico' },
  'Santa Clara, California': { lat: 37.4, lon: -122.0, region: 'United States', displayRegion: 'California' },
  'Los Angeles, Los Angeles, California, USA': { lat: 34.1, lon: -118.2, region: 'United States', displayRegion: 'California' },
  'San Luis Obispo, California, USA': { lat: 35.3, lon: -120.7, region: 'United States', displayRegion: 'California' },
  'Rescue, CA': { lat: 38.7, lon: -120.9, region: 'United States', displayRegion: 'California' },
  'Gloucester, Camden, New Jersey, USA': { lat: 39.9, lon: -75.1, region: 'United States' },
  'Gloucester City Ward 1, Camden, New Jersey': { lat: 39.9, lon: -75.1, region: 'United States' },
  'Gloucester City, Camden, New Jersey': { lat: 39.9, lon: -75.1, region: 'United States' },
  'Camden City, Camden, New Jersey': { lat: 39.93, lon: -75.12, region: 'United States' },
  'San Antonio, TX, USA': { lat: 29.4, lon: -98.5, region: 'United States', displayRegion: 'Southwest United States' },
  'Placerville, CA': { lat: 38.73, lon: -120.8, region: 'United States', displayRegion: 'California' },
  'San Jose, CA': { lat: 37.34, lon: -121.89, region: 'United States', displayRegion: 'California' },
  'Jackson, Butler, Pennsylvania, USA': { lat: 41.0, lon: -79.9, region: 'United States' },
  ', Monroe, Pennsylvania, USA': { lat: 41.0, lon: -75.4, region: 'United States' },
  'Jackson, Monroe, Pennsylvania, USA': { lat: 41.0, lon: -75.4, region: 'United States' },
  'El Paso, El Paso, Texas': { lat: 31.8, lon: -106.5, region: 'United States' },
  'New Jersey': { lat: 40.2, lon: -74.7, region: 'United States' },
  Pennsylvania: { lat: 40.9, lon: -77.8, region: 'United States' },
  Texas: { lat: 31.0, lon: -100.0, region: 'United States' },
  Mexico: { lat: 23.6, lon: -102.5, region: 'Mexico' },
  England: { lat: 52.8, lon: -1.5, region: 'England' },
  Scotland: { lat: 56.5, lon: -4.0, region: 'Scotland' },
  Ireland: { lat: 53.4, lon: -8.0, region: 'Ireland' },
  California: { lat: 37.0, lon: -120.0, region: 'United States', displayRegion: 'California' },
  'United States': { lat: 39.8, lon: -98.6, region: 'United States' },
}

function geoFromPatterns(place: string): PlaceGeo | null {
  const s = place.toLowerCase()
  if (/california|santa clara|los angeles|san luis|rescue|rosemead|placerville|san jose/.test(s)) {
    return { lat: 37.4, lon: -122.0, region: 'United States', displayRegion: 'California' }
  }
  if (/chihuahua|carretas|coahuila|durango|zacatecas|ojinaga|mexico/.test(s)) {
    return { lat: 28.6, lon: -106.1, region: 'Mexico', displayRegion: 'Mexico' }
  }
  if (/cheshire|gawsworth|england|lancashire|yorkshire|westminster|london|gloucester/.test(s)) {
    return { lat: 53.2, lon: -2.2, region: 'England', displayRegion: 'Britain & Ireland' }
  }
  if (/scotland|glasgow|edinburgh|caithness|latheron/.test(s)) {
    return { lat: 58.3, lon: -3.4, region: 'Scotland', displayRegion: 'Britain & Ireland' }
  }
  if (/ireland/.test(s)) {
    return { lat: 53.4, lon: -8.0, region: 'Ireland', displayRegion: 'Britain & Ireland' }
  }
  if (/pennsylvania|new jersey|virginia|maryland|ohio|illinois|missouri|new york|wyoming|susquehanna|glou/.test(s)) {
    return { lat: 40.5, lon: -75.0, region: 'United States', displayRegion: 'Eastern United States' }
  }
  if (/texas|el paso|arizona|new mexico|colorado/.test(s)) {
    return { lat: 31.8, lon: -106.5, region: 'United States', displayRegion: 'Southwest United States' }
  }
  if (/usa|united states/.test(s)) {
    return { lat: 39.8, lon: -98.6, region: 'United States', displayRegion: 'United States' }
  }
  return null
}

function projectPlaceGeo(geo: PlaceGeo): MapCoordinate {
  const projected = projectGeo(geo.lon, geo.lat)
  return {
    x: projected.x,
    y: projected.y,
    resolved: true,
    region: geo.region,
    displayRegion: geo.displayRegion ?? REGION_GEO[geo.region]?.displayRegion,
  }
}

export function resolvePlaceCoordinate(place: string): MapCoordinate {
  const trimmed = place.trim()
  if (!trimmed) {
    return { x: 50, y: 50, resolved: false, region: '' }
  }

  const override = PLACE_GEO_OVERRIDES[trimmed]
  if (override) return projectPlaceGeo(override)

  const inferred = geoFromPatterns(trimmed)
  if (inferred) return projectPlaceGeo(inferred)

  const region = placeRegion(trimmed)
  if (region && REGION_GEO[region]) {
    return projectPlaceGeo(REGION_GEO[region])
  }

  return { x: 50, y: 50, resolved: false, region: region || '' }
}

export function coordinateDistance(a: MapCoordinate, b: MapCoordinate): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}
