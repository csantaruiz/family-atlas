import {
  NARRATIVE_FADE_IN_MS,
  NARRATIVE_FADE_OUT_MS,
  NARRATIVE_HOLD_MS,
} from '../data/playbackConfig'

const FADE = 0.1

function slotOpacityWithFade(progress: number, start: number, end: number, fade: number): number {
  if (progress < start) return 0
  if (progress < start + fade) return (progress - start) / fade
  if (progress > end) {
    if (progress > end + fade) return 0
    return (end + fade - progress) / fade
  }
  return 1
}

/** Overlay lifecycle — enter, hold, exit with no overlap at boundaries. */
export function slotOpacity(progress: number, start: number, end: number): number {
  return slotOpacityWithFade(progress, start, end, FADE)
}

function easeInOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2
}

/** Narrative caption opacity from elapsed ms since the line first appeared. */
export function narrativeVisibilityOpacity(elapsedMs: number): number {
  if (elapsedMs <= 0) return 0
  if (elapsedMs < NARRATIVE_FADE_IN_MS) {
    return easeInOutCubic(elapsedMs / NARRATIVE_FADE_IN_MS)
  }
  if (elapsedMs < NARRATIVE_FADE_IN_MS + NARRATIVE_HOLD_MS) {
    return 1
  }
  const fadeElapsed = elapsedMs - NARRATIVE_FADE_IN_MS - NARRATIVE_HOLD_MS
  if (fadeElapsed >= NARRATIVE_FADE_OUT_MS) return 0
  return 1 - easeInOutCubic(fadeElapsed / NARRATIVE_FADE_OUT_MS)
}
