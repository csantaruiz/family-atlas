import { buildFamilyEvents } from '../../data/buildFamilyEvents'
import { familyDatabase } from '../../data/familyDatabase'
import { dedupeFamilyEvents } from '../../utils/canonicalEvent'
import { buildFamilyRegions, type FamilyRegionId } from '../../utils/mapRegions'
import {
  buildRegionalRoutes,
  curvedRoutePath,
  type RegionalRoute,
  type RouteConfidence,
} from '../../utils/mapRoutes'
import {
  countRegionalDirections,
  countSegmentDirections,
  migrationRouteFlowDuration,
  pickDominantEndpoints,
} from '../../utils/migrationRouteDirection'
import { buildMigrationSegments, buildPlaceIndex, type MigrationSegment } from '../../utils/placeIndex'
import {
  allCanonicalPlaces,
  getCanonicalPlace,
  type ProjectedPlace,
} from '../data/canonicalPlaceRegistry'
import type { GeographicScale, ResolvedRoute, RouteEvidence } from '../types/choreography'
import type { DocumentaryBranch } from '../types/manifest'
import { CLOSING_STAGE_START_MS } from './finaleCameraPolicy'
import {
  resolveFirstMentionTimes,
  resolveLateAddedPlaceIds,
} from './scriptMentionDirector'
import {
  getRevealedGedcomRouteIds,
  markGedcomRouteRevealed,
} from './displayRevealRegistry'

const MIN_CORRIDOR_DISTANCE = 1.5
const MIN_MOVE_COUNT = 1
const MAX_TRANSOCEANIC_ROUTES = 6

type MacroLandmass = 'europe' | 'north_america'

const EUROPE_PLACE_IDS = new Set([
  'britain',
  'england',
  'cheshire',
  'gawsworth',
  'scotland',
  'spain',
])

const REGION_LANDMASS: Record<FamilyRegionId, MacroLandmass> = {
  britain_ireland: 'europe',
  eastern_us: 'north_america',
  california: 'north_america',
  mexico: 'north_america',
  southwest_us: 'north_america',
}

export type GedcomRouteContext = {
  chapter: string
  branch?: DocumentaryBranch
  geographicScale: GeographicScale
  sceneProgress: number
  closingMap: boolean
  timeMs: number
  visiblePlaceIds: string[]
  focusPlaceIds: string[]
}

export type CanonicalMigrationCorridor = {
  id: string
  fromPlaceId: string
  toPlaceId: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  moveCount: number
  confidence: RouteConfidence
  distance: number
  segments: MigrationSegment[]
}

type CachedGedcomRoutes = {
  canonical: CanonicalMigrationCorridor[]
  regional: RegionalRoute[]
}

let cachedRoutes: CachedGedcomRoutes | null = null

const SCALE_RANK: Record<GeographicScale, number> = {
  local: 0,
  regional: 1,
  country: 2,
  continental: 3,
  world: 4,
}

