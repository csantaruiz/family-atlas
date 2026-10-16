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

function clampNarration(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= 80) return words.join(' ')
  return `${words.slice(0, 78).join(' ')}…`
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

function listNames(people: Person[], limit = 3): string {
  const names = people.slice(0, limit).map((p) => p.name.split(' ')[0] || p.name)
  if (names.length === 0) return 'documented ancestors'
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
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
  const originPeople = earliestPeople.filter((p) => placeLabel(p)).slice(0, 3)
  const originFocus = originPeople.length > 0 ? originPeople : earliestPeople.slice(0, 3)
  if (originFocus.length > 0) {
    const years = originFocus.map((p) => p.birthYear as number)
    const yMin = Math.min(...years)
    const yMax = Math.max(...years)
    const places = [
      ...new Set(originFocus.map(placeLabel).filter((p): p is string => Boolean(p))),
    ].slice(0, 3)
    const placePhrase =
      places.length > 0 ? places.join(', ') : 'places still waiting for fuller place evidence'
    const narration = clampNarration(
      `The archive opens in ${formatYear(earliest)}. Among the earliest documented lives are ${listNames(originFocus)}, recorded near ${placePhrase}. From here the tree stretches across ${Math.round(spanYears)} years — a span of generations, not a single origin story.`,
    )
    chapters.push({
      id: 'origins',
      kind: 'origins',
      title: 'Origins',
      narration,
      view: 'journey',
      camera: {
        center: (yMin + yMax) / 2,
        span: Math.max(60, Math.min(140, yMax - yMin + 40)),
      },
      highlightPersonIds: originFocus.map((p) => p.id),
      openPersonId: originFocus[0]?.id ?? null,
      openHistory: null,
      mapIntent: null,
      evidenceNote: null,
    })
  }

  // ── Chapter 2: Different Worlds (branches by region) ────────────────
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
    const picks = regionEntries.slice(0, 3).map((entry) => {
      // Prefer a mid-early person so branches feel concurrent, not one root.
      const idx = Math.min(2, Math.floor(entry.people.length / 3))
      return { regionId: entry.regionId, person: entry.people[idx] ?? entry.people[0] }
    })
    const pickPeople = picks.map((p) => p.person)
    const years = pickPeople.map((p) => p.birthYear as number)
    const yMin = Math.min(...years)
    const yMax = Math.max(...years)
    const branchPhrase = picks
      .map((p) => `${p.person.name.split(' ')[0]} in ${regionDisplayName(p.regionId)}`)
      .join('; ')
    const narration = clampNarration(
      `These lines did not share one homeland. Documented branches appear in different worlds at once — ${branchPhrase}. The Atlas holds them side by side without declaring a single beginning.`,
    )
    chapters.push({
      id: 'branches',
      kind: 'branches',
      title: 'Different Worlds',
      narration,
      view: 'journey',
      camera: {
        center: (yMin + yMax) / 2,
        span: Math.max(90, Math.min(220, yMax - yMin + 50)),
      },
      highlightPersonIds: pickPeople.map((p) => p.id),
      openPersonId: null,
      openHistory: null,
      mapIntent: null,
      evidenceNote: null,
    })
  }

  // ── Chapter 3: A World in Change ────────────────────────────────────
  const scoredHistory = worldHistory
    .map((event) => {
      const nearby = familyEvents.filter(
        (fe) => Math.abs(fe.year - event.year) <= 35 && fe.importance >= 2,
      )
      if (nearby.length === 0) return null
      const score =
        event.importance * 12 +
        nearby.length * 4 +
        nearby.reduce((sum, fe) => sum + fe.importance, 0)
      return { event, nearby, score }
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .sort((a, b) => b.score - a.score)

  const worldPick = scoredHistory[0]
  if (worldPick) {
    const subject = worldPick.nearby.sort((a, b) => b.importance - a.importance)[0]
    const narration = clampNarration(
      `Around ${formatYear(worldPick.event.year)}, ${worldPick.event.title.toLowerCase()} reshaped ${worldPick.event.country}. In the family archive, lives such as ${subject.person.name} are documented near this period. Shared years are not proof of participation — only that personal records and world history coincide.`,
    )
    chapters.push({
      id: 'world_in_change',
      kind: 'world_in_change',
      title: 'A World in Change',
      narration,
      view: 'journey',
      camera: {
        center: worldPick.event.year,
        span: Math.max(40, Math.min(90, 55)),
      },
      highlightPersonIds: uniqueById(worldPick.nearby.map((e) => e.person))
        .slice(0, 4)
        .map((p) => p.id),
      openPersonId: null,
      openHistory: worldPick.event,
      mapIntent: null,
      evidenceNote: null,
    })
  }

  // ── Chapter 4: Journeys (documented migrations) ─────────────────────
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
        : 'years still being refined'
    const who =
      bestRoute.people.length > 0
        ? listNames(
            bestRoute.people
              .map((p) => database.people.find((person) => person.id === p.id))
              .filter((p): p is Person => Boolean(p)),
            3,
          )
        : 'documented family members'
    const confidence =
      bestRoute.confidence === 'documented'
        ? 'Supported by move events linking known places.'
        : 'Inferred from place changes in the tree — presented as regional connection, not a verified travel corridor.'
    const narration = clampNarration(
      `Journeys follows movement the records can support. ${who} connect ${bestRoute.fromName} and ${bestRoute.toName} around ${yearLabel}. ${confidence}`,
    )
    chapters.push({
      id: 'journeys',
      kind: 'journeys',
      title: 'Journeys Across Generations',
      narration,
      view: 'map',
      highlightPersonIds: bestRoute.people.slice(0, 4).map((p) => p.id),
      openPersonId: bestRoute.people[0]?.id ?? null,
      openHistory: null,
      mapIntent: { type: 'route', routeId: bestRoute.id },
      evidenceNote: confidence,
    })
  } else if (regions.length >= 2) {
    const top = [...regions].sort((a, b) => b.peopleCount - a.peopleCount).slice(0, 3)
    const narration = clampNarration(
      `When individual migration corridors are thin, geography still speaks. Documented lives gather in ${top.map((r) => r.name).join(', ')}. This chapter shows distribution the places support — without inventing routes between them.`,
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
    })
  }

  // ── Chapter 5: The Family Today ─────────────────────────────────────
  const recent = [...people].sort((a, b) => (b.birthYear ?? 0) - (a.birthYear ?? 0)).slice(0, 6)
  const root = database.people.find((p) => p.id === database.root) ?? recent[0]
  const presentFocus = uniqueById([root, ...recent].filter(Boolean)).slice(0, 4)
  if (presentFocus.length > 0) {
    const y = presentFocus.map((p) => p.birthYear as number)
    const narration = clampNarration(
      `The archive arrives near the present with ${listNames(presentFocus)}. What came before — separate branches, shared eras, and documented movements — gathers here. Now explore the stories that brought us here.`,
    )
    chapters.push({
      id: 'present',
      kind: 'present',
      title: 'The Family Today',
      narration,
      view: 'journey',
      camera: {
        center: (Math.min(...y) + Math.max(...y)) / 2,
        span: Math.max(50, Math.min(100, Math.max(...y) - Math.min(...y) + 30)),
      },
      highlightPersonIds: presentFocus.map((p) => p.id),
      openPersonId: root?.id ?? presentFocus[0]?.id ?? null,
      openHistory: null,
      mapIntent: null,
      evidenceNote: null,
    })
  }

  // Drop empty narrations / over-long safety
  return chapters.filter((c) => wordCount(c.narration) >= 12)
}

function pickBestRoute(routes: RegionalRoute[]): RegionalRoute | null {
  if (routes.length === 0) return null
  const scored = routes
    .map((route) => {
      const yearSpan =
        route.yearMin != null && route.yearMax != null
          ? Math.max(0, route.yearMax - route.yearMin)
          : 0
      const documentedBonus = route.confidence === 'documented' ? 40 : 0
      const score = documentedBonus + route.moveCount * 8 + route.people.length * 5 + Math.min(30, yearSpan / 4)
      return { route, score }
    })
    .sort((a, b) => b.score - a.score)
  return scored[0]?.route ?? null
}
