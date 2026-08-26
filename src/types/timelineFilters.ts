export type TimelineFilterKey =
  | 'rootPaternal'
  | 'rootMaternal'
  | 'coRootPaternal'
  | 'coRootMaternal'
  | 'births'
  | 'deaths'
  | 'marriages'
  | 'migrations'
  | 'military'
  | 'occupations'
  | 'residences'
  | 'photos'
  | 'stories'
  | 'historicalEvents'

export type TimelineFilters = Record<TimelineFilterKey, boolean>

export const LINEAGE_FILTER_KEYS = [
  'rootPaternal',
  'rootMaternal',
  'coRootPaternal',
  'coRootMaternal',
] as const satisfies readonly TimelineFilterKey[]

export const DEFAULT_TIMELINE_FILTERS: TimelineFilters = {
  rootPaternal: true,
  rootMaternal: true,
  coRootPaternal: true,
  coRootMaternal: true,
  births: true,
  deaths: true,
  marriages: true,
  migrations: true,
  military: true,
  occupations: true,
  residences: true,
  photos: true,
  stories: true,
  historicalEvents: true,
}

export type TimelineFilterGroup = {
  title: string
  keys: TimelineFilterKey[]
}

export const TIMELINE_FILTER_LABELS: Record<TimelineFilterKey, string> = {
  rootPaternal: 'Paternal',
  rootMaternal: 'Maternal',
  coRootPaternal: 'Paternal',
  coRootMaternal: 'Maternal',
  births: 'Births',
  deaths: 'Deaths',
  marriages: 'Marriages',
  migrations: 'Migrations',
  military: 'Military Service',
  occupations: 'Occupations',
  residences: 'Residences',
  photos: 'Photos',
  stories: 'Stories',
  historicalEvents: 'Historical Events',
}

export const TIMELINE_FILTER_GROUPS: TimelineFilterGroup[] = [
  {
    title: 'Family lines',
    keys: ['rootPaternal', 'rootMaternal', 'coRootPaternal', 'coRootMaternal'],
  },
  { title: 'Life events', keys: ['births', 'deaths', 'marriages'] },
  { title: 'Movement & place', keys: ['migrations', 'residences'] },
  { title: 'Records', keys: ['military', 'occupations', 'photos'] },
  { title: 'Narrative & context', keys: ['stories', 'historicalEvents'] },
]
