import type { FamilyEvent } from '../types'
import { countEventTypes } from './chapterPresentation'
import type { FamilyRegionId } from './mapRegions'
import type { PlaceRecord } from './placeIndex'
import { placeRegion } from './placeUtils'

export type MapClusterDepth = 'region' | 'subregion' | 'place' | 'detail'

export type MapClusterPresentation = {
  title: string
  yearRange: string | null
  stats: string | null
  ctaLabel: string
}

export type MapClusterTitleInput = {
  places: PlaceRecord[]
  depth: MapClusterDepth
  yearMin: number | null
  yearMax: number | null
  parentTitle?: string | null
  geoKey?: string
  regionId?: FamilyRegionId
  subregionKey?: string
}

type TitleCandidate = {
  title: string
  priority: number
  minDepth: MapClusterDepth
}

const DEPTH_RANK: Record<MapClusterDepth, number> = {
  region: 0,
  subregion: 1,
  place: 2,
  detail: 3,
}

function clusterEvents(places: PlaceRecord[]): FamilyEvent[] {
  return places.flatMap((p) => p.events)
}

function dominantSurname(events: FamilyEvent[], places: PlaceRecord[]): string {
  const counts = new Map<string, number>()
  for (const event of events) {
    const parts = event.person.name.trim().split(/\s+/)
    const surname = parts.length > 1 ? parts[parts.length - 1] : parts[0]
    if (!surname) continue
    counts.set(surname, (counts.get(surname) ?? 0) + 1)
  }
  for (const pl of places) {
    for (const b of pl.branches) {
      counts.set(b, (counts.get(b) ?? 0) + 2)
    }
  }
  let best = ''
  let bestCount = 0
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name
      bestCount = count
    }
  }
  return best
}

function leadPerson(events: FamilyEvent[]): FamilyEvent | null {
  const sorted = [...events].sort(
    (a, b) =>
      (a.person.generation ?? 99) - (b.person.generation ?? 99) ||
      (b.importance ?? 0) - (a.importance ?? 0) ||
      a.year - b.year,
  )
  return sorted[0] ?? null
}

/** Place names only — avoids matching migration destinations in unrelated regions. */
function placeNamesBlob(places: PlaceRecord[]): string {
  return places.map((p) => p.name).join(' ').toLowerCase()
}

function shortPlaceLabel(place: string): string {
  return place.split(',')[0].trim() || place
}

function parseMoveEndpoints(detail: string): { from: string; to: string } | null {
  const match = detail.match(/(?:from|in)\s+(.+?)\s+(?:to|into)\s+(.+)/i)
  if (match) {
    return { from: match[1].trim(), to: match[2].trim() }
  }
  const into = detail.split(/\s+into\s+/i)
  if (into.length > 1) {
    return { from: into[0].replace(/^moved?\s+/i, '').trim(), to: into[1].trim() }
  }
  return null
}

function movesOriginatingInRegion(
  places: PlaceRecord[],
  events: FamilyEvent[],
): FamilyEvent[] {
  const localTokens = new Set(
    places.flatMap((place) => {
      const short = shortPlaceLabel(place.name).toLowerCase()
      return [place.name.toLowerCase(), short]
    }),
  )

  return events.filter((event) => {
    if (event.kind !== 'move') return false
    const endpoints = parseMoveEndpoints(event.detail)
    const haystack = `${event.detail} ${event.person.birthPlace ?? ''}`.toLowerCase()
    if (endpoints) {
      const from = endpoints.from.toLowerCase()
      return [...localTokens].some((token) => token.length > 2 && from.includes(token))
    }
    return [...localTokens].some((token) => token.length > 2 && haystack.includes(token))
  })
}

