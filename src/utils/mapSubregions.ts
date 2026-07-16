import type { FamilyRegion, FamilyRegionId } from './mapRegions'
import { inferRegionId, type RegionEllipse } from './mapRegions'
import { buildRegionGeometry, type MapBounds } from './mapRegionGeometry'
import type { PlaceRecord } from './placeIndex'
import { generateClusterTitle } from './mapClusterTitles'

export type MapSubregion = {
  id: string
  parentRegionId: FamilyRegionId
  name: string
  subtitle: string
  chapterTitle: string
  geoKey: string
  places: PlaceRecord[]
  placeCount: number
  peopleCount: number
  yearMin: number | null
  yearMax: number | null
  ellipse: RegionEllipse
  anchor: { x: number; y: number }
  bounds: MapBounds
}

const SUBREGION_MIN_RX = 4
const SUBREGION_MIN_RY = 3.5
const SUBREGION_PADDING = 3

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

function inferSubregionKey(place: PlaceRecord, parentId: FamilyRegionId): string {
  const name = place.name.toLowerCase()
  const geo = (place.coordinate.region ?? '').toLowerCase()

  if (parentId === 'britain_ireland') {
    if (/scotland|caithness|glasgow|edinburgh|latheron|aberdeen/.test(name) || geo === 'scotland') {
      return 'scotland'
    }
    if (/ireland|dublin|cork|galway/.test(name) || geo === 'ireland') {
      return 'ireland'
    }
    return 'england'
  }

  if (parentId === 'mexico') {
    const parts = place.name.split(',').map((s) => s.trim().toLowerCase())
    if (parts.length >= 2 && parts[parts.length - 1] === 'mexico') {
      const state = parts[parts.length - 2]
      if (state && state !== 'mexico') return state
    }
    if (/chihuahua|carretas|ojinaga|santa isabel|santa ysabel|rosales/.test(name)) return 'chihuahua'
    if (/durango/.test(name)) return 'durango'
    if (/coahuila/.test(name)) return 'coahuila'
    if (/jalisco/.test(name)) return 'jalisco'
    if (/zacatecas/.test(name)) return 'zacatecas'
    return 'mexico'
  }

  if (parentId === 'california') {
    return 'california'
  }

  if (parentId === 'eastern_us' || parentId === 'southwest_us') {
    const parts = place.name.split(',').map((s) => s.trim().toLowerCase())
    for (const part of parts) {
      if (/pennsylvania|monroe|butler|susquehanna|chester|philadelphia/.test(part)) return 'pennsylvania'
      if (/new jersey|camden|essex|morris/.test(part)) return 'new_jersey'
      if (/ohio|cleveland|cincinnati/.test(part)) return 'ohio'
      if (/virginia|maryland|delaware/.test(part)) return 'mid_atlantic'
      if (/illinois|missouri|indiana|wisconsin/.test(part)) return 'midwest'
      if (/texas|el paso|dallas|houston/.test(part)) return 'texas'
      if (/arizona|new mexico|colorado/.test(part)) return 'southwest'
    }
    if (parentId === 'southwest_us') return 'southwest'
    return 'northeast'
  }

  return geo || 'other'
}

const SUBREGION_LABELS: Record<string, { name: string; subtitle: string }> = {
  england: { name: 'England', subtitle: 'Cheshire and early branches' },
  scotland: { name: 'Scotland', subtitle: 'Northern branches' },
  ireland: { name: 'Ireland', subtitle: 'Irish connections' },
  chihuahua: { name: 'Chihuahua', subtitle: 'Ruiz family roots' },
  durango: { name: 'Durango', subtitle: 'Northern Mexico' },
  coahuila: { name: 'Coahuila', subtitle: 'Borderland records' },
  jalisco: { name: 'Jalisco', subtitle: 'Western Mexico' },
  zacatecas: { name: 'Zacatecas', subtitle: 'Central Mexico' },
  mexico: { name: 'Mexico', subtitle: 'Documented places' },
  california: { name: 'California', subtitle: 'Present generations' },
  pennsylvania: { name: 'Pennsylvania', subtitle: 'Colonial and frontier lines' },
  new_jersey: { name: 'New Jersey', subtitle: 'Eastern settlements' },
  ohio: { name: 'Ohio', subtitle: 'Midwest expansion' },
  mid_atlantic: { name: 'Mid-Atlantic', subtitle: 'Coastal branches' },
  midwest: { name: 'Midwest', subtitle: 'Interior migrations' },
  texas: { name: 'Texas', subtitle: 'Southwest movement' },
  southwest: { name: 'Southwest', subtitle: 'Borderland migrations' },
  northeast: { name: 'Northeast', subtitle: 'Eastern United States' },
}

export function buildSubregions(
  places: PlaceRecord[],
  parentRegions: FamilyRegion[],
): MapSubregion[] {
  const regionById = new Map(parentRegions.map((r) => [r.id, r]))
  const groups = new Map<string, PlaceRecord[]>()

  for (const place of places) {
    if (!place.coordinate.resolved) continue
    const parentId = inferRegionId(place)
    if (!parentId || !regionById.has(parentId)) continue
    const key = `${parentId}:${inferSubregionKey(place, parentId)}`
    const list = groups.get(key) ?? []
    list.push(place)
    groups.set(key, list)
  }

  const subs: MapSubregion[] = []

  for (const [key, subPlaces] of groups) {
    const [parentRegionId, subKey] = key.split(':') as [FamilyRegionId, string]
    const coords = subPlaces.map((p) => ({ x: p.coordinate.x, y: p.coordinate.y }))
    const weights = subPlaces.map((p) => Math.max(1, p.people.length + p.eventCount * 0.25))
    const geometry = buildRegionGeometry(
      coords,
      weights,
      SUBREGION_MIN_RX,
      SUBREGION_MIN_RY,
      SUBREGION_PADDING,
    )
    const peopleIds = new Set<string>()
    let yearMin: number | null = null
    let yearMax: number | null = null

    for (const pl of subPlaces) {
      pl.people.forEach((p) => peopleIds.add(p.id))
      if (pl.yearMin != null) yearMin = yearMin == null ? pl.yearMin : Math.min(yearMin, pl.yearMin)
      if (pl.yearMax != null) yearMax = yearMax == null ? pl.yearMax : Math.max(yearMax, pl.yearMax)
    }

    const label = SUBREGION_LABELS[subKey] ?? {
      name: titleCase(subKey.replace(/_/g, ' ')),
      subtitle: 'Documented places',
    }

    const parentRegion = regionById.get(parentRegionId)
    const chapterTitle = generateClusterTitle({
      places: subPlaces,
      depth: 'subregion',
      yearMin,
      yearMax,
      parentTitle: parentRegion?.chapterTitle,
      regionId: parentRegionId,
      subregionKey: subKey,
      geoKey: subKey,
    })

    subs.push({
      id: key,
      parentRegionId,
      name: label.name,
      subtitle: label.subtitle,
      chapterTitle,
      geoKey: subKey,
      places: subPlaces,
      placeCount: subPlaces.length,
      peopleCount: peopleIds.size,
      yearMin,
      yearMax,
      ellipse: { cx: geometry.cx, cy: geometry.cy, rx: geometry.rx, ry: geometry.ry },
      anchor: { x: geometry.anchorX, y: geometry.anchorY },
      bounds: geometry.bounds,
    })
  }

  return subs.sort((a, b) => b.placeCount - a.placeCount)
}

export function subregionsForRegion(
  subregions: MapSubregion[],
  regionId: FamilyRegionId,
): MapSubregion[] {
  return subregions.filter((s) => s.parentRegionId === regionId)
}
