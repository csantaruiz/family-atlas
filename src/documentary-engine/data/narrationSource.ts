/** Master narration — single source of truth for documentary timing. */
export const NARRATION_AUDIO_SRC = '/documentary/santa-ruiz-story.mp3'

export type NarrationCue = {
  timeMs: number
  sceneId: string
}

/** Cue sheet aligned with `public/documentary/documentary-cues.json`. */
export const NARRATION_CUES: NarrationCue[] = [
  { timeMs: 0, sceneId: 'opening' },
  { timeMs: 18_000, sceneId: 'england' },
  { timeMs: 44_000, sceneId: 'lowndes' },
  { timeMs: 66_000, sceneId: 'cheshire_map' },
  { timeMs: 94_000, sceneId: 'spain' },
  { timeMs: 120_000, sceneId: 'chihuahua' },
  { timeMs: 150_000, sceneId: 'migration' },
  { timeMs: 210_000, sceneId: 'convergence' },
  { timeMs: 250_000, sceneId: 'atlas' },
]

/** Maps cue-sheet ids to manifest scene ids active at each cue. */
export const NARRATION_CUE_MANIFEST_SCENE: Record<string, string> = {
  opening: 'opening',
  england: 'britain',
  lowndes: 'gawsworth-william',
  cheshire_map: 'cheshire-timeline',
  spain: 'spain-branch',
  chihuahua: 'chihuahua-arrival',
  migration: 'migration-border',
  convergence: 'convergence-threads',
  atlas: 'atlas-timeline',
}
