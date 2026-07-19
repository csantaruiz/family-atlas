import { countEventTypes } from './chapterPresentation'
import type { MapClusterDepth } from './mapClusterTitles'
import type { FamilyRegionId } from './mapRegions'
import type { PlaceRecord } from './placeIndex'
import { placeRegion } from './placeUtils'

export type MapClusterSynopsisInput = {
  places: PlaceRecord[]
  depth: MapClusterDepth
  yearMin: number | null
  yearMax: number | null
  regionId?: FamilyRegionId
  subregionKey?: string
}

function shortPlaceLabel(place: string): string {
  return place.split(',')[0].trim() || place
}

function placeNamesBlob(places: PlaceRecord[]): string {
  return places.map((p) => p.name).join(' ').toLowerCase()
}

function uniquePeopleCount(places: PlaceRecord[]): number {
  return new Set(places.flatMap((p) => p.people.map((person) => person.id))).size
}

function topPlaceLabels(places: PlaceRecord[], limit = 3): string[] {
  const labels: string[] = []
  const seen = new Set<string>()
  for (const place of [...places].sort((a, b) => b.people.length - a.people.length)) {
    const label = shortPlaceLabel(place.name)
    const key = label.toLowerCase()
    if (!label || seen.has(key)) continue
    seen.add(key)
    labels.push(label)
    if (labels.length >= limit) break
  }
  return labels
}

function joinPlaces(labels: string[]): string {
  if (labels.length === 0) return 'scattered towns'
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`
}

function yearLead(yearMin: number | null, yearMax: number | null): string {
  if (yearMin == null || yearMax == null) return 'Across the available records'
  if (yearMin === yearMax) return `In ${yearMin}`
  return `From ${yearMin} to ${yearMax}`
}

function spanPhrase(yearMin: number | null, yearMax: number | null): string {
  if (yearMin == null || yearMax == null) return 'generations'
  const span = yearMax - yearMin
  if (span >= 300) return 'more than three centuries'
  if (span >= 200) return 'more than two centuries'
  if (span >= 120) return 'well over a century'
  if (span >= 80) return 'more than a century'
  if (span >= 40) return 'several decades'
  return 'a concentrated period'
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

function dominantMoveDestination(moves: PlaceRecord['events']): string | null {
  const counts = new Map<string, number>()
  for (const move of moves) {
    if (move.kind !== 'move') continue
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

function easternUsSynopsis(
  lead: string,
  span: string,
  blob: string,
  hotspots: string[],
  placeCount: number,
  peopleCount: number,
  subregionKey?: string,
): string {
  const cluster = joinPlaces(hotspots)

  if (subregionKey === 'new_jersey') {
    return `${lead}, records suggest sustained settlement in New Jersey — especially around ${cluster} — as families anchor near the Delaware River corridor.`
  }
  if (subregionKey === 'pennsylvania') {
    if (/iron|hendry|butler|monroe/.test(blob)) {
      return `${lead}, the evidence points to Pennsylvania iron country and industrial towns, with families taking root across ${span}.`
    }
    return `${lead}, Pennsylvania emerges as a durable anchor, with records clustering around ${cluster}.`
  }

  if (/pennsylvania|iron|hendry|camden|new jersey|gloucester/.test(blob)) {
    return `${lead}, the records suggest mid-Atlantic settlement — especially around ${cluster} — where port towns and industrial work shape generations that follow earlier colonial-era arrivals.`
  }

  return `${lead}, family records spread across ${placeCount} places and ${peopleCount} people, suggesting a long eastern American chapter rather than a single crossing.`
}

function regionSynopsis(
  regionId: FamilyRegionId,
  lead: string,
  span: string,
  blob: string,
  hotspots: string[],
  placeCount: number,
  peopleCount: number,
  subregionKey?: string,
): string | null {
  switch (regionId) {
    case 'eastern_us':
      return easternUsSynopsis(lead, span, blob, hotspots, placeCount, peopleCount, subregionKey)
    case 'britain_ireland':
      if (/scotland|caithness|glasgow/.test(blob)) {
        return `${lead}, Scottish records appear alongside English branches, suggesting northern roots before later Atlantic crossings.`
      }
      return `${lead}, sparse British and Irish records suggest branches forming before later movement toward North America.`
    case 'mexico':
      if (/chihuahua|rosales|parral|santa isabel/.test(blob)) {
        return `${lead}, the family line appears rooted in northern Mexico — especially around ${joinPlaces(hotspots)} — across ${span}.`
      }
      return `${lead}, Mexican records suggest a long regional chapter centered in the north before later borderland movement.`
    case 'california':
      return `${lead}, later generations appear to consolidate in California, with records clustering around ${joinPlaces(hotspots)}.`
    case 'southwest_us':
      return `${lead}, borderland records suggest movement and resettlement across the American Southwest across ${span}.`
    default:
      return null
  }
}

export function generateMapClusterSynopsis(input: MapClusterSynopsisInput): string {
  const { places, depth, yearMin, yearMax, regionId, subregionKey } = input
  const events = places.flatMap((p) => p.events)
  const counts = countEventTypes(events)
  const blob = placeNamesBlob(places)
  const lead = yearLead(yearMin, yearMax)
  const span = spanPhrase(yearMin, yearMax)
  const hotspots = topPlaceLabels(places, 3)
  const peopleCount = uniquePeopleCount(places)
  const placeCount = places.length
  const moves = events.filter((event) => event.kind === 'move')
  const military = events.filter((event) => event.kind === 'service')

  if (regionId) {
    const regional = regionSynopsis(
      regionId,
      lead,
      span,
      blob,
      hotspots,
      placeCount,
      peopleCount,
      subregionKey,
    )
    if (regional) return regional
  }

  if (military.length >= 1 && /pennsylvania|new jersey|camden|iron/.test(blob)) {
    return `${lead}, industrial work and wartime service appear to shape this American chapter across ${span}.`
  }

  if (moves.length >= 2) {
    const destination = dominantMoveDestination(moves)
    if (destination) {
      return `${lead}, repeated migration records suggest families redefining home toward ${destination} across ${span}.`
    }
    return `${lead}, migration outnumbers other events here — the records read as a chapter of movement rather than quiet settlement.`
  }

  if (counts.births >= counts.deaths && counts.births > 0) {
    return `${lead}, births and local records suggest settlement and growth around ${joinPlaces(hotspots)} across ${span}.`
  }

  if (placeCount >= 6) {
    return `${lead}, records spread across ${placeCount} places suggest a broad regional chapter spanning ${span}, even where individual moves are sparse.`
  }

  if (depth === 'place' && hotspots.length) {
    return `${lead}, the surviving records suggest a localized chapter centered on ${hotspots[0]}.`
  }

  return `${lead}, the available records sketch a distinct regional chapter spanning ${span}.`
}
