import type { MapSelection } from '../context/MapExplorationContext'
import type { FamilyRegion, FamilyRegionId } from './mapRegions'
import {
  buildMapNarrativeCaption,
  type MapNarrativeFilters,
} from './mapNarrativeCaption'
import type { MapSummary, PlaceRecord } from './placeIndex'

/**
 * Structured Journey storytelling surface.
 * Collapsed rail shows era + headline + teaser; expanded reveals the fuller body.
 * evidence / mapHighlight are reserved so a future AI Historian can drive map emphasis
 * without redesigning the component.
 */
export type JourneyInsightEvidence = {
  peopleIds: string[]
  regionIds: FamilyRegionId[]
  placeIds: string[]
  routeIds: string[]
  lineageKeys: string[]
  historyEventKey: string | null
}

export type JourneyInsightMapHighlight = {
  regionIds: FamilyRegionId[]
  placeIds: string[]
  routeIds: string[]
}

export type JourneyInsightModel = {
  key: string
  eraLabel: string | null
  headline: string
  teaser: string
  body: string
  evidence: JourneyInsightEvidence
  mapHighlight: JourneyInsightMapHighlight | null
}

function yearSpanFromPlaces(places: PlaceRecord[]): { min: number; max: number } | null {
  let min: number | null = null
  let max: number | null = null
  for (const place of places) {
    if (place.yearMin != null) min = min == null ? place.yearMin : Math.min(min, place.yearMin)
    if (place.yearMax != null) max = max == null ? place.yearMax : Math.max(max, place.yearMax)
  }
  if (min == null || max == null) return null
  return { min, max }
}

function formatEra(span: { min: number; max: number } | null): string | null {
  if (!span) return null
  if (span.min === span.max) return `${span.min}`
  return `${span.min}–${span.max}`
}

