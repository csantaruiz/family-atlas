import { historyEvents } from '../data/historyEvents'
import type { HistoryEvent } from '../types'
import type { MapSelection } from '../context/MapExplorationContext'
import { generateMapClusterSynopsis } from './mapClusterSynopsis'
import type { FamilyRegion, FamilyRegionId } from './mapRegions'
import {
  generateMigrationRouteSynopsis,
  type RegionalRoute,
  type SubregionRoute,
} from './mapRoutes'
import type { MapSummary, PlaceRecord } from './placeIndex'
import type { MapSubregion } from './mapSubregions'

export type MapNarrativeFilters = {
  branch: string
  eventType: string
  century: string
  directAncestorsOnly: boolean
}

export type MapNarrativeCaptionResult = {
  key: string
  text: string
}

const REGION_HISTORY_COUNTRIES: Record<FamilyRegionId, string[]> = {
  britain_ireland: ['england', 'britain', 'ireland', 'scotland', 'uk'],
  eastern_us: ['united states', 'america'],
  california: ['united states', 'america', 'california'],
  mexico: ['mexico'],
  southwest_us: ['united states', 'mexico', 'america'],
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  birth: 'births',
  death: 'deaths',
  move: 'migrations',
  service: 'military and civic service',
}

function centuryOrdinal(century: string): string {
  const n = Number(century)
  if (!Number.isFinite(n) || n <= 0) return `${century}th`
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  if (mod10 === 1) return `${n}st`
  if (mod10 === 2) return `${n}nd`
  if (mod10 === 3) return `${n}rd`
  return `${n}th`
}

function shortPlace(name: string): string {
  return name.split(',')[0].trim() || name
}

function uniquePeople(places: PlaceRecord[]): { id: string; name: string; birthYear?: number | null }[] {
  const byId = new Map<string, { id: string; name: string; birthYear?: number | null }>()
  for (const place of places) {
    for (const person of place.people) {
      if (!byId.has(person.id)) {
        byId.set(person.id, {
          id: person.id,
          name: person.name,
          birthYear: person.birthYear,
        })
      }
    }
  }
  return [...byId.values()]
}

function yearSpan(yearMin: number | null, yearMax: number | null): { min: number; max: number } | null {
  if (yearMin == null || yearMax == null) return null
  return { min: yearMin, max: yearMax }
}

function yearSpanFromPlaces(places: PlaceRecord[]): { min: number; max: number } | null {
  let min: number | null = null
  let max: number | null = null
  for (const place of places) {
    if (place.yearMin != null) min = min == null ? place.yearMin : Math.min(min, place.yearMin)
    if (place.yearMax != null) max = max == null ? place.yearMax : Math.max(max, place.yearMax)
  }
  return yearSpan(min, max)
}

function historyCountriesForRegions(regionIds: FamilyRegionId[]): string[] | null {
  if (regionIds.length === 0) return null
  const countries = new Set<string>()
  for (const id of regionIds) {
    for (const country of REGION_HISTORY_COUNTRIES[id] ?? []) {
      countries.add(country)
    }
  }
  return [...countries]
}

function pickHistoryBeat(
  span: { min: number; max: number } | null,
  countries: string[] | null,
): HistoryEvent | null {
  if (!span) return null
  const pad = Math.max(20, Math.round((span.max - span.min) * 0.15))
  const from = span.min - pad
  const to = span.max + pad
  const countrySet = countries?.map((c) => c.toLowerCase()) ?? null

  const candidates = historyEvents
    .filter((event) => event.year >= from && event.year <= to)
    .filter((event) => {
      if (!countrySet || countrySet.length === 0) return true
      return countrySet.some((c) => event.country.toLowerCase().includes(c) || c.includes(event.country.toLowerCase()))
    })
    .sort((a, b) => {
      if (b.importance !== a.importance) return b.importance - a.importance
      const aMid = Math.abs(a.year - (span.min + span.max) / 2)
      const bMid = Math.abs(b.year - (span.min + span.max) / 2)
      return aMid - bMid
    })

  return candidates[0] ?? null
}

function weaveHistory(familySentence: string, history: HistoryEvent | null): string {
  if (!history) return familySentence
  const summary = history.summary.replace(/\.$/, '')
  return `${familySentence} In the wider world, ${history.title} (${history.year}) — ${summary}.`
}

