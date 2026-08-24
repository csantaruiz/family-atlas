import type { AppView } from '../types/navigation'

/** Primary destinations for exploring the family. Future mobile Explore can reuse this list. */
export type ExploreNavItem = {
  id: string
  label: string
  view: AppView
}

export const EXPLORE_NAV: ExploreNavItem[] = [
  { id: 'timeline', label: 'Timeline', view: 'journey' },
  { id: 'journeys', label: 'Journeys', view: 'map' },
  { id: 'tree', label: 'Tree', view: 'tree' },
  { id: 'people', label: 'People', view: 'people' },
  { id: 'about', label: 'About', view: 'about' },
]

export function exploreMenuLabel(): string {
  return 'Explore'
}

/** Owner/maintenance actions. Future Manage items append here. */
export type OwnerActionId = 'review' | 'update-tree'

export type OwnerAction = {
  id: OwnerActionId
  title: string
  description: string
}

export const OWNER_ACTIONS: OwnerAction[] = [
  {
    id: 'review',
    title: 'Atlas Review',
    description: 'Review details that need your help',
  },
  {
    id: 'update-tree',
    title: 'Update family tree',
    description: 'Upload a newer GEDCOM',
  },
]
