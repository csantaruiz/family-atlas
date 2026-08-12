import { resolvePlaceCoordinate, type MapCoordinate } from '../../data/placeCoordinates'

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

/**
 * Coarse life-stage key for follow-mode geography.
 * Does not use placeRegion() — that mislabels California Westminster and
 * New Jersey Gloucester as England.
 */
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

  const coord = resolvePlaceCoordinate(raw)
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
  const parts = place
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && part !== '')
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  return parts.slice(0, 2).join(', ')
}

export function resolveJourneyCoordinate(place: string): MapCoordinate {
  const trimmed = place.trim()
  if (!trimmed) return { x: 50, y: 50, resolved: false, region: '' }

  // Prefer the actual GEDCOM place string so El Paso ≠ Chihuahua, Monrovia ≠ Bay Area.
  const direct = resolvePlaceCoordinate(trimmed)
  if (direct.resolved) return direct

  const key = journeyPlaceKey(trimmed)
  if (key === 'united-states:california') {
    return resolvePlaceCoordinate('Los Angeles, California, USA')
  }
  if (key === 'united-states:texas') {
    return resolvePlaceCoordinate('El Paso, Texas, USA')
  }
  if (key === 'united-states:new-jersey') {
    return resolvePlaceCoordinate('Camden City, Camden, New Jersey')
  }
  if (key === 'england') return resolvePlaceCoordinate('England')
  if (key === 'scotland') return resolvePlaceCoordinate('Scotland')
  if (key === 'mexico') return resolvePlaceCoordinate('Mexico')
  return { x: 50, y: 50, resolved: false, region: '' }
}

export function isTransatlanticKeyPair(a: string, b: string): boolean {
  const brit = (key: string) =>
    key === 'england' || key === 'scotland' || key === 'ireland' || key === 'britain'
  const us = (key: string) => key.startsWith('united-states')
  return (brit(a) && us(b)) || (brit(b) && us(a))
}
