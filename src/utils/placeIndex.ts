import type { FamilyEvent, Person } from '../types'
import {
  coordinateDistance,
  resolvePlaceCoordinateLegacy,
  type MapCoordinate,
} from '../data/placeCoordinates'
import { placeRegion } from './placeUtils'
import { surnameOf } from './personDirectory'

export type PlaceCoordinateResolver = (place: string) => MapCoordinate

export type PlaceRecord = {
  id: string
  name: string
  coordinate: MapCoordinate
  people: Person[]
  events: FamilyEvent[]
  yearMin: number | null
  yearMax: number | null
  branches: string[]
  eventCount: number
}

export type MigrationSegment = {
  id: string
  personId: string
  personName: string
  from: string
  to: string
  fromCoord: MapCoordinate
  toCoord: MapCoordinate
  year: number | null
}

export type MapFilters = {
  branch: string
  eventType: string
  century: string
  directAncestorsOnly: boolean
}

export const DEFAULT_MAP_FILTERS: MapFilters = {
  branch: '',
  eventType: '',
  century: '',
  directAncestorsOnly: false,
}

function normalizePlaceKey(place: string): string {
  return place.trim().toLowerCase()
}

function isValidPlace(place: string): boolean {
  const s = place.trim().toLowerCase()
  if (!s || s.length < 3) return false
  if (/^(place|birthplace) not recorded$/.test(s)) return false
  if (/not located/i.test(s)) return false
  return true
}

function personPlaces(person: Person): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of [person.birthPlace, person.deathPlace, ...(person.places ?? [])]) {
    const p = raw?.trim()
    if (!p || !isValidPlace(p)) continue
    const key = normalizePlaceKey(p)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out
}

function eventPlace(event: FamilyEvent): string | null {
  if (event.kind === 'birth') {
    const pl = event.person.birthPlace?.trim()
    return pl && isValidPlace(pl) ? pl : null
  }
  if (event.kind === 'death') {
    const pl = event.person.deathPlace?.trim()
    return pl && isValidPlace(pl) ? pl : null
  }
  if (event.kind === 'move') {
    const d = event.detail ?? ''
    if (d.startsWith('From ')) {
      const region = d.replace('From ', '').split(' ·')[0].trim()
      return region || null
    }
    return event.person.places?.[event.person.places.length - 1]?.trim() ?? null
  }
  if (event.kind === 'marriage') {
    const parts = event.detail.split('·').map((part) => part.trim())
    const place = parts.length >= 3 ? parts.slice(2).join(' · ') : ''
    return place && isValidPlace(place) ? place : null
  }
  const pl = event.person.places?.[0] ?? event.person.birthPlace
  return pl?.trim() || null
}

export function buildPlaceIndex(
  people: Person[],
  events: FamilyEvent[],
  resolveCoord: PlaceCoordinateResolver = resolvePlaceCoordinateLegacy,
): PlaceRecord[] {
  const map = new Map<string, PlaceRecord>()

  const ensure = (place: string): PlaceRecord => {
    const key = normalizePlaceKey(place)
    let rec = map.get(key)
    if (!rec) {
      rec = {
        id: key,
        name: place,
        coordinate: resolveCoord(place),
        people: [],
        events: [],
        yearMin: null,
        yearMax: null,
        branches: [],
        eventCount: 0,
      }
      map.set(key, rec)
    }
    return rec
  }

  for (const p of people) {
    for (const place of personPlaces(p)) {
      const rec = ensure(place)
      if (!rec.people.some((x) => x.id === p.id)) rec.people.push(p)
      const branch = surnameOf(p.name)
      if (branch && !rec.branches.includes(branch)) rec.branches.push(branch)
      if (p.birthYear != null) {
        rec.yearMin = rec.yearMin == null ? p.birthYear : Math.min(rec.yearMin, p.birthYear)
        const end = p.deathYear ?? p.birthYear
        rec.yearMax = rec.yearMax == null ? end : Math.max(rec.yearMax, end)
      }
    }
  }

  for (const e of events) {
    const place = eventPlace(e)
    if (!place) continue
    const rec = ensure(place)
    rec.events.push(e)
    rec.eventCount++
    rec.yearMin = rec.yearMin == null ? e.year : Math.min(rec.yearMin, e.year)
    rec.yearMax = rec.yearMax == null ? e.year : Math.max(rec.yearMax, e.year)
    const branch = surnameOf(e.person.name)
    if (branch && !rec.branches.includes(branch)) rec.branches.push(branch)
    if (!rec.people.some((x) => x.id === e.person.id)) rec.people.push(e.person)
  }

  return [...map.values()].sort((a, b) => b.people.length - a.people.length)
}