function dominantMoveDestination(moves: FamilyEvent[]): string | null {
  const counts = new Map<string, number>()
  for (const move of moves) {
    const endpoints = parseMoveEndpoints(move.detail)
    const raw = endpoints?.to ?? move.detail.split(/\s+to\s+/i).pop() ?? move.detail
    const region = placeRegion(raw)
    const label = region || shortPlaceLabel(raw)
    if (!label) continue
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  let best: string | null = null
  let bestCount = 0
  for (const [label, count] of counts) {
    if (count > bestCount) {
      best = label
      bestCount = count
    }
  }
  return best
}

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

function isTooSimilar(title: string, parentTitle: string | null | undefined): boolean {
  if (!parentTitle) return false
  const a = normalizeTitle(title)
  const b = normalizeTitle(parentTitle)
  if (!a || !b) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true

  const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 3))
  const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 3))
  if (!wordsA.size || !wordsB.size) return false

  let overlap = 0
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++
  }
  const minSize = Math.min(wordsA.size, wordsB.size)
  return overlap / minSize >= 0.55
}

function historicalEraTitle(yearMin: number, yearMax: number, depth: MapClusterDepth): string | null {
  const mid = (yearMin + yearMax) / 2

  if (yearMax < 1776) {
    return depth === 'region' ? 'Life in the colonial world' : 'Before American independence'
  }
  if (yearMin >= 1861 && yearMax <= 1865) return 'The Civil War generation'
  if (mid >= 1860 && mid < 1914) {
    return depth === 'region' ? 'The Industrial America years' : 'Industrial-age generations'
  }
  if (yearMin >= 1914 && yearMax <= 1945) {
    return depth === 'region' ? 'The WWII generation' : 'Wartime and recovery'
  }
  if (yearMin >= 1820 && yearMax <= 1910 && mid < 1910) {
    return depth === 'region' ? 'Life before Independence' : 'Before the modern era'
  }
  if (yearMin < 1821 && yearMax >= 1780) return 'Life before Independence'
  if (yearMin >= 1945) return depth === 'region' ? 'The living family' : 'Postwar generations'
  return null
}

