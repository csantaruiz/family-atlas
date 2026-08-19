import type { MapCoordinate } from '../../data/placeCoordinates'
import type { CanonicalPlaceResolution } from '../types'

const UNRESOLVED: MapCoordinate = { x: 50, y: 50, resolved: false, region: '' }

function regionFromResolution(resolution: CanonicalPlaceResolution): string {
  const path = resolution.provenance.matchedAdminPath ?? []
  const country = path.find((part) =>
    ['United States', 'Mexico', 'England', 'Scotland', 'Ireland', 'Spain'].includes(part),
  )
  if (country) return country
  if (resolution.label === 'Ireland') return 'Ireland'
  if (resolution.label === 'Scotland') return 'Scotland'
  if (resolution.label === 'England' || resolution.label === 'Cheshire') return 'England'
  if (resolution.label === 'Mexico' || resolution.canonicalPlaceId === 'chihuahua') return 'Mexico'
  return path[0] ?? resolution.label ?? ''
}

function displayRegionFromResolution(resolution: CanonicalPlaceResolution): string | undefined {
  const path = resolution.provenance.matchedAdminPath ?? []
  const region = regionFromResolution(resolution)

  if (region === 'England' || region === 'Scotland' || region === 'Ireland') {
    return 'Britain & Ireland'
  }
  if (region === 'Mexico') return 'Mexico'

  if (region === 'United States') {
    const admin1 = path.find((part) =>
      /California|Texas|New Jersey|Pennsylvania|Florida|Connecticut|Virginia|Oregon|Massachusetts|Missouri|West Virginia|New York/.test(
        part,
      ),
    )
    if (admin1 === 'California') return 'California'
    if (admin1 === 'Texas') return 'Southwest United States'
    if (
      admin1 === 'New Jersey' ||
      admin1 === 'Pennsylvania' ||
      admin1 === 'Florida' ||
      admin1 === 'Connecticut' ||
      admin1 === 'Virginia' ||
      admin1 === 'Massachusetts' ||
      admin1 === 'Missouri' ||
      admin1 === 'West Virginia' ||
      admin1 === 'New York'
    ) {
      return 'Eastern United States'
    }
    return 'United States'
  }

  return undefined
}

/** Map unified resolution → Explore MapCoordinate (conservative). */
export function mapCoordinateFromUnified(resolution: CanonicalPlaceResolution): MapCoordinate {
  if (
    resolution.status === 'ambiguous' ||
    resolution.status === 'unresolved' ||
    resolution.status === 'normalization-only'
  ) {
    return UNRESOLVED
  }

  if (resolution.latitude == null || resolution.longitude == null || !resolution.projected) {
    return UNRESOLVED
  }

  return {
    x: resolution.projected.x,
    y: resolution.projected.y,
    resolved: true,
    region: regionFromResolution(resolution),
    displayRegion: displayRegionFromResolution(resolution),
  }
}
