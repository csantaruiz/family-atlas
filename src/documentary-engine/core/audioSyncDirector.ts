import cueSheet from '../data/documentary-camera-cues.json'
import type { SceneManifestEntry } from '../types/manifest'

export type AudioCameraCue = {
  id: string
  timeMs: number
  sceneId: string
  chapter: string
  placeId?: string
  matchedText?: string
}

export type ResolvedAudioSync = {
  cue: AudioCameraCue
  nextCue: AudioCameraCue | null
  progress: number
  rawProgress: number
  elapsedMs: number
  segmentDurationMs: number
}

export const AUDIO_CAMERA_CUES: AudioCameraCue[] = cueSheet.cues
export const AUDIO_ANALYZED_DURATION_MS = cueSheet.durationMs

/** Progress curve — ease-in so the map arrives with the spoken place name, not before it. */
export function syncProgress(raw: number): number {
  const t = Math.min(1, Math.max(0, raw))
  return t * t
}

export function resolveAudioSync(
  timeMs: number,
  cues: AudioCameraCue[] = AUDIO_CAMERA_CUES,
  durationMs = AUDIO_ANALYZED_DURATION_MS,
): ResolvedAudioSync {
  const clampedTime = Math.max(0, Math.min(timeMs, durationMs))
  let index = 0

  for (let i = 0; i < cues.length; i += 1) {
    if (clampedTime >= cues[i]!.timeMs) index = i
    else break
  }

  const cue = cues[index]!
  const nextCue = cues[index + 1] ?? null
  const segmentEndMs = nextCue?.timeMs ?? durationMs
  const segmentDurationMs = Math.max(1, segmentEndMs - cue.timeMs)
  const elapsedMs = Math.max(0, clampedTime - cue.timeMs)
  const rawProgress = Math.min(1, elapsedMs / segmentDurationMs)

  return {
    cue,
    nextCue,
    progress: syncProgress(rawProgress),
    elapsedMs,
    segmentDurationMs,
    rawProgress,
  }
}

export function resolveSceneFromAudioSync(
  manifest: SceneManifestEntry[],
  timeMs: number,
  durationMs = AUDIO_ANALYZED_DURATION_MS,
) {
  const sync = resolveAudioSync(timeMs, AUDIO_CAMERA_CUES, durationMs)
  const scene =
    manifest.find((entry) => entry.id === sync.cue.sceneId) ??
    manifest.find((entry) => entry.chapter === sync.cue.chapter) ??
    manifest[0]

  if (!scene) return null

  return {
    scene,
    progress: sync.progress,
    rawProgress: sync.rawProgress,
    elapsedMs: sync.elapsedMs,
    chapter: sync.cue.chapter,
    audioCue: sync.cue,
  }
}

export function resolveChapterFromAudioSync(
  timeMs: number,
  durationMs = AUDIO_ANALYZED_DURATION_MS,
): string {
  return resolveAudioSync(timeMs, AUDIO_CAMERA_CUES, durationMs).cue.chapter
}
