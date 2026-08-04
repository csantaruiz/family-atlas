import { projectGeo } from '../../utils/mapProjection'
import { validateGeoPoint, type GeoPoint } from '../geo/coordinates'
import type { GeographicScale } from '../types/choreography'
import type { DocumentaryBranch } from '../types/manifest'

export type PlaceConfidence = 'verified' | 'high' | 'medium' | 'unresolved'

export type CanonicalPlace = {
  id: string
  canonicalName: string
  locality?: string
  region?: string
  country?: string
  latitude: number
  longitude: number
  confidence: PlaceConfidence
  source: string
  gedcomString?: string
  resolutionMethod: string
  geographicScale: GeographicScale
  labelMinScale: GeographicScale
  labelMaxScale: GeographicScale
  labelPriority: number
  branch?: DocumentaryBranch
}

export type ProjectedPlace = CanonicalPlace & {
  x: number
  y: number
}

type PlaceDefinition = Omit<CanonicalPlace, 'latitude' | 'longitude'> & GeoPoint

/** Single canonical registry — verified coordinates only. Do not duplicate elsewhere. */
const CANONICAL_PLACES: PlaceDefinition[] = [
  {
    id: 'britain',
    canonicalName: 'Britain',
    country: 'United Kingdom',
    latitude: 54.7024,
    longitude: -3.2766,
    confidence: 'verified',
    source: 'project-place-registry',
    resolutionMethod: 'representative-center',
    geographicScale: 'continental',
    labelMinScale: 'continental',
    labelMaxScale: 'country',
    labelPriority: 4,
    branch: 'british',
  },
  {
    id: 'england',
    canonicalName: 'England',
    country: 'England',
    latitude: 52.3555,
    longitude: -1.1743,
    confidence: 'verified',
    source: 'project-place-registry',
    gedcomString: 'England',
    resolutionMethod: 'country-center',
    geographicScale: 'country',
    labelMinScale: 'country',
    labelMaxScale: 'regional',
    labelPriority: 3,
    branch: 'british',
  },
  {
    id: 'cheshire',
    canonicalName: 'Cheshire',
    region: 'Cheshire',
    country: 'England',
    latitude: 53.166,
    longitude: -2.583,
    confidence: 'verified',
    source: 'project-place-registry',
    gedcomString: 'Cheshire, England',
    resolutionMethod: 'regional-center',
    geographicScale: 'regional',
    labelMinScale: 'regional',
    labelMaxScale: 'local',
    labelPriority: 2,
    branch: 'british',
  },
  {
    id: 'gawsworth',
    canonicalName: 'Gawsworth',
    locality: 'Gawsworth',
    region: 'Cheshire',
    country: 'England',
    latitude: 53.224,
    longitude: -2.166,
    confidence: 'verified',
    source: 'project-place-registry',
    gedcomString: 'Gawsworth, Cheshire, England',
    resolutionMethod: 'locality-coordinates',
    geographicScale: 'local',
    labelMinScale: 'local',
    labelMaxScale: 'local',
    labelPriority: 1,
    branch: 'british',
  },
  {
    id: 'spain',
    canonicalName: 'Spain',
    country: 'Spain',
    latitude: 40.4637,
    longitude: -3.7492,
    confidence: 'verified',
    source: 'project-place-registry',
    resolutionMethod: 'country-center',
    geographicScale: 'country',
    labelMinScale: 'country',
    labelMaxScale: 'regional',
    labelPriority: 3,
    branch: 'spanish-mexican',
  },
  {
    id: 'chihuahua',
    canonicalName: 'Chihuahua',
    locality: 'Chihuahua',
    region: 'Chihuahua',
    country: 'Mexico',
    latitude: 28.6353,
    longitude: -106.0889,
    confidence: 'verified',
    source: 'project-place-registry',
    gedcomString: 'Chihuahua, Chihuahua, Mexico',
    resolutionMethod: 'locality-coordinates',
    geographicScale: 'regional',
    labelMinScale: 'regional',
    labelMaxScale: 'local',
    labelPriority: 2,
    branch: 'spanish-mexican',
  },
  {
    id: 'ojinaga',
    canonicalName: 'Ojinaga',
    locality: 'Ojinaga',
    region: 'Chihuahua',
    country: 'Mexico',
    latitude: 29.564,
    longitude: -104.416,
    confidence: 'verified',
    source: 'project-place-registry',
    gedcomString: 'Ojinaga, Chihuahua, Mexico',
    resolutionMethod: 'locality-coordinates',
    geographicScale: 'local',
    labelMinScale: 'local',
    labelMaxScale: 'local',
    labelPriority: 1,
    branch: 'spanish-mexican',
  },
  {
    id: 'el-paso',
    canonicalName: 'El Paso',
    locality: 'El Paso',
    region: 'Texas',
    country: 'United States',
    latitude: 31.7619,
    longitude: -106.485,
    confidence: 'verified',
    source: 'project-place-registry',
    gedcomString: 'El Paso, El Paso, Texas',
    resolutionMethod: 'locality-coordinates',
    geographicScale: 'local',
    labelMinScale: 'local',
    labelMaxScale: 'local',
    labelPriority: 1,
    branch: 'spanish-mexican',
  },
  {
    id: 'california',
    canonicalName: 'California',
    region: 'California',
    country: 'United States',
    latitude: 37.0,
    longitude: -119.5,
    confidence: 'verified',
    source: 'project-place-registry',
    gedcomString: 'California',
    resolutionMethod: 'regional-center',
    geographicScale: 'regional',
    labelMinScale: 'regional',
    labelMaxScale: 'country',
    labelPriority: 3,
    branch: 'eastern-us',
  },
  {
    id: 'santa-clara',
    canonicalName: 'Santa Clara',
    locality: 'Santa Clara',
    region: 'California',
    country: 'United States',
    latitude: 37.3541,
    longitude: -121.9552,
    confidence: 'verified',
    source: 'project-place-registry',
    gedcomString: 'Santa Clara, California',
    resolutionMethod: 'locality-coordinates',
    geographicScale: 'local',
    labelMinScale: 'local',
    labelMaxScale: 'local',
    labelPriority: 1,
    branch: 'eastern-us',
  },
  {
    id: 'monrovia',
    canonicalName: 'Monrovia',
    locality: 'Monrovia',
    region: 'California',
    country: 'United States',
    latitude: 34.1481,
    longitude: -117.9989,
    confidence: 'verified',
    source: 'project-place-registry',
    resolutionMethod: 'locality-coordinates',
    geographicScale: 'local',
    labelMinScale: 'local',
    labelMaxScale: 'local',
    labelPriority: 1,
    branch: 'eastern-us',
  },
  {
    id: 'san-diego',
    canonicalName: 'San Diego',
    locality: 'San Diego',
    region: 'California',
    country: 'United States',
    latitude: 32.7157,
    longitude: -117.1611,
    confidence: 'verified',
    source: 'project-place-registry',
    resolutionMethod: 'locality-coordinates',
    geographicScale: 'local',
    labelMinScale: 'local',
    labelMaxScale: 'local',
    labelPriority: 1,
    branch: 'eastern-us',
  },
  {
    id: 'gloucester-city',
    canonicalName: 'Gloucester City',
    locality: 'Gloucester City',
    region: 'Camden',
    country: 'United States',
    latitude: 39.8912,
    longitude: -75.116,
    confidence: 'verified',
    source: 'project-place-registry',
    gedcomString: 'Gloucester City, Camden, New Jersey',
    resolutionMethod: 'locality-coordinates',
    geographicScale: 'local',
    labelMinScale: 'local',
    labelMaxScale: 'local',
    labelPriority: 1,
    branch: 'eastern-us',
  },
  {
    id: 'camden',
    canonicalName: 'Camden',
    locality: 'Camden',
    region: 'New Jersey',
    country: 'United States',
    latitude: 39.9259,
    longitude: -75.1196,
    confidence: 'verified',
    source: 'project-place-registry',
    gedcomString: 'Camden, Camden, New Jersey',
    resolutionMethod: 'locality-coordinates',
    geographicScale: 'local',
    labelMinScale: 'local',
    labelMaxScale: 'local',
    labelPriority: 1,
    branch: 'eastern-us',
  },
  {
    id: 'new-jersey',
    canonicalName: 'New Jersey',
    region: 'New Jersey',
    country: 'United States',
    latitude: 40.0583,
    longitude: -74.4057,
    confidence: 'high',
    source: 'project-place-registry',
    gedcomString: 'New Jersey',
    resolutionMethod: 'regional-center',
    geographicScale: 'regional',
    labelMinScale: 'regional',
    labelMaxScale: 'country',
    labelPriority: 4,
    branch: 'eastern-us',
  },
  {
    id: 'pennsylvania',
    canonicalName: 'Pennsylvania',
    region: 'Pennsylvania',
    country: 'United States',
    latitude: 40.8781,
    longitude: -77.7996,
    confidence: 'high',
    source: 'project-place-registry',
    gedcomString: 'Pennsylvania',
    resolutionMethod: 'regional-center',
    geographicScale: 'regional',
    labelMinScale: 'regional',
    labelMaxScale: 'country',
    labelPriority: 4,
    branch: 'eastern-us',
  },
  {
    id: 'philadelphia',
    canonicalName: 'Philadelphia',
    locality: 'Philadelphia',
    region: 'Pennsylvania',
    country: 'United States',
    latitude: 39.9526,
    longitude: -75.1652,
    confidence: 'high',
    source: 'project-place-registry',
    gedcomString: 'Philadelphia, Pennsylvania',
    resolutionMethod: 'locality-coordinates',
    geographicScale: 'local',
    labelMinScale: 'regional',
    labelMaxScale: 'local',
    labelPriority: 2,
    branch: 'eastern-us',
  },
  {
    id: 'scotland',
    canonicalName: 'Scotland',
    country: 'Scotland',
    latitude: 56.4907,
    longitude: -4.2026,
    confidence: 'high',
    source: 'project-place-registry',
    gedcomString: 'Scotland',
    resolutionMethod: 'country-center',
    geographicScale: 'country',
    labelMinScale: 'country',
    labelMaxScale: 'regional',
    labelPriority: 3,
    branch: 'british',
  },
  {
    id: 'panama-canal-zone',
    canonicalName: 'Panama Canal Zone',
    region: 'Panama Canal Zone',
    country: 'Panama',
    latitude: 9.082,
    longitude: -79.683,
    confidence: 'high',
    source: 'project-place-registry',
    gedcomString: 'Panama Canal Zone',
    resolutionMethod: 'regional-center',
    geographicScale: 'regional',
    labelMinScale: 'regional',
    labelMaxScale: 'country',
    labelPriority: 3,
    branch: 'eastern-us',
  },
]

