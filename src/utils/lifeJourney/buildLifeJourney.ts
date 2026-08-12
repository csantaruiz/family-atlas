import { eventContext } from '../../data/eventContext'
import { getFamilyEventHeroImage, getJourneyStockImage } from '../../data/familyEventImagery'
import type { FamilyEvent, Person, PersonImage } from '../../types'
import type {
  JourneyBeatType,
  JourneyEvidenceKind,
  LifeJourney,
  LifeJourneyBeat,
} from '../../types/lifeJourney'
import { canonicalEventId } from '../canonicalEvent'
import { formatAmericanDate } from '../formatDate'
import { resolvePersonPortrait } from '../resolvePersonPortrait'
import {
  birthCaption,
  deathCaption,
  epilogueCaption,
  evidenceLabel,
  firstGivenName,
  followJourneyCtaLabel,
  inferredCrossingCaption,
  serviceCaption,
  youthCaption,
} from './beatCopy'
import {
  journeyPlaceKey,
  journeyPlaceLabel,
  resolveJourneyCoordinate,
} from './journeyPlace'

const MIN_DATED_EVENTS = 3
const MIN_LOCATION_STAGES = 2
const MIN_BEATS = 3
const MAX_BEATS = 8
const BEAT_SCALE_PLACE = 3.6
const BEAT_SCALE_REGION = 2.4

function beatDuration(caption: string): number {
  const words = caption.split(/\s+/).filter(Boolean).length
  if (words < 18) return 4500
  if (words < 36) return 6200
  return 7800
}

function yearLabelFor(year: number, date?: string): string {
  return formatAmericanDate(date || year) || String(year)
}

function mapPointFor(place: string | null, regional = false) {
  if (!place) return null
  const coord = resolveJourneyCoordinate(place)
  if (!coord.resolved) return null
  return {
    x: coord.x,
    y: coord.y,
    scale: regional ? BEAT_SCALE_REGION : BEAT_SCALE_PLACE,
    resolved: true,
  }
}

function authenticPortrait(person: Person): PersonImage | null {
  const resolved = resolvePersonPortrait(person)
  if (resolved.isUnavailablePlaceholder) return null
  return resolved.image
}

function beatImage(
  type: JourneyBeatType,
  locationText: string,
  portrait: PersonImage | null,
  event: FamilyEvent | null,
): Pick<LifeJourneyBeat, 'image' | 'imageKind'> {
  if (portrait && (type === 'birth' || type === 'death' || type === 'epilogue' || type === 'youth')) {
    return { image: portrait, imageKind: 'authentic' }
  }
  if (event) {
    const hero = getFamilyEventHeroImage(event)
    if (hero) return { image: hero, imageKind: 'stock' }
  }
  const stock = getJourneyStockImage(type, locationText)
  return { image: stock, imageKind: 'stock' }
}

function makeBeat(args: {
  type: JourneyBeatType
  year: number
  yearLabel: string
  title: string
  caption: string
  evidence: JourneyEvidenceKind
  locationLabel: string | null
  placeForMap: string | null
  event: FamilyEvent | null
  portrait: PersonImage | null
  regional?: boolean
}): LifeJourneyBeat {
  const locationText = [args.locationLabel, args.placeForMap, args.title].filter(Boolean).join(' ')
  const media = beatImage(args.type, locationText, args.portrait, args.event)
  return {
    id: `${args.type}-${args.year}`,
    type: args.type,
    year: args.year,
    yearLabel: args.yearLabel,
    title: args.title,
    caption: args.caption,
    evidence: args.evidence,
    evidenceLabel: evidenceLabel(args.evidence),
    locationLabel: args.locationLabel,
    map: mapPointFor(args.placeForMap, args.regional),
    durationMs: beatDuration(args.caption),
    eventId: args.event ? canonicalEventId(args.event) : null,
    image: media.image,
    imageKind: media.imageKind,
  }
}

function personEvents(person: Person, events: FamilyEvent[]): FamilyEvent[] {
  return events
    .filter((event) => event.person.id === person.id || event.spouse?.id === person.id)
    .sort((a, b) => a.year - b.year || a.title.localeCompare(b.title))
}

