import type { DocumentaryKenBurns } from '../types/documentary'

const DEFAULT: Required<DocumentaryKenBurns> = {
  scaleStart: 1,
  scaleEnd: 1.12,
  xStart: 0,
  xEnd: -3,
  yStart: 0,
  yEnd: -2,
}

export function kenBurnsStyle(ratio: number, config?: DocumentaryKenBurns) {
  const kb = { ...DEFAULT, ...config }
  const t = Math.min(1, Math.max(0, ratio))
  const scale = kb.scaleStart + (kb.scaleEnd - kb.scaleStart) * t
  const x = kb.xStart + (kb.xEnd - kb.xStart) * t
  const y = kb.yStart + (kb.yEnd - kb.yStart) * t
  return {
    transform: `scale(${scale}) translate(${x}%, ${y}%)`,
  }
}

/** Fade in first 12%, hold, fade out last 14%. */
export function sceneOpacity(ratio: number): number {
  if (ratio <= 0) return 0
  if (ratio < 0.12) return ratio / 0.12
  if (ratio < 0.86) return 1
  if (ratio >= 1) return 0
  return 1 - (ratio - 0.86) / 0.14
}
