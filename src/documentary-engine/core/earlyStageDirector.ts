import { getCanonicalPlace } from '../data/canonicalPlaceRegistry'
import type { MapCamera } from '../../utils/mapSemanticZoom'
import type { DocumentarySceneType } from '../types/manifest'
import type { ResolvedMarker } from '../types/choreography'

/** Through Cheshire bridge — before the Spain branch opens the wider arc. */
export const EARLY_STAGE_END_MS = 94_000

/** Places that debut after the early act — previewed with a single pulse each. */
export const EARLY_PREVIEW_PLACE_IDS = [
  'spain',
  'chihuahua',
  'ojinaga',
  'el-paso',
  'california',
  'santa-clara',
] as const

const PREVIEW_PULSE_WINDOW_START_MS = 18_000
const PREVIEW_PULSE_WINDOW_END_MS = 82_000
const PREVIEW_PULSE_DURATION_MS = 3_400

export function isEarlyDocumentaryStage(
  timeMs: number,
  chapter: string,
  sceneType: DocumentarySceneType,
): boolean {
  if (timeMs >= EARLY_STAGE_END_MS) return false
  if (chapter === 'Opening' || chapter === 'England') return true
  if (sceneType === 'world-establishing') return true
  if (chapter === 'Origins in Cheshire') return true
  return false
}

/** Slow atlas drift and zoom-in while the story is still orienting. */
export function applyEarlyStageCamera(camera: MapCamera, timeMs: number): MapCamera {
  const t = timeMs / 1000
  const progress = Math.min(1, Math.max(0, timeMs / EARLY_STAGE_END_MS))

  return {
    cx: camera.cx + Math.sin(t * 0.07) * 0.32 + progress * 0.28,
    cy: camera.cy + Math.cos(t * 0.055) * 0.18 - progress * 0.06,
    scale: camera.scale + Math.sin(t * 0.04) * 0.0025 + progress * 0.014,
  }
}

function previewPulseOpacity(elapsedMs: number): number {
  if (elapsedMs <= 0 || elapsedMs >= PREVIEW_PULSE_DURATION_MS) return 0
  const t = elapsedMs / PREVIEW_PULSE_DURATION_MS
  if (t < 0.2) return t / 0.2 * 0.55
  if (t < 0.55) return 0.55 + ((t - 0.2) / 0.35) * 0.35
  return 0.9 * (1 - (t - 0.55) / 0.45)
}

function previewStartMsForIndex(index: number): number {
  const count = EARLY_PREVIEW_PLACE_IDS.length
  if (count <= 1) return PREVIEW_PULSE_WINDOW_START_MS
  const span = PREVIEW_PULSE_WINDOW_END_MS - PREVIEW_PULSE_WINDOW_START_MS
  return PREVIEW_PULSE_WINDOW_START_MS + (span / (count - 1)) * index
}

/** One subtle pulse per future location, staggered across the opening act. */
export function resolveEarlyPreviewMarkers(timeMs: number): ResolvedMarker[] {
  if (timeMs < PREVIEW_PULSE_WINDOW_START_MS || timeMs >= EARLY_STAGE_END_MS) {
    return []
  }

  return EARLY_PREVIEW_PLACE_IDS.flatMap((placeId, index) => {
    const place = getCanonicalPlace(placeId)
    if (!place || place.confidence === 'unresolved') return []

    const startMs = previewStartMsForIndex(index)
    const elapsed = timeMs - startMs
    if (elapsed < 0 || elapsed > PREVIEW_PULSE_DURATION_MS) return []

    const opacity = previewPulseOpacity(elapsed)
    if (opacity <= 0) return []

    return [
      {
        id: `preview-${placeId}`,
        placeId,
        x: place.x,
        y: place.y,
        active: false,
        contextual: true,
        preview: true,
        branch: place.branch,
        opacity,
      },
    ]
  })
}
