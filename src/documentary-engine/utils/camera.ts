type KenBurnsCamera = {
  scaleStart?: number
  scaleEnd?: number
  xStart?: number
  xEnd?: number
  yStart?: number
  yEnd?: number
}

const DEFAULT: Required<KenBurnsCamera> = {
  scaleStart: 1,
  scaleEnd: 1.12,
  xStart: 0,
  xEnd: -3,
  yStart: 0,
  yEnd: -2,
}

/** Ken Burns + subtle continuous drift so the camera never fully stops. */
export function kenBurnsTransform(ratio: number, config?: KenBurnsCamera, driftPhase = 0) {
  const kb = { ...DEFAULT, ...config }
  const t = Math.min(1, Math.max(0, ratio))
  const scale = kb.scaleStart + (kb.scaleEnd - kb.scaleStart) * t
  const x = kb.xStart + (kb.xEnd - kb.xStart) * t
  const y = kb.yStart + (kb.yEnd - kb.yStart) * t
  const driftX = Math.sin(t * Math.PI * 3 + driftPhase) * 0.55
  const driftY = Math.cos(t * Math.PI * 2.4 + driftPhase * 0.7) * 0.35
  return {
    transform: `scale(${scale + Math.sin(driftPhase + t * 6) * 0.008}) translate(${x + driftX}%, ${y + driftY}%)`,
  }
}

/** Scene envelope for cross-dissolve edges. */
export function sceneEnvelope(progress: number, edge = 0.08): number {
  if (progress <= 0) return 0
  if (progress < edge) return progress / edge
  if (progress > 1 - edge) return (1 - progress) / edge
  return 1
}

export function routeEnvelope(progress: number): number {
  const draw = Math.min(1, Math.max(0, (progress - 0.08) / 0.45))
  const fade = progress > 0.82 ? (1 - progress) / 0.18 : 1
  return draw * fade
}

export function hashPhase(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 628
  return h / 100
}
