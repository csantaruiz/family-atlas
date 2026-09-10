/**
 * Reusable documentary soundtrack configuration.
 * Swap `src` / volumes per story without changing playback plumbing.
 */

export type DocumentarySoundtrackConfig = {
  /** Public URL for the score asset. */
  src: string
  /** Bed under narration — keep well below speech. */
  baseVolume: number
  /** Extra duck while narration is actively speaking. */
  duckedVolume: number
  /** Slightly more present in the late act / after narration ends. */
  presenceVolume: number
  /** Opening swell once Documentary playback begins. */
  fadeInMs: number
  /** Closing swell → silence after the story finishes. */
  fadeOutMs: number
  /** Faster exit when the user leaves or skips mid-story. */
  exitFadeMs: number
  /**
   * When the score ends before the documentary, wait this long,
   * then gently re-enter from the top (no hard restart).
   */
  softLoopGapMs: number
  softLoopFadeInMs: number
  /** Documentary clock time where presence may rise slightly. */
  presenceFromMs: number
}

export const DEFAULT_DOCUMENTARY_SOUNDTRACK: DocumentarySoundtrackConfig = {
  src: '/audio/documentary-score.mp3',
  baseVolume: 0.16,
  duckedVolume: 0.12,
  presenceVolume: 0.2,
  fadeInMs: 4_000,
  fadeOutMs: 6_500,
  exitFadeMs: 1_400,
  softLoopGapMs: 1_800,
  softLoopFadeInMs: 3_200,
  /** Aligns with Convergence / closing pull-back. */
  presenceFromMs: 210_000,
}

export const SOUNDTRACK_MUTE_SESSION_KEY = 'atlas-documentary-score-muted'