function normalizeGedcomPlace(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function registerAlias(map: Map<string, string>, alias: string, placeId: string): void {
  const key = normalizeGedcomPlace(alias)
  if (key.length < 3) return

  const existingId = map.get(key)
  if (!existingId) {
    map.set(key, placeId)
    return
  }

  const existing = getCanonicalPlace(existingId)
  const incoming = getCanonicalPlace(placeId)
  if (!existing || !incoming) return

  if (incoming.canonicalName.toLowerCase() === key) {
    map.set(key, placeId)
    return
  }

  if (existing.canonicalName.toLowerCase() === key) return

  const existingRank = SCALE_RANK[existing.geographicScale]
  const incomingRank = SCALE_RANK[incoming.geographicScale]
  if (incomingRank > existingRank) map.set(key, placeId)
}

function buildGedcomAliasIndex(): Map<string, string> {
  const aliases = new Map<string, string>()

  for (const place of allCanonicalPlaces()) {
    registerAlias(aliases, place.canonicalName, place.id)
    if (place.region) registerAlias(aliases, place.region, place.id)
    if (place.country) registerAlias(aliases, place.country, place.id)
    if (place.gedcomString) {
      registerAlias(aliases, place.gedcomString, place.id)
      for (const part of place.gedcomString.split(',')) {
        registerAlias(aliases, part, place.id)
      }
    }
  }

  return aliases
}

const GEDCOM_ALIAS_INDEX = buildGedcomAliasIndex()

function patternFallbackPlaceId(gedcomPlace: string): string | null {
  const text = normalizeGedcomPlace(gedcomPlace)
  if (!text) return null

  if (/scotland|caithness|latheron|glasgow|edinburgh|aberdeen|dundee|fife|orkney|shetland/.test(text)) {
    return 'scotland'
  }
  if (/cheshire|gawsworth|sandbach|astbury|bollington|macclesfield|england/.test(text)) {
    return 'cheshire'
  }
  if (/spain|madrid|barcelona|seville|andalusia|castile|galicia/.test(text)) {
    return 'spain'
  }
  if (/ojinaga|carretas/.test(text)) {
    return 'ojinaga'
  }
  if (/chihuahua|mexico|coahuila|durango|zacatecas|tienega|santa isabel|cuiteco/.test(text)) {
    return 'chihuahua'
  }
  if (/el paso|texas|arizona|new mexico/.test(text)) {
    return 'el-paso'
  }
  if (/santa clara|san jose|los angeles|san luis|placerville|rosemead|rescue|california/.test(text)) {
    return 'california'
  }
  if (/panama canal|canal zone/.test(text)) {
    return 'panama-canal-zone'
  }
  if (/pennsylvania|monroe|butler|bradford|lackawanna|northampton|philadelphia|pittsburgh|harrisburg/.test(text)) {
    return 'pennsylvania'
  }
  if (/new jersey|camden|gloucester|passaic|monmouth|mercer|atlantic|haledon|bellmawr|paterson|freehold|towanda/.test(text)) {
    return 'new-jersey'
  }

  return null
}

/** Resolve a raw GEDCOM place string to a documentary canonical place id. */
export function resolveGedcomPlaceToCanonicalId(gedcomPlace: string): string | null {
  const normalized = normalizeGedcomPlace(gedcomPlace)
  if (!normalized) return null

  const direct = GEDCOM_ALIAS_INDEX.get(normalized)
  if (direct) return direct

  const patternMatch = patternFallbackPlaceId(gedcomPlace)
  if (patternMatch) return patternMatch

  let best: { id: string; score: number } | null = null
  for (const [alias, placeId] of GEDCOM_ALIAS_INDEX.entries()) {
    if (alias.length < 5) continue
    if (!normalized.includes(alias)) continue
    const score = alias.length
    if (!best || score > best.score) best = { id: placeId, score }
  }
  if (best) return best.id

  return null
}

function landmassForPlaceId(placeId: string): MacroLandmass | null {
  const id = normalizeRouteEndpoint(placeId)
  if (EUROPE_PLACE_IDS.has(id)) return 'europe'

  const place = getCanonicalPlace(id)
  if (!place) return null

  if (place.country === 'Spain') return 'europe'
  if (place.country === 'United Kingdom' || place.country === 'England' || place.country === 'Scotland') {
    return 'europe'
  }

  return 'north_america'
}

/** True when a corridor crosses an ocean (e.g. Europe ↔ North America). */
export function isTransoceanicPlacePair(fromPlaceId: string, toPlaceId: string): boolean {
  const from = landmassForPlaceId(fromPlaceId)
  const to = landmassForPlaceId(toPlaceId)
  if (!from || !to) return false
  return from !== to
}

function isTransoceanicRegionalRoute(route: RegionalRoute): boolean {
  const from = REGION_LANDMASS[route.fromRegionId]
  const to = REGION_LANDMASS[route.toRegionId]
  return from !== to
}

function placesSpanTransoceanic(places: Set<string>): boolean {
  let europe = false
  let america = false
  for (const placeId of places) {
    const landmass = landmassForPlaceId(placeId)
    if (landmass === 'europe') europe = true
    if (landmass === 'north_america') america = true
  }
  return europe && america
}

function isCheshireAtlanticBeat(context: GedcomRouteContext): boolean {
  return context.chapter === 'Origins in Cheshire' && context.timeMs >= 66_000
}

function gedcomRoutesVisible(context: GedcomRouteContext): boolean {
  if (context.closingMap) return true
  if (context.timeMs >= CLOSING_STAGE_START_MS) return true

  const scale = context.geographicScale
  const places = placeSet(context)

  if (scale === 'local') return false

  if (isCheshireAtlanticBeat(context)) return true

  if (scale === 'regional') {
    return placesSpanTransoceanic(places)
  }

  if (scale === 'world' || scale === 'continental') {
    return context.timeMs >= 66_000
  }

  if (scale === 'country') {
    if (placesSpanTransoceanic(places)) return true
    if ([...places].some((id) => landmassForPlaceId(id) === 'north_america')) return true
    if (context.branch === 'spanish-mexican' && places.has('spain') && context.timeMs >= 94_000) {
      return true
    }
    return false
  }

  return false
}

function normalizeRouteEndpoint(placeId: string): string {
  if (placeId === 'camden' || placeId === 'gloucester-city') return 'new-jersey'
  if (placeId === 'gawsworth') return 'cheshire'
  if (placeId === 'santa-clara') return 'california'
  return placeId
}

function corridorFromPlaces(
  fromPlace: ProjectedPlace,
  toPlace: ProjectedPlace,
  segment: MigrationSegment,
  confidence: RouteConfidence,
): CanonicalMigrationCorridor | null {
  const fromPlaceId = normalizeRouteEndpoint(fromPlace.id)
  const toPlaceId = normalizeRouteEndpoint(toPlace.id)
  if (fromPlaceId === toPlaceId) return null

  let fromPoint = { x: fromPlace.x, y: fromPlace.y }
  let toPoint = { x: toPlace.x, y: toPlace.y }

  const canonicalFrom = getCanonicalPlace(fromPlaceId)
  const canonicalTo = getCanonicalPlace(toPlaceId)
  if (canonicalFrom && canonicalTo) {
    fromPoint = { x: canonicalFrom.x, y: canonicalFrom.y }
    toPoint = { x: canonicalTo.x, y: canonicalTo.y }
  }

  let distance = Math.hypot(toPoint.x - fromPoint.x, toPoint.y - fromPoint.y)
  const rawDistance = Math.hypot(
    segment.toCoord.x - segment.fromCoord.x,
    segment.toCoord.y - segment.fromCoord.y,
  )

  if (distance < MIN_CORRIDOR_DISTANCE && rawDistance >= MIN_CORRIDOR_DISTANCE) {
    fromPoint = { x: segment.fromCoord.x, y: segment.fromCoord.y }
    toPoint = { x: segment.toCoord.x, y: segment.toCoord.y }
    distance = rawDistance
  }

  if (distance < MIN_CORRIDOR_DISTANCE) return null

  return {
    id: `${fromPlaceId}->${toPlaceId}`,
    fromPlaceId,
    toPlaceId,
    from: fromPoint,
    to: toPoint,
    moveCount: 1,
    confidence,
    distance,
    segments: [segment],
  }
}

function mergeCorridor(
  map: Map<string, CanonicalMigrationCorridor>,
  corridor: CanonicalMigrationCorridor,
): void {
  const existing = map.get(corridor.id)
  if (!existing) {
    map.set(corridor.id, corridor)
    return
  }

  existing.moveCount += corridor.moveCount
  existing.segments.push(...corridor.segments)
  if (corridor.confidence === 'documented') existing.confidence = 'documented'
}

function segmentConfidence(segment: MigrationSegment, events: ReturnType<typeof buildFamilyEvents>): RouteConfidence {
  const hasMoveEvent = events.some(
    (event) =>
      event.person.id === segment.personId &&
      event.kind === 'move' &&
      (event.detail.includes(segment.from) || event.detail.includes(segment.to)),
  )
  return hasMoveEvent ? 'documented' : 'inferred'
}

function loadGedcomRoutes(): CachedGedcomRoutes {
  if (cachedRoutes) return cachedRoutes

  const people = familyDatabase.people
  const events = dedupeFamilyEvents(buildFamilyEvents(people))
  const places = buildPlaceIndex(people, events)
  const migrations = buildMigrationSegments(people, events)
  const familyRegions = buildFamilyRegions(places)

  const corridorMap = new Map<string, CanonicalMigrationCorridor>()

  for (const segment of migrations) {
    const fromPlaceId = resolveGedcomPlaceToCanonicalId(segment.from)
    const toPlaceId = resolveGedcomPlaceToCanonicalId(segment.to)
    if (!fromPlaceId || !toPlaceId) continue

    const fromPlace = getCanonicalPlace(fromPlaceId)
    const toPlace = getCanonicalPlace(toPlaceId)
    if (!fromPlace || !toPlace) continue
    if (fromPlace.confidence === 'unresolved' || toPlace.confidence === 'unresolved') continue

    const corridor = corridorFromPlaces(
      fromPlace,
      toPlace,
      segment,
      segmentConfidence(segment, events),
    )
    if (corridor) mergeCorridor(corridorMap, corridor)
  }

  cachedRoutes = {
    canonical: [...corridorMap.values()].sort(
      (a, b) => b.moveCount - a.moveCount || b.distance - a.distance,
    ),
    regional: buildRegionalRoutes(migrations, familyRegions, events),
  }

  return cachedRoutes
}

export function buildCanonicalMigrationCorridors(): CanonicalMigrationCorridor[] {
  return loadGedcomRoutes().canonical
}

function evidenceFromConfidence(confidence: RouteConfidence): RouteEvidence {
  return confidence === 'documented' ? 'confirmed' : 'branch'
}

function opacityForCorridor(
  corridor: CanonicalMigrationCorridor | RegionalRoute,
  closingMap: boolean,
  emphasized: boolean,
): number {
  const documented = corridor.confidence === 'documented'

  let base: number
  if (closingMap) {
    base = emphasized ? (documented ? 0.42 : 0.36) : documented ? 0.36 : 0.3
  } else {
    base = emphasized ? (documented ? 0.46 : 0.4) : documented ? 0.4 : 0.34
  }

  const weight = Math.min(1.1, 0.94 + Math.log2(Math.max(1, corridor.moveCount)) * 0.05)
  return base * weight
}

function resolveCorridorEndpoints(
  corridor: CanonicalMigrationCorridor,
  reverse: CanonicalMigrationCorridor | undefined,
): { from: { x: number; y: number }; to: { x: number; y: number } } {
  const counts = countSegmentDirections(
    [...corridor.segments, ...(reverse?.segments ?? [])],
    corridor.fromPlaceId,
    corridor.toPlaceId,
    resolveGedcomPlaceToCanonicalId,
  )
  return pickDominantEndpoints(corridor.from, corridor.to, counts.forward, counts.reverse)
}

function corridorToResolved(
  id: string,
  from: { x: number; y: number },
  to: { x: number; y: number },
  evidence: RouteEvidence,
  opacity: number,
): ResolvedRoute {
  return {
    id,
    d: curvedRoutePath(from, to),
    evidence,
    opacity,
    drawProgress: 1,
    transoceanic: true,
    flowDurationSec: migrationRouteFlowDuration(from, to),
  }
}

const REGION_PLACE_IDS: Record<FamilyRegionId, readonly string[]> = {
  britain_ireland: ['britain', 'england', 'cheshire', 'gawsworth', 'scotland'],
  eastern_us: ['pennsylvania', 'new-jersey', 'camden', 'gloucester-city', 'philadelphia', 'panama-canal-zone'],
  california: ['california', 'santa-clara'],
  mexico: ['chihuahua', 'ojinaga', 'spain'],
  southwest_us: ['el-paso'],
}

function regionalRouteMatchesContext(
  route: RegionalRoute,
  places: Set<string>,
  branch: DocumentaryBranch | undefined,
): boolean {
  const fromIds = REGION_PLACE_IDS[route.fromRegionId] ?? []
  const toIds = REGION_PLACE_IDS[route.toRegionId] ?? []
  const touchesPlace = [...places].some(
    (placeId) => fromIds.includes(placeId) || toIds.includes(placeId),
  )
  if (touchesPlace) return true

  if (branch === 'british' && route.fromRegionId === 'britain_ireland') return true
  if (branch === 'spanish-mexican' && (route.fromRegionId === 'mexico' || route.toRegionId === 'mexico')) {
    return true
  }
  if (branch === 'eastern-us' && (route.fromRegionId === 'eastern_us' || route.toRegionId === 'eastern_us')) {
    return true
  }

  return false
}

function canonicalRegionalRoute(
  route: RegionalRoute,
  reverse: RegionalRoute | undefined,
  closingMap: boolean,
  emphasized: boolean,
): ResolvedRoute | null {
  const counts = countRegionalDirections(
    [...route.segments, ...(reverse?.segments ?? [])],
    route.fromRegionId,
    route.toRegionId,
  )
  const endpoints = pickDominantEndpoints(route.from, route.to, counts.forward, counts.reverse)

  return corridorToResolved(
    `gedcom-regional-${route.id}`,
    endpoints.from,
    endpoints.to,
    evidenceFromConfidence(route.confidence),
    opacityForCorridor(route, closingMap, emphasized),
  )
}

function placeSet(context: GedcomRouteContext): Set<string> {
  const firstMentions = resolveFirstMentionTimes()
  const mentionedByNow = [...firstMentions.entries()]
    .filter(([_, firstMs]) => firstMs <= context.timeMs)
    .map(([placeId]) => placeId)

  const raw = [
    ...context.visiblePlaceIds,
    ...context.focusPlaceIds,
    ...mentionedByNow,
    ...resolveLateAddedPlaceIds(context.timeMs, context.timeMs + 1),
  ]

  const expanded = new Set<string>()
  for (const placeId of raw) {
    expanded.add(placeId)
    expanded.add(normalizeRouteEndpoint(placeId))
  }
  return expanded
}

function corridorMatchesPlaces(
  corridor: CanonicalMigrationCorridor,
  places: Set<string>,
): boolean {
  return places.has(corridor.fromPlaceId) || places.has(corridor.toPlaceId)
}

function selectTransoceanicCorridors(context: GedcomRouteContext): CanonicalMigrationCorridor[] {
  const places = placeSet(context)

  return buildCanonicalMigrationCorridors()
    .filter(
      (corridor) =>
        corridor.moveCount >= MIN_MOVE_COUNT &&
        isTransoceanicPlacePair(corridor.fromPlaceId, corridor.toPlaceId),
    )
    .sort((a, b) => {
      const aEmphasis = corridorMatchesPlaces(a, places) ? 1 : 0
      const bEmphasis = corridorMatchesPlaces(b, places) ? 1 : 0
      if (aEmphasis !== bEmphasis) return bEmphasis - aEmphasis
      return b.moveCount - a.moveCount || b.distance - a.distance
    })
    .slice(0, MAX_TRANSOCEANIC_ROUTES)
}

function selectTransoceanicRegionalRoutes(context: GedcomRouteContext): RegionalRoute[] {
  const places = placeSet(context)
  const lateStage = context.timeMs >= CLOSING_STAGE_START_MS
  const wideEnough =
    context.closingMap ||
    lateStage ||
    context.geographicScale === 'world' ||
    context.geographicScale === 'continental' ||
    context.geographicScale === 'country'

  return loadGedcomRoutes()
    .regional.filter((route) => {
      if (route.fromRegionId === 'eastern_us' && route.toRegionId === 'britain_ireland') return false
      if (route.fromRegionId === 'california' && route.toRegionId === 'southwest_us') return false
      if (route.moveCount < MIN_MOVE_COUNT) return false
      if (!isTransoceanicRegionalRoute(route)) return false

      if (route.id === 'britain_ireland->eastern_us') {
        if (placesSpanTransoceanic(places)) return true
        if (isCheshireAtlanticBeat(context)) return true
        return (
          wideEnough &&
          (context.branch === 'british' ||
            context.branch === 'eastern-us' ||
            places.has('scotland') ||
            places.has('pennsylvania') ||
            places.has('new-jersey') ||
            places.has('cheshire') ||
            places.has('britain'))
        )
      }

      return wideEnough || regionalRouteMatchesContext(route, places, context.branch)
    })
    .slice(0, MAX_TRANSOCEANIC_ROUTES)
}

function mergeResolvedRoutes(...groups: ResolvedRoute[][]): ResolvedRoute[] {
  const byId = new Map<string, ResolvedRoute>()
  for (const group of groups) {
    for (const route of group) {
      byId.set(route.id, route)
    }
  }
  return [...byId.values()]
}

function buildAllEligibleGedcomRoutes(context: GedcomRouteContext): ResolvedRoute[] {
  const places = placeSet(context)
  const canonical = selectTransoceanicCorridors(context)
  const regional = selectTransoceanicRegionalRoutes(context)
  const allCorridors = buildCanonicalMigrationCorridors()
  const allRegional = loadGedcomRoutes().regional

  const canonicalRoutes = canonical.flatMap((corridor) => {
    const emphasized = corridorMatchesPlaces(corridor, places)
    const reverse = allCorridors.find(
      (candidate) => candidate.id === `${corridor.toPlaceId}->${corridor.fromPlaceId}`,
    )
    const endpoints = resolveCorridorEndpoints(corridor, reverse)
    return [
      corridorToResolved(
        `gedcom-${corridor.id}`,
        endpoints.from,
        endpoints.to,
        evidenceFromConfidence(corridor.confidence),
        opacityForCorridor(corridor, context.closingMap, emphasized),
      ),
    ]
  })

  const regionalRoutes = regional.flatMap((route) => {
    const emphasized = regionalRouteMatchesContext(route, places, context.branch)
    const reverse = allRegional.find(
      (candidate) => candidate.id === `${route.toRegionId}->${route.fromRegionId}`,
    )
    const resolved = canonicalRegionalRoute(route, reverse, context.closingMap, emphasized)
    return resolved ? [resolved] : []
  })

  return [...canonicalRoutes, ...regionalRoutes]
}

function resolveGedcomRouteById(routeId: string, context: GedcomRouteContext): ResolvedRoute | null {
  if (routeId.startsWith('gedcom-regional-')) {
    const regionalId = routeId.slice('gedcom-regional-'.length)
    const route = loadGedcomRoutes().regional.find((candidate) => candidate.id === regionalId)
    if (!route) return null
    const reverse = loadGedcomRoutes().regional.find(
      (candidate) => candidate.id === `${route.toRegionId}->${route.fromRegionId}`,
    )
    return canonicalRegionalRoute(route, reverse, context.closingMap, false)
  }

  if (routeId.startsWith('gedcom-')) {
    const corridorId = routeId.slice('gedcom-'.length)
    const corridor = buildCanonicalMigrationCorridors().find((candidate) => candidate.id === corridorId)
    if (!corridor) return null
    const reverse = buildCanonicalMigrationCorridors().find(
      (candidate) => candidate.id === `${corridor.toPlaceId}->${corridor.fromPlaceId}`,
    )
    const endpoints = resolveCorridorEndpoints(corridor, reverse)
    return corridorToResolved(
      routeId,
      endpoints.from,
      endpoints.to,
      evidenceFromConfidence(corridor.confidence),
      opacityForCorridor(corridor, context.closingMap, false),
    )
  }

  return null
}

function resolvePersistedGedcomRoutes(context: GedcomRouteContext): ResolvedRoute[] {
  const revealed = getRevealedGedcomRouteIds(context.timeMs)
  if (!revealed.length) return []

  return revealed
    .map((routeId) => resolveGedcomRouteById(routeId, context))
    .filter((route): route is ResolvedRoute => route != null)
}

/** GEDCOM-backed migration corridors — transoceanic only, steady opacity (no scene pulsing). */
export function resolveGedcomMigrationRoutes(context: GedcomRouteContext): ResolvedRoute[] {
  const persisted = resolvePersistedGedcomRoutes(context)

  if (!gedcomRoutesVisible(context)) {
    return persisted
  }

  const fresh = buildAllEligibleGedcomRoutes(context)
  for (const route of fresh) {
    markGedcomRouteRevealed(route.id, context.timeMs)
  }

  return mergeResolvedRoutes(persisted, fresh)
}

/** @internal test hook */
export function clearGedcomRouteCache(): void {
  cachedRoutes = null
}

/** @deprecated test-only alias */
export function getGedcomCorridorIdsForTests(): readonly string[] {
  return buildCanonicalMigrationCorridors().map((corridor) => corridor.id)
}