function filterLead(filters: MapNarrativeFilters): string {
  const parts: string[] = []
  if (filters.directAncestorsOnly) parts.push('Among direct ancestors')
  if (filters.branch) {
    parts.push(parts.length ? `on the ${filters.branch} line` : `Along the ${filters.branch} line`)
  }
  if (filters.century) {
    const centuryBit = `in the ${centuryOrdinal(filters.century)} century`
    parts.push(parts.length ? centuryBit : `In the ${centuryOrdinal(filters.century)} century`)
  }
  if (filters.eventType) {
    const label = EVENT_TYPE_LABELS[filters.eventType] ?? filters.eventType
    parts.push(parts.length ? `focusing on ${label}` : `Tracing ${label}`)
  }
  if (parts.length === 0) return ''
  return `${parts.join(', ')}, `
}

function filtersActive(filters: MapNarrativeFilters): boolean {
  return Boolean(filters.branch || filters.eventType || filters.century || filters.directAncestorsOnly)
}

function selectionKey(selection: MapSelection): string {
  if (!selection) return 'overview'
  if (selection.type === 'region') return `region:${selection.region.id}`
  if (selection.type === 'subregion') return `subregion:${selection.subregion.id}`
  if (selection.type === 'place') return `place:${selection.place.id}`
  return `${selection.type}:${selection.route.id}`
}

function filterKey(filters: MapNarrativeFilters): string {
  return [
    filters.branch || 'all',
    filters.eventType || 'all',
    filters.century || 'all',
    filters.directAncestorsOnly ? 'direct' : 'all-gen',
  ].join('|')
}

function featuredPeoplePhrase(people: { name: string }[], limit = 2): string | null {
  if (people.length === 0) return null
  const labels = people.slice(0, limit).map((p) => p.name)
  if (labels.length === 1) return labels[0]
  if (people.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels[0]}, ${labels[1]}, and others`
}

function overviewNarrative(
  filters: MapNarrativeFilters,
  summary: MapSummary,
  regions: FamilyRegion[],
  places: PlaceRecord[],
): string {
  const lead = filterLead(filters)
  const people = uniquePeople(places)
  const span = yearSpanFromPlaces(places)
  const regionNames = regions.map((r) => r.name)
  const regionPhrase =
    regionNames.length === 0
      ? 'no plotted regions yet'
      : regionNames.length === 1
        ? regionNames[0]
        : regionNames.length === 2
          ? `${regionNames[0]} and ${regionNames[1]}`
          : `${regionNames.slice(0, -1).join(', ')}, and ${regionNames.at(-1)}`

  const yearBit =
    span == null
      ? 'across the surviving records'
      : span.min === span.max
        ? `around ${span.min}`
        : `from ${span.min} to ${span.max}`

  let body: string
  if (places.length === 0) {
    body = `${lead || 'With the current filters, '}no matching places remain on the map — widen a branch, century, or event type to reopen the family's geographic story.`
    return body.replace(/^,\s*/, '').replace(/^([a-z])/, (_, c: string) => c.toUpperCase())
  }

  if (filtersActive(filters)) {
    body = `${lead}the map narrows to ${summary.placeCount} places across ${regionPhrase} ${yearBit}. ${people.length} people leave trails here`
    if (summary.longestMove) {
      body += `, including ${summary.longestMove.personName}'s longest recorded move`
    }
    body += '.'
  } else {
    body = `Across ${summary.placeCount} known places spanning ${regionPhrase}, family records sketch a living geography ${yearBit}. ${people.length} people appear in the plotted evidence`
    if (summary.longestMove) {
      body += ` — among them ${summary.longestMove.personName}, whose longest move stretches farthest on the map`
    }
    body += '.'
  }

  const countries = historyCountriesForRegions(regions.map((r) => r.id))
  return weaveHistory(body.replace(/\s+/g, ' ').trim(), pickHistoryBeat(span, countries))
}

function regionNarrative(region: FamilyRegion, filters: MapNarrativeFilters): string {
  const lead = filterLead(filters)
  const synopsis = generateMapClusterSynopsis({
    places: region.places,
    depth: 'region',
    yearMin: region.yearMin,
    yearMax: region.yearMax,
    regionId: region.id,
  })
  const people = uniquePeople(region.places)
    .sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999))
  const featured = featuredPeoplePhrase(people, 2)
  const opener = lead
    ? `${lead}the story tightens on ${region.name}. `
    : `Here the map opens onto ${region.name}. `
  let body = `${opener}${synopsis}`
  if (featured) {
    body += ` Names such as ${featured} help pin the chapter to specific lives.`
  }
  const history = pickHistoryBeat(
    yearSpan(region.yearMin, region.yearMax),
    REGION_HISTORY_COUNTRIES[region.id],
  )
  return weaveHistory(body.replace(/\s+/g, ' ').trim(), history)
}

