import type { FamilyDatabase, FamilyEvent, HistoryEvent, Person } from '../types'
import { historyEvents } from '../data/historyEvents'
import { resolveExploreMapCoordinate } from '../data/placeCoordinates'
import { buildFamilyRegions, inferRegionId, type FamilyRegionId } from '../utils/mapRegions'
import { buildMigrationSegments, buildPlaceIndex } from '../utils/placeIndex'
import { buildRegionalRoutes, type RegionalRoute } from '../utils/mapRoutes'
import type { GuidedChapter } from './types'

export type GuidedChapterInput = {
  database: FamilyDatabase
  familyEvents: FamilyEvent[]
  /** Optional override for tests. Defaults to curated world-history list. */
  worldHistory?: HistoryEvent[]
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function clampNarration(text: string, maxWords = 55): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return words.join(' ')
  return `${words.slice(0, maxWords - 1).join(' ')}…`
}

function peopleWithBirthYear(people: Person[]): Person[] {
  return people
    .filter((p) => typeof p.birthYear === 'number' && Number.isFinite(p.birthYear))
    .sort((a, b) => (a.birthYear ?? 0) - (b.birthYear ?? 0))
}

function placeLabel(person: Person): string | null {
  const raw = person.birthPlace?.trim() || person.places?.[0]?.trim() || null
  if (!raw || raw.length < 3) return null
  if (/not recorded|not located/i.test(raw)) return null
  return raw
}

function regionForPerson(person: Person): FamilyRegionId | null {
  const place = placeLabel(person)
  if (!place) return null
  const coord = resolveExploreMapCoordinate(place)
  if (!coord.resolved) return null
  return inferRegionId({
    id: place,
    name: place,
    coordinate: coord,
    people: [person],
    events: [],
    yearMin: person.birthYear ?? null,
    yearMax: person.deathYear ?? person.birthYear ?? null,
    branches: [],
    eventCount: 0,
  })
}

function uniqueById(people: Person[]): Person[] {
  const seen = new Set<string>()
  const out: Person[] = []
  for (const p of people) {
    if (seen.has(p.id)) continue
    seen.add(p.id)
    out.push(p)
  }
  return out
}

function formatYear(year: number): string {
  return String(Math.round(year))
}

function shortPlace(place: string): string {
  const parts = place.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) return parts.slice(-2).join(', ')
  return place
}

function regionDisplayName(id: FamilyRegionId): string {
  const names: Record<FamilyRegionId, string> = {
    britain_ireland: 'Britain and Ireland',
    eastern_us: 'the Eastern United States',
    california: 'California',
    mexico: 'Mexico',
    southwest_us: 'the Southwest United States',
  }
  return names[id]
}

const PREFERRED_ROUTE_KEYS = new Set([
  'mexico->california',
  'mexico->southwest_us',
  'southwest_us->california',
  'britain_ireland->eastern_us',
  'eastern_us->california',
  'california->southwest_us',
])

/**
 * Score and assemble guided chapters from family data.
 * Never invents migrations, routes, or participation in world events.
 * Skips chapter kinds that lack supporting evidence.
 */
