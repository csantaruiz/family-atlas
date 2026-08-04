import { getCanonicalPlace } from './canonicalPlaceRegistry'
import type { DocumentaryBranch, DocumentaryCamera, MapLocation } from '../types/manifest'

export type DocumentaryPlace = {
  key: string
  label: string
  subtitle?: string
  x: number
  y: number
  resolved: boolean
  branch?: DocumentaryBranch
}

/** @deprecated Legacy map path — delegates to canonical place registry. */
export function getDocumentaryPlace(key: string): DocumentaryPlace | null {
  const place = getCanonicalPlace(key)
  if (!place || place.confidence === 'unresolved') return null

  return {
    key,
    label: place.canonicalName,
    subtitle: place.region ?? place.country,
    x: place.x,
    y: place.y,
    resolved: true,
    branch: place.branch,
  }
}

export function resolveMapLocations(
  refs: NonNullable<import('../types/manifest').MapSceneConfig['places']>,
): MapLocation[] {
  const locations: MapLocation[] = []
  for (const ref of refs) {
    const place = getDocumentaryPlace(ref.placeKey)
    if (!place) continue
    locations.push({
      id: ref.id,
      x: place.x,
      y: place.y,
      label: ref.label ?? place.label,
      subtitle: ref.subtitle ?? place.subtitle,
      delayMs: ref.delayMs,
      branch: ref.branch ?? place.branch,
      resolved: place.resolved,
    })
  }
  return locations
}

export function cameraAround(
  placeKey: string,
  opts: { scaleStart?: number; scaleEnd?: number; drift?: number } = {},
): DocumentaryCamera {
  const place = getDocumentaryPlace(placeKey)
  if (!place) return { cxStart: 50, cyStart: 50, scaleStart: 1, cxEnd: 50, cyEnd: 50, scaleEnd: 1.1 }

  const drift = opts.drift ?? 1.2
  return {
    cxStart: place.x + drift,
    cyStart: place.y + drift * 0.45,
    scaleStart: opts.scaleStart ?? 1.5,
    cxEnd: place.x,
    cyEnd: place.y,
    scaleEnd: opts.scaleEnd ?? 2.1,
  }
}

export function cameraBetween(
  fromKey: string,
  toKey: string,
  opts: { scaleStart?: number; scaleEnd?: number } = {},
): DocumentaryCamera {
  const from = getDocumentaryPlace(fromKey)
  const to = getDocumentaryPlace(toKey)
  if (!from || !to) return { cxStart: 50, cyStart: 50, scaleStart: 1, cxEnd: 50, cyEnd: 50, scaleEnd: 1.05 }

  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2
  const span = Math.hypot(to.x - from.x, to.y - from.y)
  const scale = opts.scaleStart ?? Math.max(1, Math.min(1.35, 1.08 + span * 0.012))

  return {
    cxStart: from.x,
    cyStart: from.y,
    scaleStart: scale + 0.08,
    cxEnd: midX,
    cyEnd: midY,
    scaleEnd: opts.scaleEnd ?? scale,
  }
}

export function cameraOverview(opts: Partial<DocumentaryCamera> = {}): DocumentaryCamera {
  return {
    cxStart: 50,
    cyStart: 50,
    scaleStart: 1,
    cxEnd: 48,
    cyEnd: 49,
    scaleEnd: 1.08,
    ...opts,
  }
}
