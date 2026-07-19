import { PLOT_EDGE, yearX } from './timelineMath'

type MountainPathInput = {
  start: number
  end: number
  span: number
  width: number
  axisY: number
  maxHeight: number
}

function xToYear(x: number, start: number, span: number, width: number): number {
  const usable = Math.max(1, width - PLOT_EDGE * 2)
  return start + ((x - PLOT_EDGE) / usable) * span
}

function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + n * n * 0.00037) * 43758.5453123
  return s - Math.floor(s)
}

/** Sharpen sine crests into craggy silhouettes without changing peak height much. */
function ridged(value: number, sharpness = 0.86): number {
  return Math.pow(Math.abs(Math.sin(value)), sharpness)
}

/** Deterministic elevation in 0–1 range, keyed to calendar year so panning stays stable. */
export function mountainElevationAtYear(year: number): number {
  const t = year

  // Slow distant mass — sets which eras read taller, not the wavy look.
  const mass =
    0.58 +
    0.11 * Math.sin(t * 0.011 + 0.75) +
    0.07 * Math.sin(t * 0.017 + 2.35)

  // Higher-frequency ridgeline with incommensurate periods for irregular spacing.
  const peaks =
    0.27 * ridged(t * 0.048 + 0.4, 0.8) +
    0.21 * ridged(t * 0.071 + 1.85, 0.84) +
    0.17 * ridged(t * 0.096 + 3.15, 0.88) +
    0.13 * ridged(t * 0.124 + 0.2, 0.82)

  // Broken micro-detail and hash jitter so crests are not evenly rhythmic.
  const shard =
    0.08 * Math.sin(t * 0.183 + 1.15) +
    0.06 * Math.sin(t * 0.221 + 4.4) +
    0.05 * (hash01(t * 1.73) - 0.5) +
    0.04 * (hash01(t * 3.19 + 11.7) - 0.5)

  const raw = mass * (0.33 + peaks + shard)
  return Math.min(1, Math.max(0.14, raw))
}

export function buildMountainSilhouettePath({
  start,
  end,
  span,
  width,
  axisY,
  maxHeight,
}: MountainPathInput): string {
  if (width <= 0 || maxHeight <= 0) return ''

  const padYears = span * 0.06
  const sampleStart = start - padYears
  const sampleEnd = end + padYears
  const left = yearX(sampleStart, start, span, width)
  const right = yearX(sampleEnd, start, span, width)
  const stepPx = Math.max(4, Math.min(7, width / 220))

  const ridge: string[] = []
  for (let x = left; x <= right; x += stepPx) {
    const year = xToYear(x, start, span, width)
    const elevation = mountainElevationAtYear(year)
    const y = axisY - elevation * maxHeight
    ridge.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }

  const lastX = right.toFixed(1)
  return `M ${left.toFixed(1)},${axisY.toFixed(1)} L ${ridge.join(' L ')} L ${lastX},${axisY.toFixed(1)} Z`
}

export function mountainSilhouetteMaxHeight(viewportHeight: number): number {
  return Math.round(Math.min(52, Math.max(28, viewportHeight * 0.055)))
}
