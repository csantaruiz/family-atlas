import { AUDIO_CAMERA_CUES } from './audioSyncDirector'
import type { SceneManifestEntry } from '../types/manifest'

export type ChapterMarker = {
  chapter: string
  label: string
  startMs: number
}

/** First audio-analyzed cue per chapter — used for scrubber marks. */
export function chapterMarkersFromManifest(_manifest: SceneManifestEntry[]): ChapterMarker[] {
  const seen = new Set<string>()
  const markers: ChapterMarker[] = []

  for (const cue of AUDIO_CAMERA_CUES) {
    if (seen.has(cue.chapter)) continue
    seen.add(cue.chapter)
    markers.push({
      chapter: cue.chapter,
      label: cue.chapter,
      startMs: cue.timeMs,
    })
  }

  return markers
}

export function startedChapterMarkers(
  markers: ChapterMarker[],
  currentTimeMs: number,
): ChapterMarker[] {
  return markers.filter((marker) => currentTimeMs >= marker.startMs)
}
