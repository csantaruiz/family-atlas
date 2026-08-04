import type { SceneChoreography } from './choreography'

/** Evidence categories — never present illustration as authentic fact. */
export type EvidenceCategory = 'authentic' | 'reconstructed' | 'contextual'

/** Map-first documentary scene types. */
export type DocumentarySceneType =
  | 'title'
  | 'world-establishing'
  | 'country-reveal'
  | 'region-reveal'
  | 'local-place'
  | 'generational-continuity'
  | 'migration'
  | 'branch-transition'
  | 'branch-convergence'
  | 'timeline-orientation'
  | 'authentic-evidence'
  | 'present-day-arrival'
  | 'closing'

export type DocumentaryBranch = 'british' | 'spanish-mexican' | 'eastern-us'

/** Cinematic camera keyframes — atlas coordinates (0–100) with scale. */
export type DocumentaryCamera = {
  cxStart?: number
  cyStart?: number
  scaleStart?: number
  cxEnd?: number
  cyEnd?: number
  scaleEnd?: number
}

export type MapLocation = {
  id: string
  x: number
  y: number
  label?: string
  subtitle?: string
  delayMs?: number
  branch?: DocumentaryBranch
  resolved?: boolean
}

/** Migration route between two labeled places on the same map. */
export type MigrationPath = {
  fromId: string
  toId: string
  /** When true, label as generational transition rather than exact travel. */
  generational?: boolean
  label?: string
}

export type TextOverlayKind = 'year' | 'place' | 'branch' | 'name' | 'insight' | 'emotional'

export type TextOverlay = {
  text: string
  kind: TextOverlayKind
  subtext?: string
  /** Scene progress 0–1 when overlay begins fading in. */
  start?: number
  /** Scene progress 0–1 when overlay begins fading out. */
  end?: number
}

export type MapSceneConfig = {
  places?: Array<{
    id: string
    placeKey: string
    label?: string
    subtitle?: string
    delayMs?: number
    branch?: DocumentaryBranch
  }>
  migrations?: MigrationPath[]
  overlays?: TextOverlay[]
  camera?: DocumentaryCamera
  branch?: DocumentaryBranch
}

/** Optional imagery — only for authentic evidence scenes. */
export type SceneAssets = {
  imageSrc?: string
  imageFallbacks?: string[]
  imageAlt?: string
}

export type SceneEvidence = {
  category: EvidenceCategory
  label: string
  title: string
  lines: string[]
}

export type SceneTransition = {
  in: 'dissolve' | 'fade'
  out: 'dissolve' | 'fade'
  durationMs: number
}

/** Interface between AI Historian outputs and Documentary Engine rendering. */
export type SceneManifestEntry = {
  id: string
  title: string
  chapter: string
  narrationStartMs: number
  narrationEndMs: number
  sceneType: DocumentarySceneType
  location?: string
  people?: string[]
  activePerson?: string
  activeYear?: number | string
  evidence?: SceneEvidence
  caption?: string
  /** V2.1 intelligent map choreography — preferred over legacy `map`. */
  choreography?: SceneChoreography
  map?: MapSceneConfig
  assets?: SceneAssets
  transition?: SceneTransition
  timelineWindow?: { start: number; end: number; label?: string }
}

export type ResolvedScene = {
  scene: SceneManifestEntry
  /** Eased progress for camera motion. */
  progress: number
  /** Linear progress for overlays, markers, and people. */
  rawProgress: number
  elapsedMs: number
  chapter: string
}

/** Scene types that render through the vector map canvas. */
export const MAP_SCENE_TYPES: DocumentarySceneType[] = [
  'world-establishing',
  'country-reveal',
  'region-reveal',
  'local-place',
  'generational-continuity',
  'migration',
  'branch-transition',
  'branch-convergence',
  'present-day-arrival',
]

export function isMapSceneType(type: DocumentarySceneType): boolean {
  return MAP_SCENE_TYPES.includes(type)
}
