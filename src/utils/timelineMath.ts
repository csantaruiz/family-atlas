import type { ZoomMode, Viewport } from '../types'
import { DESKTOP_PLOT_EDGE, plotEdgeForWidth } from './stageBreakpoints'

/** Desktop plot edge. Prefer `plotEdgeForWidth(width)` for layout math. */
export const PLOT_EDGE = DESKTOP_PLOT_EDGE

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function clampView(
  center: number,
  span: number,
  minYear: number,
  maxYear: number,
  fullSpan: number,
): { center: number; span: number } {
  let s = Math.max(6, Math.min(fullSpan, span))
  const half = s / 2
  const c = Math.max(minYear + half, Math.min(maxYear - half, center))
  return { center: c, span: s }
}

export function viewport(center: number, span: number): Viewport {
  return { start: center - span / 2, end: center + span / 2 }
}

export function yearX(year: number, start: number, span: number, width: number): number {
  const edge = plotEdgeForWidth(width)
  const usable = Math.max(1, width - edge * 2)
  return edge + ((year - start) / span) * usable
}

export function tickStep(span: number): number {
  if (span > 420) return 100
  if (span > 240) return 50
  if (span > 120) return 25
  if (span > 65) return 10
  if (span > 28) return 5
  if (span > 12) return 2
  return 1
}

export function zoomMode(span: number): ZoomMode {
  if (span > 360) return 'centuries'
  if (span > 170) return 'eras'
  if (span > 70) return 'generations'
  if (span > 24) return 'decades'
  return 'years'
}

export const ZOOM_CAPTIONS: Record<ZoomMode, string> = {
  centuries: 'Centuries · family density',
  eras: 'Eras · principal ancestors',
  generations: 'Generations · lives and turning points',
  decades: 'Decades · family events',
  years: 'Years · detailed family record',
}

export function spanFromZoomValue(value: number, fullSpan: number): number {
  const t = Number(value) / 100
  return Math.max(6, fullSpan * (1 - Math.pow(t, 2.35)))
}

export function zoomValueFromSpan(span: number, fullSpan: number): number {
  const ratio = 1 - span / fullSpan
  return Math.round(100 * Math.pow(Math.max(0, ratio), 1 / 2.35))
}