function servicePlace(event: FamilyEvent): { place: string; evidence: JourneyEvidenceKind } | null {
  const ctx = eventContext[event.title]
  const hay = `${event.title} ${event.detail} ${ctx?.context ?? ''} ${ctx?.narrative ?? ''}`.toLowerCase()
  if (/388th|eighth air force|england|europe|air war/.test(hay)) {
    return { place: 'England', evidence: 'historical-context' }
  }
  if (/camden|new jersey|ironwork|rigging/.test(hay)) {
    return { place: event.person.birthPlace || 'Camden, New Jersey', evidence: 'historical-context' }
  }
  return null
}

function eventPlace(event: FamilyEvent): { place: string; evidence: JourneyEvidenceKind } | null {
  if (event.kind === 'birth' && event.person.birthPlace) {
    return { place: event.person.birthPlace, evidence: 'documented' }
  }
  if (event.kind === 'death' && event.person.deathPlace) {
    return { place: event.person.deathPlace, evidence: 'documented' }
  }
  if (event.kind === 'service') return servicePlace(event)
  if (event.kind === 'move') {
    const dest = event.title.match(/crosses into (.+)$/i)?.[1]
    if (dest) return { place: dest, evidence: 'inferred' }
  }
  if (event.kind === 'marriage') {
    const placePart = event.detail?.includes(' · ')
      ? event.detail.split(' · ').at(-1)?.trim() ?? ''
      : ''
    if (placePart && journeyPlaceKey(placePart)) {
      return { place: placePart, evidence: 'documented' }
    }
  }
  return null
}

function locationStages(person: Person, events: FamilyEvent[]): string[] {
  const keys = new Set<string>()
  const consider = (place: string | undefined) => {
    const key = journeyPlaceKey(place ?? '')
    if (key) keys.add(key)
  }
  consider(person.birthPlace)
  consider(person.deathPlace)
  for (const place of person.places ?? []) consider(place)
  for (const event of events) {
    const located = eventPlace(event)
    if (located) consider(located.place)
  }
  return [...keys]
}

function inferredCrossing(
  person: Person,
  events: FamilyEvent[],
): { year: number; fromPlace: string; toPlace: string } | null {
  const hasMoveEvent = events.some((event) => event.kind === 'move')
  if (hasMoveEvent) return null

  const birthKey = journeyPlaceKey(person.birthPlace ?? '')
  const deathKey = journeyPlaceKey(person.deathPlace ?? '')
  const placeKeys = (person.places ?? [])
    .map((place) => ({ place, key: journeyPlaceKey(place) }))
    .filter((entry) => entry.key)

  let fromPlace = person.birthPlace || ''
  let fromKey = birthKey
  let toPlace = person.deathPlace || ''
  let toKey = deathKey

  if (!toKey) {
    const later = placeKeys.find((entry) => entry.key && entry.key !== fromKey)
    if (later) {
      toPlace = later.place
      toKey = later.key
    }
  }

  if (!fromKey || !toKey || fromKey === toKey) return null

  const dated = events.filter((event) => event.kind !== 'birth' && event.kind !== 'death')
  const lastBefore = dated[0]?.year
  const deathYear = person.deathYear
  let year: number
  if (deathYear && person.birthYear) {
    year = Math.round(person.birthYear + (deathYear - person.birthYear) * 0.62)
  } else if (lastBefore && person.birthYear) {
    year = Math.round((person.birthYear + lastBefore) / 2)
  } else if (person.birthYear) {
    year = person.birthYear + 22
  } else {
    return null
  }

  return { year, fromPlace, toPlace }
}

function ineligible(person: Person, reason: string): LifeJourney {
  return {
    personId: person.id,
    personName: person.name,
    givenName: firstGivenName(person.name),
    ctaLabel: followJourneyCtaLabel(person.name),
    eligible: false,
    ineligibleReason: reason,
    beats: [],
  }
}

export function isPersonFollowEligible(person: Person, events: FamilyEvent[]): boolean {
  return buildLifeJourney(person, events).eligible
}

