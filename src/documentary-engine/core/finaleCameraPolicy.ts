import type { MapCamera } from '../../utils/mapSemanticZoom'
import { interpolateCamera } from './cameraFraming'
import { FINALE_WORLD_CAMERA } from './finaleHighlightDirector'

/** Convergence chapter — begin the full-circle atlas pull-back. */
export const CLOSING_STAGE_START_MS = 210_000

/** Finish zoom-out before the atlas timeline so the wide view can carry the arc. */
export const CLOSING_ZOOM_COMPLETE_MS = 252_000

/** @deprecated Use CLOSING_STAGE_START_MS — kept for tests comparing legacy ratio. */
export const FINALE_START_RATIO = 2 / 3

/** Final act — suppress geographic place labels; dots remain. */
export const FINAL_QUARTER_RATIO = 0.75

export function finalQuarterStartMs(durationMs: number): number {
  if (durationMs <= 0) return Number.POSITIVE_INFINITY
  return Math.floor(durationMs * FINAL_QUARTER_RATIO)
}

export function isFinalDocumentaryQuarter(timeMs: number, durationMs: number): boolean {
  if (durationMs <= 0) return false
  return timeMs >= finalQuarterStartMs(durationMs)
}

let cachedFinaleEntry: {
  durationMs: number
  startMs: number
  camera: MapCamera
} | null = null

function easeOutQuad(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return 1 - (1 - clamped) * (1 - clamped)
}

function closingStartMs(_durationMs: number): number {
  return CLOSING_STAGE_START_MS
}

function closingZoomEndMs(durationMs: number): number {
  return Math.min(CLOSING_ZOOM_COMPLETE_MS, durationMs)
}

export function finaleProgress(timeMs: number, durationMs: number): number | null {
  if (durationMs <= 0) return null
  const startMs = closingStartMs(durationMs)
  if (timeMs < startMs) return null
  const endMs = closingZoomEndMs(durationMs)
  const span = Math.max(1, endMs - startMs)
  return Math.min(1, (timeMs - startMs) / span)
}

export function isFinaleThird(timeMs: number, durationMs: number): boolean {
  return finaleProgress(timeMs, durationMs) !== null
}

/** Snapshot the camera at the finale boundary — used as the zoom-out origin. */
export function resolveFinaleEntryCamera(
  cameraAtBoundary: MapCamera,
  durationMs: number,
  timeMs: number,
): MapCamera {
  const startMs = closingStartMs(durationMs)
  if (
    cachedFinaleEntry?.durationMs === durationMs &&
    cachedFinaleEntry.startMs === startMs
  ) {
    return cachedFinaleEntry.camera
  }

  if (timeMs <= startMs + 120) {
    cachedFinaleEntry = { durationMs, startMs, camera: cameraAtBoundary }
    return cameraAtBoundary
  }

  return cachedFinaleEntry?.camera ?? cameraAtBoundary
}

/** Single continuous zoom-out with minimal pan — no east–west staging. */
export function applyFinaleCameraPolicy(
  camera: MapCamera,
  timeMs: number,
  durationMs: number,
): MapCamera {
  const progress = finaleProgress(timeMs, durationMs)
  if (progress === null) return camera

  const entry = resolveFinaleEntryCamera(camera, durationMs, timeMs)
  return interpolateCamera(entry, FINALE_WORLD_CAMERA, easeOutQuad(progress))
}

/** Damp scripted panning as we approach the closing atlas pull-back. */
export function finalePanDamping(timeMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1
  const start = CLOSING_STAGE_START_MS - 18_000
  const end = closingStartMs(durationMs)
  if (timeMs <= start) return 1
  if (timeMs >= end) return 0.12
  const t = (timeMs - start) / (end - start)
  return 1 - t * 0.88
}

export function dampCameraPan(from: MapCamera, to: MapCamera, damping: number): MapCamera {
  const keep = Math.min(1, Math.max(0, damping))
  return {
    cx: from.cx + (to.cx - from.cx) * keep,
    cy: from.cy + (to.cy - from.cy) * keep,
    scale: to.scale,
  }
}

/** @internal */
export function clearFinaleCameraCache(): void {
  cachedFinaleEntry = null
}
