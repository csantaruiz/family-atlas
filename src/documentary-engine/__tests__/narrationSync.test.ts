import { describe, expect, it } from 'vitest'
import { DOCUMENTARY_MANIFEST } from '../data/documentaryManifest'
import { chapterMarkersFromManifest } from '../core/chapterMarkers'
import { resolveSceneAtTime } from '../core/SceneDirector'
import { AUDIO_CAMERA_CUES } from '../core/audioSyncDirector'

const DURATION_MS = 384_888

describe('audio-analyzed narration sync', () => {
  it('maps every camera cue to a manifest scene template', () => {
    for (const cue of AUDIO_CAMERA_CUES) {
      const resolved = resolveSceneAtTime(DOCUMENTARY_MANIFEST, cue.timeMs, DURATION_MS)
      expect(resolved?.scene.id).toBe(cue.sceneId)
      expect(resolved?.chapter).toBe(cue.chapter)
    }
  })

  it('does not reveal Cheshire before the transcript names it (~0:43)', () => {
    const before = resolveSceneAtTime(DOCUMENTARY_MANIFEST, 42_000, DURATION_MS)
    expect(before?.scene.id).not.toBe('cheshire-records')
    expect(before?.scene.id).not.toBe('cheshire-timeline')

    const at = resolveSceneAtTime(DOCUMENTARY_MANIFEST, 43_200, DURATION_MS)
    expect(at?.scene.id).toBe('cheshire-records')
  })
})

describe('chapter markers', () => {
  it('lists the first audio cue of each chapter in order', () => {
    const markers = chapterMarkersFromManifest(DOCUMENTARY_MANIFEST)
    expect(markers.map((m) => m.chapter)).toEqual([
      'Opening',
      'Origins in Cheshire',
      'Spain & Chihuahua',
      'Migration',
      'Convergence',
      'Enter the Atlas',
    ])
    expect(markers[1]?.startMs).toBe(43_200)
  })
})