export function buildLifeJourney(person: Person, allEvents: FamilyEvent[]): LifeJourney {
  const given = firstGivenName(person.name)
  const events = personEvents(person, allEvents)
  const dated = events.filter((event) => Number.isFinite(event.year) && event.year > 0)
  const kinds = new Set(dated.map((event) => event.kind))
  const onlyBirthDeath =
    dated.length > 0 && [...kinds].every((kind) => kind === 'birth' || kind === 'death')
  const stages = locationStages(person, dated)
  const crossing = inferredCrossing(person, dated)
  const stageCount = crossing && !stages.includes(journeyPlaceKey(crossing.toPlace))
    ? stages.length + 1
    : stages.length

  if (!person.birthYear && dated.length === 0) {
    return ineligible(person, 'No dated events in the archive')
  }
  if (dated.length < MIN_DATED_EVENTS && !crossing) {
    return ineligible(person, 'Fewer than three dated events')
  }
  if (dated.length + (crossing ? 1 : 0) < MIN_DATED_EVENTS) {
    return ineligible(person, 'Fewer than three dated events')
  }
  if (onlyBirthDeath && !crossing) {
    return ineligible(person, 'Only birth and death are recorded')
  }
  if (stageCount < MIN_LOCATION_STAGES) {
    return ineligible(person, 'Fewer than two life stages or places')
  }

  const portrait = authenticPortrait(person)
  const beats: LifeJourneyBeat[] = []
  const birthEvent = dated.find((event) => event.kind === 'birth')
  const deathEvent = dated.find((event) => event.kind === 'death')
  const birthPlace = person.birthPlace || null
  const deathPlace = person.deathPlace || null

  if (birthEvent && person.birthYear) {
    beats.push(
      makeBeat({
        type: 'birth',
        year: person.birthYear,
        yearLabel: yearLabelFor(person.birthYear, person.birthDate),
        title: `${given} is born`,
        caption: birthCaption(given, yearLabelFor(person.birthYear, person.birthDate), birthPlace ? journeyPlaceLabel(birthPlace) : null),
        evidence: 'documented',
        locationLabel: birthPlace ? journeyPlaceLabel(birthPlace) : null,
        placeForMap: birthPlace,
        event: birthEvent,
        portrait,
      }),
    )
  }

  const nextAfterBirth = dated.find((event) => event.kind !== 'birth')
  const youthGap =
    person.birthYear && nextAfterBirth ? nextAfterBirth.year - person.birthYear : 0
  if (birthEvent && youthGap >= 14) {
    const youthYear = person.birthYear! + Math.min(12, Math.round(youthGap * 0.35))
    beats.push(
      makeBeat({
        type: 'youth',
        year: youthYear,
        yearLabel: String(youthYear),
        title: `Early years`,
        caption: youthCaption(given, birthPlace ? journeyPlaceLabel(birthPlace) : null),
        evidence: 'inferred',
        locationLabel: birthPlace ? journeyPlaceLabel(birthPlace) : null,
        placeForMap: birthPlace,
        event: null,
        portrait,
      }),
    )
  }

  for (const event of dated) {
    if (event.kind === 'birth' || event.kind === 'death') continue

    if (event.kind === 'service') {
      const located = servicePlace(event)
      const ctx = eventContext[event.title]
      beats.push(
        makeBeat({
          type: 'service',
          year: event.year,
          yearLabel: String(event.year),
          title: event.title,
          caption: serviceCaption(ctx?.narrative ?? event.detail, ctx?.context ?? null),
          evidence: located?.evidence ?? 'documented',
          locationLabel: located ? journeyPlaceLabel(located.place) : null,
          placeForMap: located?.place ?? null,
          event,
          portrait: null,
          regional: true,
        }),
      )
      continue
    }

    if (event.kind === 'marriage') {
      const located = eventPlace(event)
      const spouseName = event.spouse?.name
      beats.push(
        makeBeat({
          type: 'marriage',
          year: event.year,
          yearLabel: yearLabelFor(event.year),
          title: spouseName ? `Marriage to ${firstGivenName(spouseName)}` : 'Marriage',
          caption: located?.place
            ? `${yearLabelFor(event.year)}. A marriage is recorded${located.place ? ` in ${journeyPlaceLabel(located.place)}` : ''}.`
            : `${yearLabelFor(event.year)}. A marriage is recorded. The place is not attached in this archive.`,
          evidence: located ? 'documented' : 'documented',
          locationLabel: located ? journeyPlaceLabel(located.place) : null,
          placeForMap: located?.place ?? birthPlace,
          event,
          portrait: null,
        }),
      )
      continue
    }

    if (event.kind === 'move') {
      const located = eventPlace(event)
      beats.push(
        makeBeat({
          type: 'move',
          year: event.year,
          yearLabel: String(event.year),
          title: event.title.replace(`${person.name} `, `${given} `),
          caption: `${event.detail}. This placement is approximate — inferred from a change of recorded country or region, not from a dated passenger list.`,
          evidence: 'inferred',
          locationLabel: located ? journeyPlaceLabel(located.place) : null,
          placeForMap: located?.place ?? null,
          event,
          portrait: null,
          regional: true,
        }),
      )
    }
  }

  if (crossing) {
    const alreadyCovered = beats.some((beat) => beat.type === 'move')
    if (!alreadyCovered) {
      beats.push(
        makeBeat({
          type: 'move',
          year: crossing.year,
          yearLabel: `about ${crossing.year}`,
          title: `From ${journeyPlaceLabel(crossing.fromPlace)} to ${journeyPlaceLabel(crossing.toPlace)}`,
          caption: inferredCrossingCaption(
            journeyPlaceLabel(crossing.fromPlace),
            journeyPlaceLabel(crossing.toPlace),
          ),
          evidence: 'inferred',
          locationLabel: journeyPlaceLabel(crossing.toPlace),
          placeForMap: crossing.toPlace,
          event: null,
          portrait: null,
          regional: true,
        }),
      )
    }
  }

  if (deathEvent && person.deathYear) {
    beats.push(
      makeBeat({
        type: 'death',
        year: person.deathYear,
        yearLabel: yearLabelFor(person.deathYear, person.deathDate),
        title: `${given}’s life closes`,
        caption: deathCaption(
          given,
          yearLabelFor(person.deathYear, person.deathDate),
          deathPlace ? journeyPlaceLabel(deathPlace) : null,
        ),
        evidence: 'documented',
        locationLabel: deathPlace ? journeyPlaceLabel(deathPlace) : null,
        placeForMap: deathPlace,
        event: deathEvent,
        portrait,
      }),
    )
  }

  beats.sort((a, b) => a.year - b.year)

  const firstPlace = birthPlace ? journeyPlaceLabel(birthPlace) : null
  const lastPlace = deathPlace
    ? journeyPlaceLabel(deathPlace)
    : crossing
      ? journeyPlaceLabel(crossing.toPlace)
      : firstPlace
  if (beats.length >= MIN_BEATS && beats.length < MAX_BEATS) {
    const lastYear = beats[beats.length - 1]?.year ?? person.deathYear ?? person.birthYear ?? 0
    beats.push(
      makeBeat({
        type: 'epilogue',
        year: lastYear,
        yearLabel: '',
        title: `${possessiveSafe(given)} trail`,
        caption: epilogueCaption(given, firstPlace, lastPlace),
        evidence: 'documented',
        locationLabel: lastPlace,
        placeForMap: deathPlace || crossing?.toPlace || birthPlace,
        event: null,
        portrait,
        regional: true,
      }),
    )
  }

  const trimmed = trimBeats(beats)
  if (trimmed.length < MIN_BEATS) {
    return ineligible(person, 'Not enough distinct moments to follow')
  }

  return {
    personId: person.id,
    personName: person.name,
    givenName: given,
    ctaLabel: followJourneyCtaLabel(person.name),
    eligible: true,
    ineligibleReason: null,
    beats: trimmed.map((beat, index) => ({ ...beat, id: `${beat.type}-${beat.year}-${index}` })),
  }
}

function possessiveSafe(given: string): string {
  return given.endsWith('s') ? `${given}'` : `${given}'s`
}

function trimBeats(beats: LifeJourneyBeat[]): LifeJourneyBeat[] {
  if (beats.length <= MAX_BEATS) return beats
  const priority = (beat: LifeJourneyBeat): number => {
    if (beat.type === 'birth' || beat.type === 'death' || beat.type === 'service') return 0
    if (beat.type === 'marriage') return 1
    if (beat.type === 'move') return 2
    if (beat.type === 'epilogue') return 3
    return 4
  }
  const kept = [...beats].sort((a, b) => priority(a) - priority(b)).slice(0, MAX_BEATS)
  return kept.sort((a, b) => a.year - b.year)
}
