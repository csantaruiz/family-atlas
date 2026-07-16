import type { PlaceRecord } from './placeIndex'
import { generateClusterTitle } from './mapClusterTitles'
import {
  buildRegionGeometry,
  type MapBounds,
  type RegionGeometry,
  verifyContainment,
} from './mapRegionGeometry'

export type FamilyRegionId =
  | 'britain_ireland'
  | 'eastern_us'
  | 'california'
  | 'mexico'
  | 'southwest_us'

export type RegionEllipse = {
  cx: number
  cy: number
  rx: number
  ry: number
}

export type FamilyRegion = {
  id: FamilyRegionId
  name: string
  subtitle: string
  chapterTitle: string
  places: PlaceRecord[]
  placeCount: number
  peopleCount: number
  yearMin: number | null
  yearMax: number | null
  branches: string[]
  ellipse: RegionEllipse
  anchor: { x: number; y: number }
  bounds: MapBounds
}

const REGION_META: Record<
  FamilyRegionId,
  { name: string; subtitle: string }
> = {
  britain_ireland: { name: 'Britain & Ireland', subtitle: 'early documented branches' },
  eastern_us: { name: 'Eastern United States', subtitle: 'Hendry and related lines' },
  california: { name: 'California', subtitle: 'present generations' },
  mexico: { name: 'Mexico', subtitle: 'Ruiz family roots' },
  southwest_us: { name: 'Southwest United States', subtitle: 'borderland migrations' },
}

const MIN_RX = 8
const MIN_RY = 7
const PADDING = 6

export function inferRegionId(place: PlaceRecord): FamilyRegionId | null {
  if (!place.coordinate.resolved) return null

  const display = (place.coordinate.displayRegion ?? '').toLowerCase()
  const region = (place.coordinate.region ?? '').toLowerCase()
  const { x, y } = place.coordinate

  if (/britain|ireland|england|scotland/.test(display) || /england|scotland|ireland/.test(region)) {
    return 'britain_ireland'
  }
  if (/california/.test(display) || (region === 'united states' && x < 25 && y >= 34 && y <= 44)) {
    return 'california'
  }
  if (/mexico/.test(display) || region === 'mexico') {
    return 'mexico'
  }
  if (/southwest/.test(display) || (region === 'united states' && x >= 20 && x < 30 && y >= 38 && y <= 42)) {
    return 'southwest_us'
  }
  if (
    /eastern|united states|pennsylvania|new jersey/.test(display) ||
    (region === 'united states' && x >= 26 && x < 44)
  ) {
    return 'eastern_us'
  }

  if (x > 44 && y < 40) return 'britain_ireland'
  if (x < 25 && y >= 34 && y <= 44) return 'california'
  if (y > 40.5 && x >= 18 && x < 30) return 'mexico'
  if (x >= 20 && x < 30 && y >= 38 && y <= 41.5) return 'southwest_us'
  if (x >= 26 && x < 44 && y >= 32 && y < 42) return 'eastern_us'

  return null
}

export function computeRegionEllipse(
  coords: { x: number; y: number }[],
  minRx = MIN_RX,
  minRy = MIN_RY,
  padding = PADDING,
): RegionEllipse {
  const geometry = buildRegionGeometry(coords, undefined, minRx, minRy, padding)
  return { cx: geometry.cx, cy: geometry.cy, rx: geometry.rx, ry: geometry.ry }
}

export function computeRegionGeometry(
  places: PlaceRecord[],
  minRx = MIN_RX,
  minRy = MIN_RY,
  padding = PADDING,
): RegionGeometry {
  const coords = places
    .filter((p) => p.coordinate.resolved)
    .map((p) => ({ x: p.coordinate.x, y: p.coordinate.y }))
  const weights = places
    .filter((p) => p.coordinate.resolved)
    .map((p) => Math.max(1, p.people.length + p.eventCount * 0.25))

  const geometry = buildRegionGeometry(coords, weights, minRx, minRy, padding)
  const check = verifyContainment(coords, geometry)
  if (!check.contained && import.meta.env.DEV) {
    console.debug('[mapRegions] anchor containment outliers', check.outliers.length)
  }
  return geometry
}