function migrationTitles(
  events: FamilyEvent[],
  places: PlaceRecord[],
  depth: MapClusterDepth,
  regionId?: FamilyRegionId,
  subregionKey?: string,
): TitleCandidate[] {
  const moves = events.filter((e) => e.kind === 'move')
  if (!moves.length) return []

  const localMoves = movesOriginatingInRegion(places, events)
  const localNames = placeNamesBlob(places)
  const primaryDestination = dominantMoveDestination(localMoves.length ? localMoves : moves)
  const candidates: TitleCandidate[] = []

  if (regionId === 'mexico') {
    if (depth === 'region') {
      candidates.push({ title: 'Arrival in Northern New Spain', priority: 100, minDepth: 'region' })
      candidates.push({ title: 'The frontier years', priority: 95, minDepth: 'region' })
    }
    if (depth === 'subregion' && subregionKey === 'chihuahua') {
      candidates.push({ title: 'The first Chihuahua families', priority: 98, minDepth: 'subregion' })
      candidates.push({ title: 'Settling along the frontier', priority: 92, minDepth: 'subregion' })
    }
    if (depth === 'subregion') {
      candidates.push({ title: 'Building roots in the north', priority: 88, minDepth: 'subregion' })
    }
    if (depth === 'place') {
      candidates.push({ title: 'A family takes root here', priority: 85, minDepth: 'place' })
    }
  }

  if (regionId === 'britain_ireland') {
    if (depth === 'region') {
      candidates.push({ title: 'Crossing the Atlantic', priority: 96, minDepth: 'region' })
      candidates.push({ title: 'Early branches take shape', priority: 90, minDepth: 'region' })
      if (/gawsworth|cheshire|gloucester|lancashire/.test(localNames)) {
        candidates.push({ title: 'English branches before emigration', priority: 92, minDepth: 'region' })
      }
    }
    if (depth === 'subregion' && subregionKey === 'england') {
      candidates.push({ title: 'The English branch emerges', priority: 94, minDepth: 'subregion' })
    }
    if (primaryDestination === 'United States' && depth === 'region') {
      candidates.push({ title: 'Departure for America', priority: 97, minDepth: 'region' })
    }
  }

  if (regionId === 'eastern_us') {
    if (depth === 'region') {
      candidates.push({ title: 'Arrival in America', priority: 96, minDepth: 'region' })
      candidates.push({ title: 'The New Jersey chapter', priority: 88, minDepth: 'region' })
    }
    if (depth === 'subregion' && subregionKey === 'new_jersey') {
      candidates.push({ title: 'Settling the eastern colonies', priority: 93, minDepth: 'subregion' })
    }
    if (depth === 'subregion' && subregionKey === 'pennsylvania') {
      candidates.push({ title: 'Frontier and iron country', priority: 93, minDepth: 'subregion' })
    }
    if (/pennsylvania|new jersey|virginia/.test(localNames) && depth === 'region') {
      candidates.push({ title: 'Colonial and early American roots', priority: 91, minDepth: 'region' })
    }
  }

  if (regionId === 'california') {
    if (depth === 'region') {
      candidates.push({ title: 'Expansion into California', priority: 97, minDepth: 'region' })
    }
    if (depth === 'subregion' || depth === 'place') {
      candidates.push({ title: 'Crossing into California', priority: 91, minDepth: 'subregion' })
    }
    if (/san diego|los angeles|san francisco|sacramento/.test(localNames) && depth === 'region') {
      candidates.push({ title: 'California becomes home', priority: 95, minDepth: 'region' })
    }
  }

  if (regionId === 'southwest_us') {
    if (depth === 'region') {
      candidates.push({ title: 'Borderland migrations', priority: 94, minDepth: 'region' })
    }
  }

  if (localMoves.length >= 3 && depth === 'region') {
    candidates.push({ title: 'A sudden migration wave', priority: 86, minDepth: 'region' })
  }

  if (primaryDestination && depth === 'region') {
    candidates.push({
      title: `Toward ${primaryDestination}`,
      priority: 84,
      minDepth: 'region',
    })
  }

  const dest = placeRegion(moves[0].detail.split('into ')[1] || moves[0].detail)
  if (dest && depth === 'place') {
    candidates.push({ title: `Toward ${dest}`, priority: 80, minDepth: 'place' })
  }

  if (moves.length >= 1) {
    candidates.push({
      title: depth === 'region' ? 'Families in motion' : 'Migration and resettlement',
      priority: 75,
      minDepth: depth,
    })
  }

  return candidates
}

function growthTitles(
  events: FamilyEvent[],
  places: PlaceRecord[],
  depth: MapClusterDepth,
  surname: string,
): TitleCandidate[] {
  const births = events.filter((e) => e.kind === 'birth')
  const candidates: TitleCandidate[] = []

  if (births.length >= 8 && depth === 'region') {
    candidates.push({ title: 'The family rapidly expands', priority: 84, minDepth: 'region' })
  }
  if (births.length >= 4 && depth === 'subregion') {
    candidates.push({ title: 'The first documented children', priority: 82, minDepth: 'subregion' })
  }
  if (births.length >= 3 && depth === 'place') {
    candidates.push({ title: 'Three generations in one valley', priority: 80, minDepth: 'place' })
  }

  const maxPeople = Math.max(...places.map((p) => p.people.length), 0)
  if (maxPeople >= 6) {
    candidates.push({
      title: depth === 'place' ? 'An unusually large household' : 'An unusually large household',
      priority: 78,
      minDepth: 'place',
    })
  }

  if (surname && births.length >= 3) {
    if (depth === 'subregion') {
      candidates.push({ title: `The ${surname} line takes root`, priority: 83, minDepth: 'subregion' })
    }
    if (depth === 'place') {
      candidates.push({ title: `Arrival of the ${surname} branch`, priority: 87, minDepth: 'place' })
    }
    if (depth === 'region') {
      candidates.push({ title: `The ${surname} line expands`, priority: 79, minDepth: 'region' })
    }
  }

  return candidates
}

