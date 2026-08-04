import type { MapCamera } from '../../utils/mapSemanticZoom'
import type { DocumentaryCamera } from '../types/manifest'

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

export function interpolateDocumentaryCamera(
  config: DocumentaryCamera | undefined,
  progress: number,
  focus?: { cx: number; cy: number; scale?: number },
): MapCamera {
  const focusScale = focus?.scale ?? 1
  const cxStart = config?.cxStart ?? focus?.cx ?? 50
  const cyStart = config?.cyStart ?? focus?.cy ?? 50
  const scaleStart = config?.scaleStart ?? focusScale
  const cxEnd = config?.cxEnd ?? cxStart
  const cyEnd = config?.cyEnd ?? cyStart
  const scaleEnd = config?.scaleEnd ?? scaleStart

  const t = easeInOut(Math.min(1, Math.max(0, progress)))
  return {
    cx: cxStart + (cxEnd - cxStart) * t,
    cy: cyStart + (cyEnd - cyStart) * t,
    scale: scaleStart + (scaleEnd - scaleStart) * t,
  }
}

/** Subtle continuous drift so the camera never fully stops mid-scene. */
export function documentaryCameraDrift(progress: number, phase: number): { dx: number; dy: number } {
  const t = Math.min(1, Math.max(0, progress))
  return {
    dx: Math.sin(t * Math.PI * 2.2 + phase) * 0.35,
    dy: Math.cos(t * Math.PI * 1.8 + phase * 0.6) * 0.22,
  }
}
