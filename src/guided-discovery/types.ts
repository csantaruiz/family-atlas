import type { HistoryEvent } from '../types'
import type { FamilyRegionId } from '../utils/mapRegions'
import type { AppView } from '../types/navigation'

/** Chapter kinds the selector may emit. Unavailable kinds are skipped, never fabricated. */
export type GuidedChapterKind =
  | 'origins'
  | 'branches'
  | 'world_in_change'
  | 'journeys'
  | 'present'

export type GuidedMapIntent =
  | { type: 'overview' }
  | { type: 'route'; routeId: string }
  | { type: 'region'; regionId: FamilyRegionId }

export type GuidedChapter = {
  id: string
  kind: GuidedChapterKind
  title: string
  /** Concise visitor narration (target ~40–80 words). */
  narration: string
  view: Extract<AppView, 'journey' | 'map' | 'tree'>
  /** Timeline camera target when view is journey (or after returning from map). */
  camera?: { center: number; span: number }
  highlightPersonIds: string[]
  openPersonId: string | null
  openHistory: HistoryEvent | null
  mapIntent: GuidedMapIntent | null
  /** Evidence / confidence note for Journeys chapters. */
  evidenceNote: string | null
}

export type GuidedDiscoveryStatus = 'idle' | 'active' | 'completed'