function anomalyTitles(
  events: FamilyEvent[],
  places: PlaceRecord[],
  yearMin: number | null,
  yearMax: number | null,
  depth: MapClusterDepth,
): TitleCandidate[] {
  const candidates: TitleCandidate[] = []
  if (yearMin == null || yearMax == null) return candidates

  const span = yearMax - yearMin
  const recordCount = events.length || places.reduce((s, p) => s + p.eventCount, 0)

  if (span >= 100 && recordCount <= 8) {
    candidates.push({
      title: depth === 'region' ? 'A century of sparse records' : 'Only scattered evidence survives',
      priority: 72,
      minDepth: 'subregion',
    })
  }

  if (recordCount >= 20 && depth === 'region') {
    candidates.push({ title: 'The best documented branch', priority: 74, minDepth: 'region' })
  }

  if (span >= 120 && depth === 'region') {
    candidates.push({ title: 'More than a century on the timeline', priority: 70, minDepth: 'region' })
  }

  const birthsByDecade = new Map<number, number>()
  for (const e of events.filter((ev) => ev.kind === 'birth')) {
    const decade = Math.floor(e.year / 10) * 10
    birthsByDecade.set(decade, (birthsByDecade.get(decade) ?? 0) + 1)
  }
  for (const [, count] of birthsByDecade) {
    if (count >= 5 && depth === 'place') {
      candidates.push({ title: 'Five births within one decade', priority: 76, minDepth: 'place' })
      break
    }
  }

  const birthYears = events.filter((e) => e.kind === 'birth').map((e) => e.year).sort((a, b) => a - b)
  for (let i = 0; i < birthYears.length - 4; i++) {
    if (birthYears[i + 4] - birthYears[i] <= 6) {
      candidates.push({ title: 'Five births within six years', priority: 77, minDepth: 'place' })
      break
    }
  }

  return candidates
}

