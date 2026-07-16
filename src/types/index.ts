export type EventType =
  | 'birth'
  | 'death'
  | 'migration'
  | 'military'
  | 'occupation'
  | 'story'

export type ZoomLevel = 'far' | 'mid' | 'near' | 'close'

export type TimeRange = {
  start: Date
  end: Date
}

export type FamilyEvent = {
  id: string
  type: EventType
  label: string
  startDate: Date
  endDate?: Date
  place?: string
  summary?: string
  detailContent?: string
  sourceRefs?: string[]
}

export type WorldHistoryEvent = {
  id: string
  label: string
  startDate: Date
  endDate?: Date
  summary: string
  category: string
}

export type EventCluster = {
  id: string
  eventIds: string[]
  layer: 'family' | 'world'
  timeRange: TimeRange
  count: number
}

export type FamilyStory = {
  id: string
  title: string
  dateRange: TimeRange
  excerpt: string
  detailContent: string
  relatedEventIds: string[]
  mediaUrls?: string[]
}

export type DetailItem = FamilyEvent | FamilyStory | WorldHistoryEvent
