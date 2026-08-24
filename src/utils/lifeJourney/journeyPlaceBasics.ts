import { normalizePlace } from '../../places/normalizePlace'
import { matchAdmin1 } from '../../places/registry/adminDivisions'
import type { ParsedPlaceComponents } from '../../places/types'
import { resolvePlaceCoordinateLegacy } from '../../data/placeCoordinates'

const US_STATE_PATTERNS: [RegExp, string][] = [
  [/california|\blos angeles\b|\bmonrovia\b|\banaheim\b|\bsan diego\b|\borange\b/, 'california'],
  [/\btexas\b|\bel paso\b/, 'texas'],
  [/new jersey|\bcamden\b|\bgloucester city\b/, 'new-jersey'],
  [/pennsylvania|\bphiladelphia\b/, 'pennsylvania'],
  [/new york|\bbrooklyn\b/, 'new-york'],
  [/\barizona\b/, 'arizona'],
  [/new mexico/, 'new-mexico'],
  [/\billinois\b|\bchicago\b/, 'illinois'],
  [/\bohio\b/, 'ohio'],
  [/\bmissouri\b/, 'missouri'],
  [/\bmaryland\b/, 'maryland'],
]

function hasUsSignal(place: string): boolean {
  return /united states|\busa\b|united states of america|california|\btexas\b|new jersey|pennsylvania|new york|\barizona\b|new mexico|\billinois\b|\bohio\b|\bmissouri\b|\bmaryland\b|\bel paso\b|\blos angeles\b|\bmonrovia\b|\banaheim\b|\bcamden\b/.test(
    place,
  )
}

function usStateKey(place: string): string | null {
  for (const [pattern, state] of US_STATE_PATTERNS) {
    if (pattern.test(place)) return state
  }
  return null
}

function cleanLocality(locality: string | null): string | null {
  if (!locality) return null
  const cleaned = locality.replace(/^of\s+/i, '').trim()
  return cleaned || null
}

function admin2IsUsStateHomonym(admin2: string, admin1: string): boolean {
  const state = matchAdmin1(admin2, 'United States')
  return state != null && state.name !== admin1
}

export function journeyLabelFromComponents(components: ParsedPlaceComponents): string {
  const { locality, admin2, admin1, country } = components
  const town = cleanLocality(locality)

  if (country === 'United States' && admin1) {
    if (town) return `${town}, ${admin1}`
    if (admin2) {
      if (admin2IsUsStateHomonym(admin2, admin1)) return `${admin2} County, ${admin1}`
      return `${admin2}, ${admin1}`
    }
    return admin1
  }

  if (country === 'Mexico') {
    if (town && admin1) return `${town}, ${admin1}`
    if (town) return town
    if (admin1) return `${admin1}, Mexico`
    return 'Mexico'
  }

  if (country === 'England' || country === 'Scotland' || country === 'Ireland') {
    if (town && admin1) return `${town}, ${admin1}`
    if (town?.includes(',')) return town
    if (town) return `${town}, ${country}`
    if (admin1) return `${admin1}, ${country}`
    return country
  }

  if (town && country) return `${town}, ${country}`
  if (town && admin1) return `${town}, ${admin1}`
  if (town) return town
  if (admin1 && country) return `${admin1}, ${country}`
  if (admin1) return admin1
  if (country) return country
  return ''
}

function journeyLabelLegacyFallback(place: string): string {
  const parts = place
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && part !== '')
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].replace(/^of\s+/i, '').trim()
  const first = parts[0].replace(/^of\s+/i, '').trim()
  const second = parts[1]
  if (matchAdmin1(second, 'United States') && parts[2]) {
    return `${first}, ${parts[2].trim()}`
  }
  return `${first}, ${second}`
}

export function journeyPlaceKey(place = ''): string {
  const raw = place.trim()
  if (!raw) return ''
  const s = raw.toLowerCase()

  if (/westminster/.test(s)) {
    if (hasUsSignal(s) || /orange|\bca\b/.test(s)) return 'united-states:california'
    if (/england|london|uk\b/.test(s)) return 'england'
    return 'westminster'
  }

  if (/mexico|chihuahua|coahuila|durango|zacatecas|aldama|carretas/.test(s) && !hasUsSignal(s)) {
    return 'mexico'
  }
  if (/scotland|glasgow|edinburgh|caithness|latheron/.test(s)) return 'scotland'
  if (/ireland|\bdublin\b/.test(s) && !hasUsSignal(s)) return 'ireland'
  if (
    /england|cheshire|gawsworth|bollington|astbury|prestbury|london/.test(s) &&
    !hasUsSignal(s)
  ) {
    return 'england'
  }

  if (hasUsSignal(s) || usStateKey(s)) {
    const state = usStateKey(s)
    return state ? `united-states:${state}` : 'united-states'
  }

  const coord = resolvePlaceCoordinateLegacy(raw)
  if (coord.resolved && coord.region) {
    if (coord.region === 'United States') {
      const state = usStateKey(s)
      return state ? `united-states:${state}` : 'united-states'
    }
    return coord.region.toLowerCase()
  }

  return ''
}

export function journeyPlaceLabel(place = ''): string {
  const trimmed = place.trim()
  if (!trimmed) return ''

  const { components } = normalizePlace(trimmed)
  if (components.parseQuality !== 'empty') {
    const label = journeyLabelFromComponents(components)
    if (label) return label
  }

  return journeyLabelLegacyFallback(trimmed)
}
