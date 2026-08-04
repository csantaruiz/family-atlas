export type PersonImage = {
  src: string
  alt: string
  caption?: string
  credit?: string
  isPlaceholder?: boolean
  /** True when the image was uploaded in this browser and stored locally. */
  isUserUpload?: boolean
}

export type Person = {
  id: string
  name: string
  sex?: string
  birthDate?: string
  birthYear?: number | null
  birthPlace?: string
  deathDate?: string
  deathYear?: number | null
  deathPlace?: string
  generation?: number | null
  focus?: boolean
  occupation?: string[]
  places?: string[]
  parents?: string[]
  spouses?: string[]
  children?: string[]
  image?: PersonImage
}

export type FamilyDatabase = {
  people: Person[]
  root: string
  stats: {
    people: number
    families: number
    earliestYear: number
    latestYear: number
    earliestName: string
    places: [string, number][]
    surnames: [string, number][]
  }
}

export type StoryChapter = {
  id: string
  title: string
  subtitle: string
  yearStart: number
  yearEnd: number
  summary: string
  importance: number
  relatedEventIds: string[]
  relatedPersonIds: string[]
}

export type FamilyEventKind = 'birth' | 'death' | 'move' | 'service'

export type FamilyEvent = {
  kind: FamilyEventKind
  year: number
  title: string
  detail: string
  person: Person
  importance: number
}

export type HistoryEvent = {
  year: number
  title: string
  country: string
  importance: number
  summary: string
}

export type StorySeed = {
  year: number
  kicker: string
  title: string
  blurb: string
  personId: string
}

export type EventContextEntry = {
  narrative: string
  context: string
  sources: [string, string][]
}

export type EventContextMap = Record<string, EventContextEntry>

export type ZoomMode = 'centuries' | 'eras' | 'generations' | 'decades' | 'years'

export type Viewport = {
  start: number
  end: number
}

export type DetailContent =
  | { type: 'person'; personId: string }
  | { type: 'familyEvent'; event: FamilyEvent }
  | { type: 'history'; event: HistoryEvent }
  | { type: 'thinking'; thinking: AtlasThinking }
  | null

export type BirthCluster = {
  y: number
  people: Person[]
  from: number
  to: number
  x: number
  leftX: number
  rightX: number
  displayY: number
}

export type FamilyEventGroup = {
  events: FamilyEvent[]
  x: number
  lastX: number
  importance: number
}

export type PlacedPerson = {
  person: Person
  x: number
  y: number
  show: boolean
}

export type RenderedHistoryEvent = {
  event: HistoryEvent
  x: number
  y: number
  stemHeight: number
}

export type AtlasThinkingConfidence = 'Low' | 'Medium' | 'High'

/** Placeholder pattern observations — replace via pattern engine or API. */
export type AtlasThinking = {
  id: string
  observation: string
  recordCount: number
  confidence: AtlasThinkingConfidence
  relatedPersonIds: string[]
  relatedEventIds: string[]
  yearStart: number
  yearEnd: number
  evidenceSummary: string
}
