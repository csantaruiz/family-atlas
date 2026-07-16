import type { HistoryEvent, Person } from '../types'

export function placeRegion(place = ''): string {
  const s = String(place).toLowerCase()
  if (/mexico|chihuahua|coahuila|durango|zacatecas|jalisco|ojinaga|loredo|carretas|santa isabel|ramos arizpe/.test(s))
    return 'Mexico'
  if (/england|cheshire|gawsworth|westminster|london|durham|gloucester/.test(s)) return 'England'
  if (/scotland|glasgow|edinburgh/.test(s)) return 'Scotland'
  if (/ireland/.test(s)) return 'Ireland'
  if (/california|new jersey|pennsylvania|texas|new york|maryland|illinois|ohio|missouri|arizona|new mexico|united states|usa/.test(s))
    return 'United States'
  return ''
}

export function placeCountries(person: Person): Set<string> {
  const text = (person.places ?? [])
    .concat([person.birthPlace ?? '', person.deathPlace ?? ''])
    .join(' ')
    .toLowerCase()
  const out = new Set<string>()
  if (/england|cheshire|lancashire|yorkshire|westminster|london|gawsworth/.test(text)) out.add('England')
  if (/scotland|glasgow|edinburgh/.test(text)) out.add('Scotland')
  if (/ireland/.test(text)) out.add('Ireland')
  if (/england|scotland|ireland|wales|britain|united kingdom/.test(text)) out.add('Britain')
  if (/mexico|chihuahua|coahuila|durango|zacatecas|carretas|ciénega|cienega|allende|santa isabel|ramos arizpe|el paso del norte/.test(text))
    out.add('Mexico')
  if (/usa|united states|california|new jersey|pennsylvania|texas|new york|san antonio|el paso|ohio|illinois|missouri|arizona|colorado|new mexico/.test(text))
    out.add('United States')
  return out
}

export function activeCountriesAt(year: number, people: Person[]): Set<string> {
  const cs = new Set<string>()
  people.forEach((p) => {
    if (!p.birthYear) return
    const end = p.deathYear ?? p.birthYear + 85
    if (year >= p.birthYear && year <= end) {
      placeCountries(p).forEach((c) => cs.add(c))
    }
  })
  return cs
}

export function peopleRelevantToEvent(ev: HistoryEvent, people: Person[]): Person[] {
  return people.filter((p) => {
    if (!p.birthYear) return false
    const end = p.deathYear ?? p.birthYear + 85
    if (ev.year < p.birthYear || ev.year > end) return false
    if (ev.country === 'Global') return true
    const cs = placeCountries(p)
    if (ev.country === 'Britain')
      return cs.has('Britain') || cs.has('England') || cs.has('Scotland') || cs.has('Ireland')
    return cs.has(ev.country)
  })
}

export function movementSummary(event: { detail?: string; person: Person }): string {
  const d = event.detail ?? ''
  if (d.startsWith('From ')) return d.replace(' · approximate placement', '')
  const places = (event.person.places ?? []).filter(Boolean)
  if (places.length > 1)
    return (
      places[0].split(',').slice(0, 2).join(',') +
      ' → ' +
      places[places.length - 1].split(',').slice(0, 2).join(',')
    )
  return 'A change of place recorded in the family archive'
}