function geoFallbackTitle(
  depth: MapClusterDepth,
  geoKey?: string,
  regionId?: FamilyRegionId,
  placeName?: string,
): TitleCandidate[] {
  const candidates: TitleCandidate[] = []

  if (depth === 'region' && regionId) {
    const regional: Record<FamilyRegionId, string> = {
      britain_ireland: 'Building roots across Britain',
      eastern_us: 'The eastern American chapter',
      california: 'The California expansion',
      mexico: 'The northern Mexico chapter',
      southwest_us: 'Borderland migrations',
    }
    candidates.push({ title: regional[regionId], priority: 10, minDepth: 'region' })
  }

  if (depth === 'subregion' && geoKey) {
    const key = geoKey.replace(/_/g, ' ')
    candidates.push({ title: `Settlements in ${titleCase(key)}`, priority: 8, minDepth: 'subregion' })
  }

  if (depth === 'place' && placeName) {
    const short = placeName.split(',')[0].trim()
    candidates.push({ title: `Records from ${short}`, priority: 6, minDepth: 'place' })
  }

  if (depth === 'detail') {
    candidates.push({ title: 'Individual records', priority: 4, minDepth: 'detail' })
  }

  return candidates
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

function pickTitle(
  candidates: TitleCandidate[],
  depth: MapClusterDepth,
  parentTitle?: string | null,
): string {
  const depthRank = DEPTH_RANK[depth]
  const eligible = candidates
    .filter((c) => DEPTH_RANK[c.minDepth] <= depthRank)
    .sort((a, b) => b.priority - a.priority)

  for (const c of eligible) {
    if (!isTooSimilar(c.title, parentTitle)) return c.title
  }

  for (const c of eligible) {
    const suffixed = `${c.title} — a closer look`
    if (!isTooSimilar(suffixed, parentTitle)) return suffixed
  }

  return eligible[0]?.title ?? 'Family records'
}

export function generateClusterTitle(input: MapClusterTitleInput): string {
  const { places, depth, yearMin, yearMax, parentTitle, geoKey, regionId, subregionKey } = input
  const events = clusterEvents(places)
  const surname = dominantSurname(events, places)
  const lead = leadPerson(events)

  const candidates: TitleCandidate[] = []

  candidates.push(
    ...migrationTitles(events, places, depth, regionId, subregionKey),
    ...growthTitles(events, places, depth, surname),
  )

  if (yearMin != null && yearMax != null) {
    const era = historicalEraTitle(yearMin, yearMax, depth)
    if (era) {
      candidates.push({ title: era, priority: 85, minDepth: 'region' })
    }
    if (regionId === 'mexico' && yearMax < 1821) {
      candidates.push({ title: 'Life before Independence', priority: 87, minDepth: 'subregion' })
    }
    const localNames = placeNamesBlob(places)
    if (regionId === 'eastern_us' && /iron|pennsylvania|hendry/.test(localNames)) {
      candidates.push({ title: 'The ironworker generation', priority: 86, minDepth: 'subregion' })
    }
  }

  candidates.push(...anomalyTitles(events, places, yearMin, yearMax, depth))

  if (depth === 'detail' && lead) {
    candidates.push({ title: lead.person.name, priority: 99, minDepth: 'detail' })
  }

  if (depth === 'place' && lead && surname) {
    candidates.push({
      title: `Arrival of the ${lead.person.name.split(/\s+/).slice(-2).join(' ')}`,
      priority: 90,
      minDepth: 'place',
    })
  }

  candidates.push(
    ...geoFallbackTitle(depth, geoKey, regionId, places[0]?.name),
  )

  return pickTitle(candidates, depth, parentTitle)
}

export function formatClusterStats(places: PlaceRecord[]): string | null {
  const events = clusterEvents(places)
  const counts = countEventTypes(events)
  const total = events.length || places.reduce((s, p) => s + p.eventCount, 0)

  const parts: string[] = []
  if (counts.births) parts.push(`${counts.births} birth${counts.births === 1 ? '' : 's'}`)
  if (counts.deaths) parts.push(`${counts.deaths} death${counts.deaths === 1 ? '' : 's'}`)
  if (counts.moves) parts.push(`${counts.moves} migration${counts.moves === 1 ? '' : 's'}`)
  if (counts.military) parts.push(`${counts.military} military record${counts.military === 1 ? '' : 's'}`)

  if (!parts.length && total) return `${total} related record${total === 1 ? '' : 's'}`
  if (!parts.length) return null

  if (total > counts.births + counts.deaths + counts.moves + counts.military) {
    parts.push(`${total} related records`)
  }

  return parts.join(' · ')
}

export function formatYearRange(yearMin: number | null, yearMax: number | null): string | null {
  if (yearMin == null || yearMax == null) return null
  return yearMin === yearMax ? String(yearMin) : `${yearMin}–${yearMax}`
}

function ctaForDepth(depth: MapClusterDepth): string {
  switch (depth) {
    case 'region':
      return 'Explore this chapter'
    case 'subregion':
      return 'Reveal related lives'
    case 'place':
      return 'View more events'
    case 'detail':
      return 'View records'
  }
}

export function getMapClusterPresentation(input: MapClusterTitleInput): MapClusterPresentation {
  const title = generateClusterTitle(input)
  return {
    title,
    yearRange: formatYearRange(input.yearMin, input.yearMax),
    stats: formatClusterStats(input.places),
    ctaLabel: ctaForDepth(input.depth),
  }
}

/** Build display copy from a pre-generated chapter title. */
export function presentationFromChapterTitle(
  chapterTitle: string,
  places: PlaceRecord[],
  depth: MapClusterDepth,
  yearMin: number | null,
  yearMax: number | null,
): MapClusterPresentation {
  return {
    title: chapterTitle,
    yearRange: formatYearRange(yearMin, yearMax),
    stats: formatClusterStats(places),
    ctaLabel: ctaForDepth(depth),
  }
}
