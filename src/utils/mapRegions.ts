import type { PlaceRecord } from './placeIndex'
import { projectGeo } from './mapProjection'
import { generateClusterTitle } from './mapClusterTitles'
import {
  boundsFromEllipse,
  buildRegionGeometry,
  expandBounds,
  fitFamilyRegionEllipse,
  type MapBounds,
  type MapPoint,
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

const MIN_RX = 4
const MIN_RY = 4
const PADDING = 2.5

/** Geographic label anchors — keep major region names on correct landmasses. */
const REGION_LABEL_GEO: Record<FamilyRegionId, { lon: number; lat: number }> = {
  britain_ireland: { lon: -4.5, lat: 54.5 },
  eastern_us: { lon: -75.0, lat: 40.5 },
  california: { lon: -120.0, lat: 37.4 },
  mexico: { lon: -106.1, lat: 28.6 },
  southwest_us: { lon: -106.5, lat: 31.8 },
}

function regionLabelAnchor(id: FamilyRegionId): { x: number; y: number } {
  const geo = REGION_LABEL_GEO[id]
  return projectGeo(geo.lon, geo.lat)
}

export function inferRegionId(place: PlaceRecord): FamilyRegionId | null {
  if (!place.coordinate.resolved) return null

  const display = (place.coordinate.displayRegion ?? '').toLowerCase()
  const region = (place.coordinate.region ?? '').toLowerCase()
  const { x, y } = place.coordinate

  if (/britain|ireland|england|scotland/.test(display) || /england|scotland|ireland/.test(region)) {
    return 'britain_ireland'
  }
  if (/california/.test(display) || (region === 'united states' && x < 22 && y >= 36 && y <= 42)) {
    return 'california'
  }
  if (/mexico/.test(display) || region === 'mexico') {
    return 'mexico'
  }
  if (/southwest/.test(display) || (region === 'united states' && x >= 20 && x < 28 && y >= 38 && y <= 43)) {
    return 'southwest_us'
  }
  if (
    /eastern|united states|pennsylvania|new jersey/.test(display) ||
    (region === 'united states' && x >= 28 && x < 38)
  ) {
    return 'eastern_us'
  }

  if (x >= 46 && y <= 36) return 'britain_ireland'
  if (x < 22 && y >= 36 && y <= 42) return 'california'
  if (y > 39.5 && x >= 20 && x < 28) return 'mexico'
  if (x >= 20 && x < 28 && y >= 37 && y <= 41.5) return 'southwest_us'
  if (x >= 28 && x < 38 && y >= 35 && y < 40) return 'eastern_us'

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
  regionId: FamilyRegionId,
  minRx = MIN_RX,
  minRy = MIN_RY,
): RegionGeometry {
  const coords: MapPoint[] = places
    .filter((p) => p.coordinate.resolved)
    .map((p) => ({ x: p.coordinate.x, y: p.coordinate.y }))

  const anchor = regionLabelAnchor(regionId)
  const ellipse = fitFamilyRegionEllipse(regionId, coords, anchor, minRx, minRy)
  const check = verifyContainment(coords, ellipse)
  if (!check.contained && import.meta.env.DEV) {
    console.debug('[mapRegions] halo containment outliers', regionId, check.outliers.length)
  }

  return {
    ...ellipse,
    anchorX: anchor.x,
    anchorY: anchor.y,
    bounds: expandBounds(boundsFromEllipse(ellipse), PADDING * 0.25),
  }
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
      const geometry = computeRegionGeometry(regionPlaces, id)

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
        anchor: regionLabelAnchor(id),
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
  if (x >= 46 && y <= 36) return 'britain_ireland'
  if (x < 22 && y >= 36 && y <= 42) return 'california'
  if (y > 39.5 && x >= 20 && x < 28) return 'mexico'
  if (x >= 20 && x < 28 && y >= 37 && y <= 41.5) return 'southwest_us'
  if (x >= 28 && x < 38 && y >= 35 && y < 40) return 'eastern_us'
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
