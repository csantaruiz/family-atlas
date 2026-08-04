import { describe, expect, it } from 'vitest'
import { resolveAudioSync } from '../core/audioSyncDirector'
import { resolveSceneAtTime } from '../core/SceneDirector'
import { DOCUMENTARY_MANIFEST } from '../data/documentaryManifest'

const DURATION_MS = 384_888

describe('audio sync director — late script', () => {
  it('holds Ojinaga until the narration names El Paso', () => {
    const before = resolveSceneAtTime(DOCUMENTARY_MANIFEST, 170_000, DURATION_MS)
    expect(before?.scene.id).toBe('ojinaga-town')

    const crossing = resolveSceneAtTime(DOCUMENTARY_MANIFEST, 172_000, DURATION_MS)
    expect(crossing?.scene.id).toBe('migration-border')
  })

  it('moves to California when the narration reaches Monrovia', () => {
    const frame = resolveSceneAtTime(DOCUMENTARY_MANIFEST, 196_000, DURATION_MS)
    expect(frame?.scene.id).toBe('migration-california')
    expect(frame?.chapter).toBe('Migration')
  })

  it('does not start convergence until ~3:30 in the audio', () => {
    const early = resolveSceneAtTime(DOCUMENTARY_MANIFEST, 205_000, DURATION_MS)
    expect(early?.chapter).not.toBe('Convergence')

    const convergence = resolveSceneAtTime(DOCUMENTARY_MANIFEST, 276_000, DURATION_MS)
    expect(convergence?.scene.id).toBe('convergence-threads')
    expect(convergence?.chapter).toBe('Convergence')
  })

  it('arrives at Santa Clara when Craig Ruiz is named', () => {
    const frame = resolveSceneAtTime(DOCUMENTARY_MANIFEST, 298_000, DURATION_MS)
    expect(frame?.scene.id).toBe('convergence-present')
    expect(frame?.scene.choreography?.activePlaceId).toBe('santa-clara')
  })

  it('opens the atlas closing only after enter-the-atlas narration', () => {
    const before = resolveSceneAtTime(DOCUMENTARY_MANIFEST, 360_000, DURATION_MS)
    expect(before?.scene.id).toBe('atlas-timeline')

    const closing = resolveSceneAtTime(DOCUMENTARY_MANIFEST, 380_000, DURATION_MS)
    expect(closing?.scene.id).toBe('atlas-closing')
  })

  it('eases camera progress in at the start of each cue segment', () => {
    const sync = resolveAudioSync(172_500, undefined, DURATION_MS)
    expect(sync.progress).toBeLessThan(0.25)
  })
})
