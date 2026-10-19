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

function regionShortName(id: FamilyRegionId): string {
  const names: Record<FamilyRegionId, string> = {
    britain_ireland: 'Britain & Ireland',
    eastern_us: 'Eastern United States',
    california: 'California',
    mexico: 'Mexico',
    southwest_us: 'American Southwest',
  }
  return names[id]
}

const CENTURY_WORDS: Record<number, string> = {
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
  9: 'Nine',
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
        ? `The story opens in ${formatYear(earliest)}, at the farthest edge of the record. Among its earliest documented lives is ${originLead.name}, recorded in ${shortPlace(place)}. From here, the family reaches forward across ${Math.round(spanYears)} years.`
        : `The story opens in ${formatYear(earliest)}, at the farthest edge of the record. Among its earliest documented lives is ${originLead.name}. From here, the family reaches forward across ${Math.round(spanYears)} years.`,
    )
    chapters.push({
      id: 'origins',
      kind: 'origins',
      title: 'Origins',
      subtitle: place
        ? `${formatYear(originLead.birthYear as number)} · ${shortPlace(place)}`
        : `${formatYear(earliest)} · The earliest records`,
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
      `These lives did not begin in one homeland. The records gather in ${placePhrase} — separate worlds that would one day belong to the same family.`,
    )
    chapters.push({
      id: 'branches',
      kind: 'branches',
      title: 'Different Worlds',
      subtitle: top.map((e) => regionShortName(e.regionId)).join(' · '),
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
      // Prefer history events that share geography with family records in range.
      if (geoMatched.length === 0 && /mexico|england|britain|united states|america/.test(country)) {
        return null
      }
      const pool = geoMatched.length > 0 ? geoMatched : nearby
      const peopleScores = uniqueById(pool.map((fe) => fe.person)).map((person) => ({
        person,
        relevance: personEventRelevance(person, event.year, country),
      }))
      const meaningful = peopleScores
        .filter((row) => row.relevance >= MEANINGFUL_PERSON_THRESHOLD)
        .sort((a, b) => b.relevance - a.relevance)
      const score =
        event.importance * 12 +
        pool.length * 3 +
        geoMatched.length * 18 +
        (meaningful[0]?.relevance ?? 0)
      return { event, nearby: pool, meaningful, score }
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .sort((a, b) => b.score - a.score)

  // Preferred: the 1914–1945 era, when the curated history list supports the
  // claim and the family records show lives in those years.
  const eraHistory = worldHistory.filter((e) => e.year >= UPHEAVAL_ERA.start && e.year <= UPHEAVAL_ERA.end)
  const eraWorldWars = eraHistory.filter((e) => /world war|\bwwi+\b/i.test(e.title)).length
  const eraDepression = eraHistory.some((e) => /depression/i.test(e.title))
  const eraFamily = familyEvents.filter(
    (fe) => fe.year >= UPHEAVAL_ERA.start && fe.year <= UPHEAVAL_ERA.end,
  )
  const eraBirths = eraFamily.some((fe) => fe.kind === 'birth')
  const eraMarriages = eraFamily.some((fe) => fe.kind === 'marriage')
  const worldPick = scoredHistory[0]

  if (eraWorldWars >= 2 && eraDepression && eraFamily.length >= 3) {
    const recordLine =
      eraBirths && eraMarriages
        ? 'new generations were being born, marriages joined family lines, and lives continued'
        : eraBirths
          ? 'new generations were being born, and lives continued'
          : eraMarriages
            ? 'marriages joined family lines, and lives continued'
            : 'family lives continued'
    const emphasisKinds: FamilyEvent['kind'][] = [
      ...(eraBirths ? (['birth'] as const) : []),
      ...(eraMarriages ? (['marriage'] as const) : []),
    ]
    chapters.push({
      id: 'world_in_change',
      kind: 'world_in_change',
      title: 'A World in Change',
      subtitle: `${UPHEAVAL_ERA.start}–${UPHEAVAL_ERA.end} · An era of upheaval`,
      narration: clampNarration(
        `Two world wars, a global depression, and extraordinary social change transformed the world around these families. In the records, ${recordLine} through an age of profound uncertainty.`,
      ),
      view: 'journey',
      camera: {
        center: (UPHEAVAL_ERA.start + UPHEAVAL_ERA.end) / 2,
        span: 44,
      },
      // Era chapter names no ancestor — context only, never participation.
      highlightPersonIds: [],
      openPersonId: null,
      openHistory: null,
      mapIntent: null,
      evidenceNote: null,
      focusLabel: null,
      focusHistory: null,
      emphasis: {
        years: UPHEAVAL_ERA,
        kinds: emphasisKinds.length > 0 ? emphasisKinds : undefined,
      },
    })
  } else if (worldPick) {
    const subject = worldPick.meaningful[0]?.person ?? null
    const narration = clampNarration(
      subject
        ? `${worldPick.event.title}, ${formatYear(worldPick.event.year)}. The world around the family was changing. ${subject.name} was living through these years — a shared era, not proof of participation.`
        : `${worldPick.event.title}, ${formatYear(worldPick.event.year)}. The world around the family was changing. Family lives in the records share this era — a coincidence of calendars, not a claim that any ancestor took part.`,
    )
    chapters.push({
      id: 'world_in_change',
      kind: 'world_in_change',
      title: 'A World in Change',
      subtitle: `${formatYear(worldPick.event.year)} · ${worldPick.event.country}`,
      narration,
      view: 'journey',
      camera: {
        center: worldPick.event.year,
        span: 48,
      },
      highlightPersonIds: subject ? [subject.id] : [],
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
        ? 'Documented moves · lines join endpoints, not exact routes.'
        : 'Inferred from recorded places · a regional link, not a verified route.'
    const travelers = bestRoute.people.length
    const narration = clampNarration(
      bestRoute.confidence === 'documented' && lead
        ? `${yearLabel ? `Across ${yearLabel}, ` : ''}family records trace movement from ${bestRoute.fromName} to ${bestRoute.toName}. ${lead.name} is among ${travelers > 1 ? `${travelers} lives` : 'the lives'} on this corridor. The records document the moves, though not the reasons behind them.`
        : `Places of life in the records link ${bestRoute.fromName} and ${bestRoute.toName}${yearLabel ? ` across ${yearLabel}` : ''}. The line marks a connection between regions — the journey itself is not recorded.`,
    )
    chapters.push({
      id: 'journeys',
      kind: 'journeys',
      title: 'Journeys Across Generations',
      subtitle: `${bestRoute.fromName} → ${bestRoute.toName}${yearLabel ? ` · ${yearLabel}` : ''}`,
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
      `Not every journey left a record. Documented lives gather in ${top.map((r) => r.name).join(', ')}, and the map shows where they were — without inventing the routes between them.`,
    )
    chapters.push({
      id: 'journeys-distribution',
      kind: 'journeys',
      title: 'Journeys Across Generations',
      subtitle: 'Where the records place them',
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
    const centuries = Math.floor(spanYears / 100)
    const reach =
      centuries >= 2
        ? `${CENTURY_WORDS[centuries] ?? `${centuries}`} centuries`
        : 'Generations'
    const narration = clampNarration(
      `${reach} of records arrive here, in the present. ${root.name}, born in ${formatYear(y)}, inherits every branch that came before — separate homelands, shared eras${bestRoute ? ', and the journeys between them' : ''}.`,
    )
    chapters.push({
      id: 'present',
      kind: 'present',
      title: 'The Family Today',
      subtitle: `${formatYear(y)} – today`,
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

const MEANINGFUL_PERSON_THRESHOLD = 28

const UPHEAVAL_ERA = { start: 1914, end: 1945 } as const

/** Age at event year, or null if not alive / unknown birth. */
export function ageAtHistoricalEvent(person: Person, eventYear: number): number | null {
  if (typeof person.birthYear !== 'number' || !Number.isFinite(person.birthYear)) return null
  if (typeof person.deathYear === 'number' && person.deathYear < eventYear) return null
  return eventYear - person.birthYear
}

/**
 * Score how meaningful a named person–event connection is.
 * Lifespan overlap alone is not enough — prefer documented adults in matching geography.
 */
export function personEventRelevance(person: Person, eventYear: number, country: string): number {
  const age = ageAtHistoricalEvent(person, eventYear)
  if (age === null) {
    // Dead before the event, or no birth year — do not name them.
    if (typeof person.birthYear === 'number' && typeof person.deathYear === 'number' && person.deathYear < eventYear) {
      return -100
    }
    return 0
  }
  // Infants and young children are not meaningful personal connections.
  if (age < 12) return -40
  if (age < 16) return 8

  let score = 0
  if (age >= 16 && age <= 55) score += 42
  else if (age <= 70) score += 28
  else score += 12

  if (personMatchesHistoryCountry(person, country)) score += 22
  else score -= 8

  return score
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
