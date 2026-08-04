import type { ResolvedScene, SceneManifestEntry } from '../types/manifest'
import {
  AUDIO_ANALYZED_DURATION_MS,
  resolveSceneFromAudioSync,
} from './audioSyncDirector'

/** Resolve the active scene from Whisper-analyzed audio camera cues. */
export function resolveSceneAtTime(
  manifest: SceneManifestEntry[],
  timeMs: number,
  narrationDurationMs = 0,
): ResolvedScene | null {
  if (manifest.length === 0) return null

  const durationMs = narrationDurationMs > 0 ? narrationDurationMs : AUDIO_ANALYZED_DURATION_MS
  return resolveSceneFromAudioSync(manifest, timeMs, durationMs)
}

export function resolveChapterAtTime(
  manifest: SceneManifestEntry[],
  timeMs: number,
  narrationDurationMs = 0,
): string {
  return (
    resolveSceneAtTime(manifest, timeMs, narrationDurationMs)?.chapter ??
    manifest[0]?.chapter ??
    'Opening'
  )
}