export function selectGuidedChapters(input: GuidedChapterInput): GuidedChapter[] {
  const { database, familyEvents } = input
  const worldHistory = input.worldHistory ?? historyEvents
  const people = peopleWithBirthYear(database.people)
  if (people.length === 0) return []

  const earliest = database.stats.earliestYear
  const latest = database.stats.latestYear
  const spanYears = Math.max(40, latest - earliest)
  const chapters: GuidedChapter[] = []

  // ── Chapter 1: Origins ──────────────────────────────────────────────
  const earliestPeople = uniqueById(people.slice(0, 8))
  const originPeople = earliestPeople.filter((p) => placeLabel(p)).slice(0, 2)
  const originFocus = originPeople.length > 0 ? originPeople : earliestPeople.slice(0, 2)
  const originLead = originFocus[0]
  if (originLead) {
    const place = placeLabel(originLead)
    const years = originFocus.map((p) => p.birthYear as number)
    const yMin = Math.min(...years)
    const yMax = Math.max(...years)
    const narration = clampNarration(
      place
        ? `The archive begins in ${formatYear(earliest)}. ${originLead.name} stands near its earliest edge, recorded in ${shortPlace(place)}. From this slender start, the tree stretches across ${Math.round(spanYears)} years — not one origin, but a long trail of evidence.`
        : `The archive begins in ${formatYear(earliest)}. ${originLead.name} stands near its earliest edge. From this slender start, the tree stretches across ${Math.round(spanYears)} years — not one origin, but a long trail of evidence.`,
    )
    chapters.push({
      id: 'origins',
      kind: 'origins',
      title: 'Origins',
      narration,
      view: 'journey',
      camera: {
        center: originLead.birthYear as number,
        span: Math.max(50, Math.min(100, yMax - yMin + 36)),
      },
      highlightPersonIds: [originLead.id],
      openPersonId: null,
      openHistory: null,
      mapIntent: null,
      evidenceNote: null,
      focusLabel: originLead.name,
    })
  }

  // ── Chapter 2: Different Worlds — map shows geography that words claim ─
  const byRegion = new Map<FamilyRegionId, Person[]>()
  for (const person of people) {
    const region = regionForPerson(person)
    if (!region) continue
    const list = byRegion.get(region) ?? []
    list.push(person)
    byRegion.set(region, list)
  }
  const regionEntries = [...byRegion.entries()]
    .map(([regionId, list]) => ({
      regionId,
      people: uniqueById(list).sort((a, b) => (a.birthYear ?? 0) - (b.birthYear ?? 0)),
    }))
    .filter((entry) => entry.people.length > 0)
    .sort((a, b) => b.people.length - a.people.length)

  if (regionEntries.length >= 2) {
    const top = regionEntries.slice(0, 3)
    const names = top.map((e) => regionDisplayName(e.regionId))
    const placePhrase =
      names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
    const narration = clampNarration(
      `These lives did not share one homeland. Documented places gather across ${placePhrase}. The map holds them together without naming a single beginning.`,
    )
    chapters.push({
      id: 'branches',
      kind: 'branches',
      title: 'Different Worlds',
      narration,
      view: 'map',
      highlightPersonIds: top.flatMap((e) => e.people.slice(0, 1).map((p) => p.id)),
      openPersonId: null,
      openHistory: null,
      mapIntent: { type: 'overview' },
      evidenceNote: null,
      focusLabel: 'Documented places',
    })
  }

  // ── Chapter 3: A World in Change ────────────────────────────────────
  const scoredHistory = worldHistory
    .map((event) => {
      const country = event.country.toLowerCase()
      const nearby = familyEvents.filter((fe) => {
        if (Math.abs(fe.year - event.year) > 28 || fe.importance < 2) return false
        return true
      })
      if (nearby.length === 0) return null
      const geoMatched = nearby.filter((fe) => personMatchesHistoryCountry(fe.person, country))
      const pool = geoMatched.length > 0 ? geoMatched : nearby
      // Prefer history events that share geography with family records in range.
      if (geoMatched.length === 0 && /mexico|england|britain|united states|america/.test(country)) {
        return null
      }
      const score =
        event.importance * 12 +
        pool.length * 4 +
        pool.reduce((sum, fe) => sum + fe.importance, 0) +
        geoMatched.length * 18
      return { event, nearby: pool, score }
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .sort((a, b) => b.score - a.score)

  const worldPick = scoredHistory[0]
  if (worldPick) {
    const subject = worldPick.nearby.sort((a, b) => b.importance - a.importance)[0]
    const narration = clampNarration(
      `${formatYear(worldPick.event.year)}. ${worldPick.event.title} reshapes ${worldPick.event.country}. In the archive, ${subject.person.name} is recorded in the same years — a coincidence of calendars, not a claim of participation.`,
    )
    chapters.push({
      id: 'world_in_change',
      kind: 'world_in_change',
      title: 'A World in Change',
      narration,
      view: 'journey',
      camera: {
        center: worldPick.event.year,
        span: 48,
      },
      highlightPersonIds: [subject.person.id],
      openPersonId: null,
      openHistory: null,
      mapIntent: null,
      evidenceNote: null,
      focusLabel: worldPick.event.title,
      focusHistory: worldPick.event,
    })
  }

  // ── Chapter 4: Journeys ─────────────────────────────────────────────
  const places = buildPlaceIndex(database.people, familyEvents, resolveExploreMapCoordinate)
  const migrations = buildMigrationSegments(database.people, familyEvents, resolveExploreMapCoordinate)
  const regions = buildFamilyRegions(places)
  const routes = buildRegionalRoutes(migrations, regions, familyEvents)
  const bestRoute = pickBestRoute(routes)

  if (bestRoute) {
    const yearLabel =
      bestRoute.yearMin != null && bestRoute.yearMax != null
        ? bestRoute.yearMin === bestRoute.yearMax
          ? formatYear(bestRoute.yearMin)
          : `${formatYear(bestRoute.yearMin)}–${formatYear(bestRoute.yearMax)}`
        : null
    const lead =
      bestRoute.people
        .map((p) => database.people.find((person) => person.id === p.id))
        .filter((p): p is Person => Boolean(p))[0] ?? null
    const confidence =
      bestRoute.confidence === 'documented'
        ? 'Supported by move events linking known places.'
        : 'Inferred from place changes — a regional connection, not a verified travel corridor.'
    const narration = clampNarration(
      bestRoute.confidence === 'documented' && lead
        ? `Records place movement between ${bestRoute.fromName} and ${bestRoute.toName}${yearLabel ? ` around ${yearLabel}` : ''}. ${lead.name} appears among the lives on this corridor. The map shows endpoints the evidence supports — not an imagined path between them.`
        : `Place changes in the tree link ${bestRoute.fromName} and ${bestRoute.toName}${yearLabel ? ` across ${yearLabel}` : ''}. ${confidence} The map marks connection, not a reconstructed voyage.`,
    )
    chapters.push({
      id: 'journeys',
      kind: 'journeys',
      title: 'Journeys Across Generations',
      narration,
      view: 'map',
      highlightPersonIds: lead ? [lead.id] : bestRoute.people.slice(0, 2).map((p) => p.id),
      openPersonId: null,
      openHistory: null,
      mapIntent: { type: 'route', routeId: bestRoute.id },
      evidenceNote: confidence,
      focusLabel: `${bestRoute.fromName} → ${bestRoute.toName}`,
    })
  } else if (regions.length >= 2) {
    const top = [...regions].sort((a, b) => b.peopleCount - a.peopleCount).slice(0, 3)
    const narration = clampNarration(
      `When corridors are thin, geography still speaks. Documented lives gather in ${top.map((r) => r.name).join(', ')}. Distribution the places support — without inventing routes between them.`,
    )
    chapters.push({
      id: 'journeys-distribution',
      kind: 'journeys',
      title: 'Journeys Across Generations',
      narration,
      view: 'map',
      highlightPersonIds: [],
      openPersonId: null,
      openHistory: null,
      mapIntent: { type: 'overview' },
      evidenceNote: 'Geographic distribution from resolved places; no route claimed.',
      focusLabel: 'Known places',
    })
  }

  // ── Chapter 5: The Family Today ─────────────────────────────────────
  const recent = [...people].sort((a, b) => (b.birthYear ?? 0) - (a.birthYear ?? 0)).slice(0, 4)
  const root = database.people.find((p) => p.id === database.root) ?? recent[0]
  if (root?.birthYear != null) {
    const y = root.birthYear
    const narration = clampNarration(
      `Near the present, the archive gathers around ${root.name}. What came before — separate worlds, shared eras, and careful geography — arrives here. Now explore the stories that brought us here.`,
    )
    chapters.push({
      id: 'present',
      kind: 'present',
      title: 'The Family Today',
      narration,
      view: 'journey',
      camera: {
        center: y,
        span: 58,
      },
      highlightPersonIds: [root.id],
      openPersonId: null,
      openHistory: null,
      mapIntent: null,
      evidenceNote: null,
      focusLabel: root.name,
    })
  }

  return chapters.filter((c) => wordCount(c.narration) >= 12)
}

function personMatchesHistoryCountry(person: Person, country: string): boolean {
  const place = `${person.birthPlace ?? ''} ${person.deathPlace ?? ''} ${(person.places ?? []).join(' ')}`.toLowerCase()
  if (/mexico/.test(country)) return /mexico|chihuahua|coahuila|durango|sonora/.test(place)
  if (/england|britain|uk|united kingdom/.test(country)) {
    return /england|britain|cheshire|ireland|scotland|wales|lancashire/.test(place)
  }
  if (/united states|america|u\.s/.test(country)) {
    return /united states|usa|california|pennsylvania|new jersey|texas|arizona/.test(place)
  }
  return place.includes(country.slice(0, 6))
}

function pickBestRoute(routes: RegionalRoute[]): RegionalRoute | null {
  if (routes.length === 0) return null
  const scored = routes
    .map((route) => {
      const key = `${route.fromRegionId}->${route.toRegionId}`
      const yearSpan =
        route.yearMin != null && route.yearMax != null
          ? Math.max(0, route.yearMax - route.yearMin)
          : 120
      let score = 0
      if (route.confidence === 'documented') score += 100
      else score += 18
      if (PREFERRED_ROUTE_KEYS.has(key)) score += 55
      if (yearSpan <= 40) score += 40
      else if (yearSpan <= 80) score += 18
      else score -= Math.min(70, (yearSpan - 80) / 2)
      score += Math.min(28, route.moveCount * 3)
      if (route.people.length <= 4) score += 28
      else if (route.people.length <= 8) score += 8
      else score -= 20
      return { route, score }
    })
    .sort((a, b) => b.score - a.score)
  return scored[0]?.route ?? null
}
