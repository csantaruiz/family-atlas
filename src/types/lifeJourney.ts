import type { PersonImage } from './index'

export type JourneyEvidenceKind = 'documented' | 'historical-context' | 'inferred'

export type JourneyBeatType =
  | 'birth'
  | 'youth'
  | 'move'
  | 'marriage'
  | 'service'
  | 'death'
  | 'epilogue'

export type JourneyMapPoint = {
  x: number
  y: number
  scale: number
  resolved: boolean
}

export type LifeJourneyBeat = {
  id: string
  type: JourneyBeatType
  year: number
  yearLabel: string
  title: string
  caption: string
  evidence: JourneyEvidenceKind
  evidenceLabel: string
  locationLabel: string | null
  map: JourneyMapPoint | null
  durationMs: number
  /** Canonical family-event id when this beat is anchored to one. */
  eventId: string | null
  image: PersonImage | null
  imageKind: 'authentic' | 'stock' | 'none'
}

export type LifeJourney = {
  personId: string
  personName: string
  givenName: string
  ctaLabel: string
  eligible: boolean
  ineligibleReason: string | null
  beats: LifeJourneyBeat[]
}