export function buildMigrationSegments(
  people: Person[],
  events: FamilyEvent[],
  resolveCoord: PlaceCoordinateResolver = resolvePlaceCoordinateLegacy,
): MigrationSegment[] {
  const segments: MigrationSegment[] = []

  for (const p of people) {
    const places = personPlaces(p)
    for (let i = 0; i < places.length - 1; i++) {
      const from = places[i]
      const to = places[i + 1]
      const fromCoord = resolveCoord(from)
      const toCoord = resolveCoord(to)
      if (!fromCoord.resolved || !toCoord.resolved) continue
      if (coordinateDistance(fromCoord, toCoord) < 1.5) continue
      const moveEvent = events.find(
        (e) => e.person.id === p.id && e.kind === 'move' && e.detail.includes(placeRegion(from) || from),
      )
      segments.push({
        id: `${p.id}:${i}`,
        personId: p.id,
        personName: p.name,
        from,
        to,
        fromCoord,
        toCoord,
        year: moveEvent?.year ?? p.birthYear ?? null,
      })
    }
  }

  return segments
}

export function filterPlaces(places: PlaceRecord[], filters: MapFilters): PlaceRecord[] {
  return places.filter((pl) => {
    if (filters.branch && !pl.branches.includes(filters.branch)) return false
    if (filters.directAncestorsOnly && !pl.people.some((p) => p.generation != null)) return false
    if (filters.century) {
      const c = Number(filters.century)
      const inCentury = pl.people.some((p) => p.birthYear != null && Math.floor(p.birthYear / 100) + 1 === c)
      if (!inCentury) return false
    }
    if (filters.eventType) {
      if (!pl.events.some((e) => e.kind === filters.eventType)) return false
    }
    return true
  })
}

export type MapSummary = {
  placeCount: number
  countryCount: number
  countries: string[]
  longestMove: MigrationSegment | null
  unresolvedPlaces: string[]
}

export function computeMapSummary(places: PlaceRecord[], migrations: MigrationSegment[]): MapSummary {
  const countries = new Set<string>()
  places.forEach((pl) => {
    const r = pl.coordinate.region || placeRegion(pl.name)
    if (r) countries.add(r)
  })

  let longestMove: MigrationSegment | null = null
  for (const m of migrations) {
    const dist = coordinateDistance(m.fromCoord, m.toCoord)
    if (!longestMove || dist > coordinateDistance(longestMove.fromCoord, longestMove.toCoord)) {
      longestMove = m
    }
  }

  const unresolvedPlaces = places.filter((p) => !p.coordinate.resolved).map((p) => p.name)

  return {
    placeCount: places.length,
    countryCount: countries.size,
    countries: [...countries],
    longestMove,
    unresolvedPlaces,
  }
}

export type PlaceCluster = {
  id: string
  x: number
  y: number
  places: PlaceRecord[]
  peopleCount: number
  label: string
}

const CLUSTER_RADIUS = 5.5

export function clusterPlaces(places: PlaceRecord[]): PlaceCluster[] {
  const resolved = places.filter((p) => p.coordinate.resolved)
  const clusters: PlaceCluster[] = []
  const used = new Set<string>()

  for (const pl of resolved) {
    if (used.has(pl.id)) continue
    const group = [pl]
    used.add(pl.id)
    for (const other of resolved) {
      if (used.has(other.id)) continue
      const d = coordinateDistance(pl.coordinate, other.coordinate)
      if (d <= CLUSTER_RADIUS) {
        group.push(other)
        used.add(other.id)
      }
    }
    const x = group.reduce((s, g) => s + g.coordinate.x, 0) / group.length
    const y = group.reduce((s, g) => s + g.coordinate.y, 0) / group.length
    const peopleCount = new Set(group.flatMap((g) => g.people.map((p) => p.id))).size
    clusters.push({
      id: group.map((g) => g.id).join('|'),
      x,
      y,
      places: group,
      peopleCount,
      label: group.length === 1 ? shortLabel(group[0].name) : `${group.length} places`,
    })
  }

  return clusters
}

function shortLabel(place: string): string {
  const parts = place.split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 2) return `${parts[0]}, ${parts[parts.length - 1]}`
  return parts[0] || place
}