export function buildFamilyRegions(places: PlaceRecord[]): FamilyRegion[] {
  const groups = new Map<FamilyRegionId, PlaceRecord[]>()

  for (const place of places) {
    const id = inferRegionId(place)
    if (!id) continue
    const list = groups.get(id) ?? []
    list.push(place)
    groups.set(id, list)
  }

  const order: FamilyRegionId[] = [
    'britain_ireland',
    'eastern_us',
    'california',
    'southwest_us',
    'mexico',
  ]

  return order
    .filter((id) => groups.has(id))
    .map((id) => {
      const regionPlaces = groups.get(id)!
      const geometry = computeRegionGeometry(regionPlaces)

      const peopleIds = new Set<string>()
      const branches = new Set<string>()
      let yearMin: number | null = null
      let yearMax: number | null = null

      for (const pl of regionPlaces) {
        pl.people.forEach((p) => peopleIds.add(p.id))
        pl.branches.forEach((b) => branches.add(b))
        if (pl.yearMin != null) yearMin = yearMin == null ? pl.yearMin : Math.min(yearMin, pl.yearMin)
        if (pl.yearMax != null) yearMax = yearMax == null ? pl.yearMax : Math.max(yearMax, pl.yearMax)
      }

      const meta = REGION_META[id]
      const chapterTitle = generateClusterTitle({
        places: regionPlaces,
        depth: 'region',
        yearMin,
        yearMax,
        regionId: id,
        geoKey: id,
      })
      return {
        id,
        name: meta.name,
        subtitle: meta.subtitle,
        chapterTitle,
        places: regionPlaces,
        placeCount: regionPlaces.length,
        peopleCount: peopleIds.size,
        yearMin,
        yearMax,
        branches: [...branches],
        ellipse: { cx: geometry.cx, cy: geometry.cy, rx: geometry.rx, ry: geometry.ry },
        anchor: { x: geometry.anchorX, y: geometry.anchorY },
        bounds: geometry.bounds,
      }
    })
}

export function regionForCoordinate(
  x: number,
  y: number,
  regions: FamilyRegion[],
): FamilyRegionId | null {
  for (const region of regions) {
    const { cx, cy, rx, ry } = region.ellipse
    const nx = (x - cx) / rx
    const ny = (y - cy) / ry
    if (nx * nx + ny * ny <= 1.2) return region.id
  }
  if (x > 44 && y < 40) return 'britain_ireland'
  if (x < 25 && y >= 34 && y <= 44) return 'california'
  if (y > 40.5 && x >= 18 && x < 30) return 'mexico'
  if (x >= 20 && x < 30 && y >= 38 && y <= 41.5) return 'southwest_us'
  if (x >= 26 && x < 44 && y >= 32 && y < 42) return 'eastern_us'
  return null
}

export function mergeRegionPlaces(region: FamilyRegion): PlaceRecord {
  const peopleMap = new Map<string, PlaceRecord['people'][0]>()
  const events: PlaceRecord['events'] = []
  const branches = new Set<string>()
  let yearMin: number | null = region.yearMin
  let yearMax: number | null = region.yearMax

  for (const pl of region.places) {
    pl.people.forEach((p) => peopleMap.set(p.id, p))
    events.push(...pl.events)
    pl.branches.forEach((b) => branches.add(b))
  }

  return {
    id: region.id,
    name: region.name,
    coordinate: {
      x: region.anchor.x,
      y: region.anchor.y,
      resolved: true,
      region: region.name,
      displayRegion: region.name,
    },
    people: [...peopleMap.values()],
    events,
    branches: [...branches],
    yearMin,
    yearMax,
    eventCount: events.length,
  }
}