function subregionNarrative(subregion: MapSubregion, filters: MapNarrativeFilters): string {
  const lead = filterLead(filters)
  const synopsis = generateMapClusterSynopsis({
    places: subregion.places,
    depth: 'subregion',
    yearMin: subregion.yearMin,
    yearMax: subregion.yearMax,
    regionId: subregion.parentRegionId,
    subregionKey: subregion.geoKey,
  })
  const people = uniquePeople(subregion.places)
  const featured = featuredPeoplePhrase(people, 2)
  const opener = lead
    ? `${lead}attention settles on ${subregion.name}. `
    : `Zooming closer, ${subregion.name} comes into focus. `
  let body = `${opener}${synopsis}`
  if (featured) {
    body += ` Local records still carry ${featured}.`
  }
  const history = pickHistoryBeat(
    yearSpan(subregion.yearMin, subregion.yearMax),
    REGION_HISTORY_COUNTRIES[subregion.parentRegionId],
  )
  return weaveHistory(body.replace(/\s+/g, ' ').trim(), history)
}

function placeNarrative(place: PlaceRecord, filters: MapNarrativeFilters): string {
  const lead = filterLead(filters)
  const synopsis = generateMapClusterSynopsis({
    places: [place],
    depth: 'place',
    yearMin: place.yearMin,
    yearMax: place.yearMax,
    regionId: undefined,
  })
  const people = uniquePeople([place])
  const featured = featuredPeoplePhrase(people, 3)
  const label = shortPlace(place.name)
  const opener = lead
    ? `${lead}the trail stops at ${label}. `
    : `At ${label}, the family's map becomes intimate. `
  let body = `${opener}${synopsis}`
  if (featured) {
    body += people.length === 1
      ? ` ${featured} is remembered here.`
      : ` Lives tied to this place include ${featured}.`
  }
  const regionHint = (place.coordinate.displayRegion || place.coordinate.region || '').toLowerCase()
  const countries =
    /mexico|chihuahua|durango/.test(regionHint) || /mexico/.test(place.name.toLowerCase())
      ? REGION_HISTORY_COUNTRIES.mexico
      : /england|scotland|ireland|britain|uk/.test(regionHint) ||
          /england|scotland|ireland|britain/.test(place.name.toLowerCase())
        ? REGION_HISTORY_COUNTRIES.britain_ireland
        : REGION_HISTORY_COUNTRIES.eastern_us
  return weaveHistory(
    body.replace(/\s+/g, ' ').trim(),
    pickHistoryBeat(yearSpan(place.yearMin, place.yearMax), countries),
  )
}

function routeNarrative(
  route: RegionalRoute | SubregionRoute,
  filters: MapNarrativeFilters,
  kind: 'route' | 'subroute',
): string {
  const lead = filterLead(filters)
  const synopsis = generateMigrationRouteSynopsis(route)
  const travelers = featuredPeoplePhrase(route.people, 2)
  const opener = lead
    ? `${lead}a migration corridor takes the foreground. `
    : kind === 'subroute'
      ? 'A shorter corridor lights up inside this region. '
      : 'A migration corridor draws the eye across the map. '
  let body = `${opener}${synopsis}`
  if (travelers) {
    body += ` Travelers on this path include ${travelers}.`
  }
  const regionIds: FamilyRegionId[] = []
  if ('fromRegionId' in route) regionIds.push(route.fromRegionId, route.toRegionId)
  const history = pickHistoryBeat(
    yearSpan(route.yearMin, route.yearMax),
    historyCountriesForRegions(regionIds),
  )
  return weaveHistory(body.replace(/\s+/g, ' ').trim(), history)
}

/** Build bottom-of-map narrative keyed for cross-fade on selection or filter change. */
export function buildMapNarrativeCaption(input: {
  selection: MapSelection
  filters: MapNarrativeFilters
  summary: MapSummary
  regions: FamilyRegion[]
  places: PlaceRecord[]
}): MapNarrativeCaptionResult {
  const { selection, filters, summary, regions, places } = input
  const key = `${selectionKey(selection)}::${filterKey(filters)}`

  if (!selection) {
    return { key, text: overviewNarrative(filters, summary, regions, places) }
  }
  if (selection.type === 'region') {
    return { key, text: regionNarrative(selection.region, filters) }
  }
  if (selection.type === 'subregion') {
    return { key, text: subregionNarrative(selection.subregion, filters) }
  }
  if (selection.type === 'place') {
    return { key, text: placeNarrative(selection.place, filters) }
  }
  return {
    key,
    text: routeNarrative(selection.route, filters, selection.type),
  }
}
