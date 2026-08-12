import { eventContext } from '../data/eventContext'
import { featuredNames } from '../data/featuredNames'
import { historyEvents } from '../data/historyEvents'
import type { FamilyEvent, HistoryEvent, Person } from '../types'
import { formatAmericanDate } from './formatDate'
import { peopleRelevantToEvent, placeCountries, placeRegion } from './placeUtils'
import { relationshipToCraig } from './personDirectory'

export type DetailNarrative = {
  life: string
  paragraphs: string[]
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

function pronouns(person: Person): { subj: string; poss: string; obj: string; was: string } {
  if (person.sex === 'M') return { subj: 'he', poss: 'his', obj: 'him', was: 'was' }
  if (person.sex === 'F') return { subj: 'she', poss: 'her', obj: 'her', was: 'was' }
  return { subj: 'they', poss: 'their', obj: 'them', was: 'were' }
}

function lifeEndYear(person: Person, presentYear: number): number {
  return person.deathYear ?? presentYear
}

function namedList(names: string[], limit = 3): string {
  const shown = names.filter(Boolean).slice(0, limit)
  if (shown.length === 0) return ''
  if (shown.length === 1) return shown[0]
  if (shown.length === 2) return `${shown[0]} and ${shown[1]}`
  return `${shown.slice(0, -1).join(', ')}, and ${shown[shown.length - 1]}`
}

function siblingsOf(person: Person, byId: Record<string, Person>): Person[] {
  const parentIds = person.parents ?? []
  if (!parentIds.length) return []
  return Object.values(byId).filter((other) => {
    if (other.id === person.id) return false
    const shared = (other.parents ?? []).filter((id) => parentIds.includes(id))
    return shared.length > 0
  })
}

function overlappingHistory(person: Person, presentYear: number): HistoryEvent[] {
  if (!person.birthYear) return []
  const end = lifeEndYear(person, presentYear)
  const countries = placeCountries(person)
  return historyEvents
    .filter((event) => {
      if (event.year < person.birthYear! || event.year > end) return false
      if (event.country === 'Global') return true
      if (event.country === 'Britain') {
        return countries.has('Britain') || countries.has('England') || countries.has('Scotland') || countries.has('Ireland')
      }
      return countries.has(event.country)
    })
    .sort((a, b) => b.importance - a.importance || Math.abs(a.year - (person.birthYear ?? a.year)) - Math.abs(b.year - (person.birthYear ?? b.year)))
}

function generationLine(person: Person): string {
  const relation = relationshipToCraig(person)
  if (person.generation === 0) return `${firstName(person.name)} stands in the present generation of this Atlas.`
  if (relation) return `${relation} — a life the archive still holds in view.`
  return 'This life belongs to the wider documented family.'
}

function kinshipParagraph(person: Person, byId: Record<string, Person>, events: FamilyEvent[]): string | null {
  const { subj, poss, was } = pronouns(person)
  const bits: string[] = []

  const parents = (person.parents ?? []).map((id) => byId[id]?.name).filter(Boolean)
  if (parents.length) {
    bits.push(`${subj} ${was} the child of ${namedList(parents)}`)
  }

  const spouses = (person.spouses ?? []).map((id) => byId[id]?.name).filter(Boolean)
  const marriage = events.find(
    (event) =>
      event.kind === 'marriage' &&
      (event.person.id === person.id || event.spouse?.id === person.id),
  )
  if (spouses.length && marriage) {
    const partner =
      marriage.person.id === person.id ? marriage.spouse?.name : marriage.person.name
    const house = marriage.title.replace(/\s+marriage$/i, '')
    bits.push(
      `${subj} married ${partner || namedList(spouses)} in ${marriage.year}${house ? `, a ${house} marriage in this tree` : ''}`,
    )
  } else if (spouses.length) {
    bits.push(`the record names ${namedList(spouses)} as spouse`)
  }

  const children = (person.children ?? []).map((id) => byId[id]?.name).filter(Boolean)
  if (children.length === 1) {
    bits.push(`${poss} child in the archive is ${children[0]}`)
  } else if (children.length > 1) {
    bits.push(
      `${subj} ${was} parent to ${children.length} in this file, among them ${namedList(children)}`,
    )
  }

  const siblings = siblingsOf(person, byId)
  if (siblings.length === 1) {
    bits.push(`${poss} sibling in the tree is ${siblings[0].name}`)
  } else if (siblings.length > 1) {
    bits.push(
      `${subj} shared a household line with ${siblings.length} siblings, including ${namedList(siblings.map((s) => s.name))}`,
    )
  }

  if (!bits.length) return null
  const sentence = bits.join('; ')
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.'
}

function insightParagraph(
  person: Person,
  byId: Record<string, Person>,
  events: FamilyEvent[],
  presentYear: number,
): string | null {
  const { subj, poss, was } = pronouns(person)
  const insights: string[] = []

  if (person.birthYear) {
    const sameYear = Object.values(byId).filter(
      (other) => other.id !== person.id && other.birthYear === person.birthYear,
    )
    if (sameYear.length) {
      insights.push(
        `${firstName(person.name)} shares a birth year with ${namedList(sameYear.map((p) => p.name))}`,
      )
    }
  }

  const featuredAlive = [...featuredNames]
    .map((name) => Object.values(byId).find((p) => p.name === name))
    .filter((other): other is Person => {
      if (!other || other.id === person.id || !person.birthYear || !other.birthYear) return false
      const otherEnd = lifeEndYear(other, presentYear)
      const selfEnd = lifeEndYear(person, presentYear)
      return other.birthYear <= selfEnd && person.birthYear <= otherEnd
    })
    .slice(0, 2)
  if (featuredAlive.length) {
    insights.push(
      `${poss} years overlapped ${namedList(featuredAlive.map((p) => p.name))}, another thread in the same family weather`,
    )
  }

  const move = events.find((event) => event.kind === 'move' && event.person.id === person.id)
  if (move) {
    const from = placeRegion(person.birthPlace) || 'one country'
    const to = placeRegion(person.deathPlace) || placeRegion(move.detail) || 'another'
    if (from !== to) {
      insights.push(
        `the archive infers a crossing from ${from} toward ${to} — a change of ground read from birth and death places, not a dated ticket`,
      )
    }
  }

  const parentPlaces = (person.parents ?? [])
    .map((id) => placeRegion(byId[id]?.birthPlace))
    .filter(Boolean)
  const own = placeRegion(person.birthPlace)
  if (own && parentPlaces.length && parentPlaces.every((place) => place && place !== own)) {
    insights.push(
      `${subj} ${was} born in ${own} while ${poss} parents’ records still speak of ${namedList([...new Set(parentPlaces)])} — a generational turn of the map`,
    )
  }

  const service = events.find((event) => event.kind === 'service' && event.person.id === person.id)
  if (service) {
    insights.push(`family research also marks this life with “${service.title}”`)
  }

  if (!insights.length) return null
  const lead = insights[0]
  const extra = insights[1] ? ` ${insights[1].charAt(0).toUpperCase() + insights[1].slice(1)}.` : ''
  return `A pattern in the tree: ${lead}.${extra}`
}

function historyParagraph(person: Person, allPeople: Person[], presentYear: number): string | null {
  const events = overlappingHistory(person, presentYear).slice(0, 2)
  if (!events.length) return null
  const { poss } = pronouns(person)
  const scenes = events.map((event) => {
    const kin = peopleRelevantToEvent(event, allPeople).filter((other) => other.id !== person.id)
    const kinBit =
      kin.length >= 3
        ? ` At that hour ${kin.length} other lives in this Atlas were also on the ground, including ${namedList(kin.map((p) => p.name))}.`
        : ''
    return `${event.title} (${event.year}): ${event.summary}${kinBit}`
  })
  return `Around ${poss} lifetime the wider world was not still. ${scenes.join(' ')} These are the era’s weather — context from the historical record, not a claim that ${firstName(person.name)} stood in those crowds.`
}

function placeClause(person: Person): string {
  if (person.birthPlace) return `, in ${person.birthPlace}`
  return ''
}

export function buildPersonNarrative(
  person: Person,
  byId: Record<string, Person>,
  events: FamilyEvent[],
  presentYear = new Date().getFullYear(),
): DetailNarrative {
  const born = formatAmericanDate(person.birthDate || person.birthYear)
  const died = formatAmericanDate(person.deathDate || person.deathYear)
  const life = `${born || 'Birth unknown'} — ${died || 'Living'}`
  const { subj, poss, was } = pronouns(person)
  const allPeople = Object.values(byId)

  const opening = person.birthYear
    ? `${person.name} enters the family story ${born ? `on ${born}` : `in ${person.birthYear}`}${placeClause(person)}. ${generationLine(person)}`
    : `${person.name} enters the family story at an uncertain date${placeClause(person)}. ${generationLine(person)}`

  const close = person.deathYear
    ? `The documented trail closes ${died ? `on ${died}` : `in ${person.deathYear}`}${person.deathPlace ? `, at ${person.deathPlace}` : ''}. What the GEDCOM names is kept; photographs, letters, and local records can still thicken the scene.`
    : `${subj.charAt(0).toUpperCase() + subj.slice(1)} ${was} still living in the family file when this Atlas was assembled. Dates and kin come from the uploaded record; the historical scenes around them wait for a census page, a letter, or a photograph to pin ${poss} days more tightly.`

  const paragraphs = [
    opening,
    kinshipParagraph(person, byId, events),
    insightParagraph(person, byId, events, presentYear),
    historyParagraph(person, allPeople, presentYear),
    close,
  ].filter((paragraph): paragraph is string => Boolean(paragraph))

  return { life, paragraphs }
}

export function buildFamilyEventNarrative(
  event: FamilyEvent,
  byId: Record<string, Person>,
  allPeople: Person[],
  presentYear = new Date().getFullYear(),
): DetailNarrative {
  const person = event.person
  const ctx = eventContext[event.title]
  const life =
    event.kind === 'marriage' && event.spouse
      ? `${event.year} · ${person.name} & ${event.spouse.name}`
      : `${event.year} · ${person.name}`

  if (ctx) {
    const history = historyParagraph(person, allPeople, presentYear)
    return {
      life,
      paragraphs: [ctx.narrative, ctx.context, history].filter((paragraph): paragraph is string =>
        Boolean(paragraph),
      ),
    }
  }

  if (event.kind === 'marriage') {
    const partner = event.spouse
    const place = event.detail.includes('·') ? event.detail.split('·').slice(2).join('·').trim() : ''
    const house = event.title.replace(/\s+marriage$/i, '')
    const children = [
      ...new Set([...(person.children ?? []), ...(partner?.children ?? [])]),
    ]
      .map((id) => byId[id]?.name)
      .filter(Boolean)
    const sharedChildren = (person.children ?? []).filter((id) => partner?.children?.includes(id))
    const childNames = sharedChildren.map((id) => byId[id]?.name).filter(Boolean)

    const opening = partner
      ? `In ${event.year}${place ? `, in ${place}` : ''}, the archive records a ${house || 'family'} marriage: ${person.name} and ${partner.name} join two lines already walking through this tree.`
      : `In ${event.year} the archive records ${event.title}.`

    const kin =
      childNames.length > 0
        ? `Children of the union in this file include ${namedList(childNames)}. Their births are the next stitches in the same cloth.`
        : children.length
          ? `Later names in both households still sit in the Atlas — a reminder that a marriage is also a hinge between generations.`
          : `Open either spouse to follow parents, children, and the places that held them.`

    const history = historyParagraph(person, allPeople, presentYear)
    return {
      life,
      paragraphs: [opening, kin, history].filter((paragraph): paragraph is string => Boolean(paragraph)),
    }
  }

  if (event.kind === 'move') {
    const from = placeRegion(person.birthPlace) || 'an earlier ground'
    const to = placeRegion(person.deathPlace) || 'a later one'
    const opening = `${person.name} appears in more than one place. The marker sits near ${event.year} because the GEDCOM names a birth in ${from} and a later record in ${to} — an inferred crossing, not a stamped passport.`
    const history = historyParagraph(person, allPeople, presentYear)
    return {
      life,
      paragraphs: [
        opening,
        `Treat the year as a lantern hung along the road, not the hour the wheels turned. A city directory, border crossing, or letter home can still fix the true date.`,
        history,
      ].filter((paragraph): paragraph is string => Boolean(paragraph)),
    }
  }

  const history = historyParagraph(person, allPeople, presentYear)
  return {
    life,
    paragraphs: [
      event.detail || 'This event is connected to the documented family record.',
      history,
    ].filter((paragraph): paragraph is string => Boolean(paragraph)),
  }
}

export function buildHistoryNarrative(
  event: HistoryEvent,
  allPeople: Person[],
): DetailNarrative {
  const kin = peopleRelevantToEvent(event, allPeople).sort(
    (a, b) => (a.generation ?? 99) - (b.generation ?? 99),
  )
  const near = kin.filter((person) => person.generation != null && person.generation <= 3)
  const kinSentence =
    kin.length === 0
      ? 'No confidently located family record overlaps this year and place.'
      : kin.length === 1
        ? `In the family file, ${kin[0].name} was alive when this happened.`
        : `In the family file, ${kin.length} lives overlap this year, among them ${namedList((near.length ? near : kin).map((p) => p.name))}. That is a chorus, not a claim that any one of them stood at the event.`

  return {
    life: String(event.year),
    paragraphs: [event.summary, kinSentence],
  }
}
