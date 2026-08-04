import type { DocumentaryBranch } from './manifest'

/** Geographic scale bands — drive camera zoom and label visibility. */
export type GeographicScale =
  | 'world'
  | 'continental'
  | 'country'
  | 'regional'
  | 'local'

export type CameraRelation =
  | 'continue-camera'
  | 'zoom-in'
  | 'zoom-out'
  | 'pan'
  | 'fit-route'
  | 'fit-bounds'
  | 'hold'
  | 'chapter-reset'
  | 'chapter-transition'

export type RouteEvidence = 'confirmed' | 'generational' | 'branch'

export type ApprovedPersonRole = 'active' | 'context'

/** Script/manifest-authorized person — renderer must not infer from GEDCOM. */
export type ApprovedPerson = {
  personId?: string
  displayName: string
  role?: ApprovedPersonRole
  year?: number | string
  placeId?: string
  /** Scene progress 0–1 when name enters */
  start: number
  /** Scene progress 0–1 when name exits */
  end: number
  insight?: string
}

export type NarrativeOverlaySpec = {
  eyebrow?: string
  title?: string
  subtitle?: string
  date?: string
  insight?: string
  start: number
  end: number
}

export type SceneChoreography = {
  cameraRelation: CameraRelation
  geographicScale: GeographicScale
  focusPlaceIds?: string[]
  activePlaceId?: string
  visiblePlaceIds?: string[]
  holdCamera?: boolean
  cameraEnd?: { cx: number; cy: number; scale: number }
  routes?: Array<{
    fromId: string
    toId: string
    evidence: RouteEvidence
    drawAfter?: number
  }>
  /** Explicit manifest authorization — empty means no person names. */
  approvedPeople?: ApprovedPerson[]
  narrativeOverlay?: NarrativeOverlaySpec
  branch?: DocumentaryBranch
}

export type ResolvedMarker = {
  id: string
  placeId: string
  x: number
  y: number
  active: boolean
  contextual: boolean
  preview?: boolean
  /** Dot added when the place is first named in the late script on a wide map. */
  lateScript?: boolean
  branch?: DocumentaryBranch
  opacity: number
}

export type ResolvedGeoLabel = {
  id: string
  text: string
  subtext?: string
  x: number
  y: number
  priority: number
  active: boolean
  /** Fixed screen px — not map-scaled. */
  fontSizePx: number
  opacity: number
}

export type ResolvedRoute = {
  id: string
  d: string
  evidence: RouteEvidence
  opacity: number
  drawProgress: number
  /** Ocean-crossing corridor — stronger dashed styling in the renderer. */
  transoceanic?: boolean
  /** Seconds for one directional dash cycle along the path. */
  flowDurationSec?: number
}

export type NarrativeStack = {
  eyebrow?: { text: string; opacity: number }
  primary?: { text: string; opacity: number }
  secondary?: { text: string; subtext?: string; opacity: number }
  tertiary?: { text: string; opacity: number }
  insight?: { text: string; opacity: number }
}

export type CameraDebugInfo = {
  transitionType: CameraRelation
  startCenter: { cx: number; cy: number; scale: number }
  targetCenter: { cx: number; cy: number; scale: number }
  currentCenter: { cx: number; cy: number; scale: number }
  targetZoom: number
  targetSource: string
  fallbackUsed: boolean
  fitBoundsActive: boolean
  staged: boolean
}

export type TimeLayerState = {
  mode: 'hidden' | 'subtle'
  opacity: number
  rangeStart: number
  rangeEnd: number
  activeYear?: number
  activePerson?: string
  /** 0–1 position of the active historical year on the family span bar. */
  playheadRatio?: number
}

import type { NarrativeOverlayState } from '../core/narrativeOverlayDirector'

export type DocumentaryFrame = {
  camera: { cx: number; cy: number; scale: number }
  geographicScale: GeographicScale
  markers: ResolvedMarker[]
  /** Single active geographic label, screen-space rendered. */
  geoLabel: ResolvedGeoLabel | null
  routes: ResolvedRoute[]
  narrativeOverlay: NarrativeOverlayState | null
  approvedPeople: ApprovedPerson[]
  activePlaceId?: string
  chapter: string
  sceneId: string
  sceneProgress: number
  timeLayer: TimeLayerState
  cameraDebug?: CameraDebugInfo
  cameraGuardFailed?: boolean
}
