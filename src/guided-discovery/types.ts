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
  /** Concise visitor narration (target ~35–55 words). */
  narration: string
  view: Extract<AppView, 'journey' | 'map' | 'tree'>
  /** Timeline camera target when view is journey. */
  camera?: { center: number; span: number }
  highlightPersonIds: string[]
  openPersonId: string | null
  openHistory: HistoryEvent | null
  mapIntent: GuidedMapIntent | null
  /** Evidence / confidence note for Journeys chapters. */
  evidenceNote: string | null
  /** One-line focus cue for the caption (person, event, or place). */
  focusLabel: string | null
  /** Optional history event to emphasize without opening a drawer. */
  focusHistory?: HistoryEvent | null
}

export type GuidedDiscoveryStatus = 'idle' | 'active' | 'closing' | 'completed'