function regionPhrase(names: string[]): string {
  if (names.length === 0) return 'the plotted map'
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`
}

function uniquePeopleIds(places: PlaceRecord[]): string[] {
  const ids = new Set<string>()
  for (const place of places) {
    for (const person of place.people) ids.add(person.id)
  }
  return [...ids]
}

function firstSentences(text: string, count: number): string {
  const parts = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
  return parts.slice(0, count).join(' ')
}

function overviewHeadline(regions: FamilyRegion[], filters: MapNarrativeFilters): string {
  if (filters.century) return `A century on the map`
  if (filters.branch) return `Along one family line`
  if (filters.directAncestorsOnly) return `Direct ancestors on the map`
  if (filters.eventType === 'move') return `Corridors of migration`
  if (regions.length >= 4) return `An ocean, then a continent`
  if (regions.length >= 2) return `Geography that still holds them`
  if (regions.length === 1) return regions[0].name
  return `Where the records gather`
}

function overviewTeaser(
  regions: FamilyRegion[],
  _summary: MapSummary,
  span: { min: number; max: number } | null,
): string {
  const placesBit =
    regions.length > 0
      ? `Family lives leave traces across ${regionPhrase(regions.map((r) => r.name))}.`
      : `Family lives leave traces across the plotted places.`
  const timeBit =
    span == null
      ? ''
      : span.min === span.max
        ? ` The surviving evidence clusters around ${span.min}.`
        : ` The surviving evidence stretches from ${span.min} to ${span.max}.`
  return `${placesBit}${timeBit}`.replace(/\s+/g, ' ').trim()
}

function selectionHeadline(selection: NonNullable<MapSelection>): string {
  if (selection.type === 'region') return selection.region.name
  if (selection.type === 'subregion') return selection.subregion.name
  if (selection.type === 'place') {
    return selection.place.name.split(',')[0].trim() || selection.place.name
  }
  return `${selection.route.fromName} → ${selection.route.toName}`
}

function selectionEra(selection: NonNullable<MapSelection>): string | null {
  if (selection.type === 'region') {
    return formatEra(
      selection.region.yearMin != null && selection.region.yearMax != null
        ? { min: selection.region.yearMin, max: selection.region.yearMax }
        : null,
    )
  }
  if (selection.type === 'subregion') {
    return formatEra(
      selection.subregion.yearMin != null && selection.subregion.yearMax != null
        ? { min: selection.subregion.yearMin, max: selection.subregion.yearMax }
        : null,
    )
  }
  if (selection.type === 'place') {
    return formatEra(
      selection.place.yearMin != null && selection.place.yearMax != null
        ? { min: selection.place.yearMin, max: selection.place.yearMax }
        : null,
    )
  }
  return formatEra(
    selection.route.yearMin != null && selection.route.yearMax != null
      ? { min: selection.route.yearMin, max: selection.route.yearMax }
      : null,
  )
}

function emptyEvidence(): JourneyInsightEvidence {
  return {
    peopleIds: [],
    regionIds: [],
    placeIds: [],
    routeIds: [],
    lineageKeys: [],
    historyEventKey: null,
  }
}

/** Build a reusable Journey Insight from current map selection + filters. */
export function buildJourneyInsight(input: {
  selection: MapSelection
  filters: MapNarrativeFilters
  summary: MapSummary
  regions: FamilyRegion[]
  places: PlaceRecord[]
}): JourneyInsightModel {
  const { selection, filters, summary, regions, places } = input
  const caption = buildMapNarrativeCaption(input)
  const body = caption.text
  const span = yearSpanFromPlaces(places)

  if (!selection) {
    const regionIds = regions.map((r) => r.id)
    const placeIds = places.map((p) => p.id)
    const peopleIds = uniquePeopleIds(places)
    return {
      key: caption.key,
      eraLabel: formatEra(span),
      headline: overviewHeadline(regions, filters),
      teaser: overviewTeaser(regions, summary, span),
      body,
      evidence: {
        peopleIds,
        regionIds,
        placeIds,
        routeIds: [],
        lineageKeys: filters.branch ? [filters.branch] : [],
        historyEventKey: null,
      },
      mapHighlight: regionIds.length
        ? { regionIds, placeIds: [], routeIds: [] }
        : null,
    }
  }

  const evidence = emptyEvidence()
  let mapHighlight: JourneyInsightMapHighlight | null = null

  if (selection.type === 'region') {
    evidence.regionIds = [selection.region.id]
    evidence.placeIds = selection.region.places.map((p) => p.id)
    evidence.peopleIds = uniquePeopleIds(selection.region.places)
    mapHighlight = { regionIds: [selection.region.id], placeIds: [], routeIds: [] }
  } else if (selection.type === 'subregion') {
    evidence.regionIds = [selection.subregion.parentRegionId]
    evidence.placeIds = selection.subregion.places.map((p) => p.id)
    evidence.peopleIds = uniquePeopleIds(selection.subregion.places)
    mapHighlight = {
      regionIds: [selection.subregion.parentRegionId],
      placeIds: evidence.placeIds,
      routeIds: [],
    }
  } else if (selection.type === 'place') {
    evidence.placeIds = [selection.place.id]
    evidence.peopleIds = uniquePeopleIds([selection.place])
    mapHighlight = { regionIds: [], placeIds: [selection.place.id], routeIds: [] }
  } else {
    evidence.routeIds = [selection.route.id]
    evidence.peopleIds = selection.route.people.map((p) => p.id)
    if ('fromRegionId' in selection.route) {
      evidence.regionIds = [selection.route.fromRegionId, selection.route.toRegionId]
    }
    mapHighlight = {
      regionIds: evidence.regionIds,
      placeIds: [],
      routeIds: [selection.route.id],
    }
  }

  if (filters.branch) evidence.lineageKeys = [filters.branch]

  return {
    key: caption.key,
    eraLabel: selectionEra(selection),
    headline: selectionHeadline(selection),
    teaser: firstSentences(body, 2),
    body,
    evidence,
    mapHighlight,
  }
}
