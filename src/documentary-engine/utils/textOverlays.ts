import type { TextOverlay } from '../types/manifest'

const DEFAULT_START = 0.1
const DEFAULT_END = 0.78
const FADE = 0.12

export function overlayOpacity(progress: number, overlay: TextOverlay): number {
  const start = overlay.start ?? DEFAULT_START
  const end = overlay.end ?? DEFAULT_END

  if (progress < start) return 0
  if (progress < start + FADE) return (progress - start) / FADE
  if (progress > end) {
    if (progress > end + FADE) return 0
    return (end + FADE - progress) / FADE
  }
  return 1
}