function projectPlace(def: PlaceDefinition): ProjectedPlace {
  validateGeoPoint(def)
  const projected = projectGeo(def.longitude, def.latitude)
  return { ...def, x: projected.x, y: projected.y }
}

const REGISTRY = new Map<string, ProjectedPlace>(
  CANONICAL_PLACES.map((def) => [def.id, projectPlace(def)]),
)

export function getCanonicalPlace(id: string): ProjectedPlace | null {
  return REGISTRY.get(id) ?? null
}

export function allCanonicalPlaces(): ProjectedPlace[] {
  return [...REGISTRY.values()]
}

export function projectCanonicalPlace(id: string): ProjectedPlace | null {
  return getCanonicalPlace(id)
}

export function placesForIds(ids: string[]): ProjectedPlace[] {
  return ids.map((id) => getCanonicalPlace(id)).filter((p): p is ProjectedPlace => p != null)
}

export function canDriveLocalCamera(confidence: PlaceConfidence): boolean {
  return confidence === 'verified' || confidence === 'high'
}

const SCALE_ORDER: GeographicScale[] = ['world', 'continental', 'country', 'regional', 'local']

export const SCALE_ZOOM: Record<GeographicScale, number> = {
  world: 1.02,
  continental: 1.1,
  country: 1.24,
  regional: 1.58,
  local: 2.05,
}

function scaleIndex(scale: GeographicScale): number {
  return SCALE_ORDER.indexOf(scale)
}

export function scaleAtZoom(zoom: number): GeographicScale {
  if (zoom >= SCALE_ZOOM.local - 0.35) return 'local'
  if (zoom >= SCALE_ZOOM.regional - 0.25) return 'regional'
  if (zoom >= SCALE_ZOOM.country - 0.18) return 'country'
  if (zoom >= SCALE_ZOOM.continental - 0.08) return 'continental'
  return 'world'
}

export function labelVisibleAtScale(place: CanonicalPlace, currentScale: GeographicScale): boolean {
  const current = scaleIndex(currentScale)
  return (
    current >= scaleIndex(place.labelMinScale) && current <= scaleIndex(place.labelMaxScale)
  )
}

/** @deprecated Use getCanonicalPlace */
export function getRegistryPlace(id: string): ProjectedPlace | null {
  return getCanonicalPlace(id)
}

/** @deprecated Use placesForIds */
export function placesForKeys(keys: string[]): ProjectedPlace[] {
  return placesForIds(keys)
}
