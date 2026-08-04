import type { NarrativeOverlayState } from './narrativeOverlayDirector'
import type { ApprovedPerson, NarrativeOverlaySpec, RouteEvidence } from '../types/choreography'
import { NARRATIVE_OVERLAY_LIFECYCLE_MS } from '../data/playbackConfig'

const revealedNarrative = new Set<string>()
const revealedGeoLabels = new Set<string>()
const revealedManifestRoutes = new Map<string, number>()
const revealedGedcomRouteAtMs = new Map<string, number>()
const playedNarrativeSpecAtMs = new Map<string, number>()
const consumedNarrativeSpecs = new Set<string>()

export function routeRevealKey(fromId: string, toId: string, evidence: RouteEvidence): string {
  return `${fromId}->${toId}:${evidence}`
}

export function isManifestRouteRevealed(key: string, timeMs: number): boolean {
  const revealedAt = revealedManifestRoutes.get(key)
  return revealedAt != null && timeMs >= revealedAt
}

export function markManifestRouteRevealed(key: string, timeMs: number): void {
  if (!revealedManifestRoutes.has(key)) {
    revealedManifestRoutes.set(key, timeMs)
  }
}

export function isGedcomRouteRevealed(routeId: string, timeMs: number): boolean {
  const revealedAt = revealedGedcomRouteAtMs.get(routeId)
  return revealedAt != null && timeMs >= revealedAt
}

export function markGedcomRouteRevealed(routeId: string, timeMs: number): void {
  if (!revealedGedcomRouteAtMs.has(routeId)) {
    revealedGedcomRouteAtMs.set(routeId, timeMs)
  }
}

export function getRevealedGedcomRouteIds(timeMs: number): string[] {
  return [...revealedGedcomRouteAtMs.entries()]
    .filter(([_, revealedAt]) => timeMs >= revealedAt)
    .map(([routeId]) => routeId)
}

export function narrativeOverlaySignature(overlay: NarrativeOverlayState): string {
  return [overlay.eyebrow, overlay.title, overlay.subtitle, overlay.date]
    .filter(Boolean)
    .join('\u0001')
}

export function narrativeSpecSignature(
  spec: NarrativeOverlaySpec | Pick<ApprovedPerson, 'displayName' | 'start' | 'end'>,
): string {
  if ('displayName' in spec && !('insight' in spec)) {
    return `person:${spec.displayName}`
  }
  const overlaySpec = spec as NarrativeOverlaySpec
  return [overlaySpec.title, overlaySpec.insight, overlaySpec.subtitle, overlaySpec.date]
    .filter(Boolean)
    .join('\u0001')
}

export function isNarrativeSpecConsumed(specKey: string): boolean {
  return consumedNarrativeSpecs.has(specKey)
}

export function markNarrativeSpecPlayed(specKey: string, timeMs: number): void {
  if (!playedNarrativeSpecAtMs.has(specKey)) {
    playedNarrativeSpecAtMs.set(specKey, timeMs)
  }
}

export function narrativeSpecElapsedMs(specKey: string, timeMs: number): number {
  const startedAt = playedNarrativeSpecAtMs.get(specKey)
  if (startedAt == null) return 0
  return Math.max(0, timeMs - startedAt)
}

export function consumeNarrativeSpec(specKey: string): void {
  consumedNarrativeSpecs.add(specKey)
}

/** End any in-flight narrative lines when the scene changes. */
export function consumeAllPendingNarrativeSpecs(): void {
  for (const key of playedNarrativeSpecAtMs.keys()) {
    consumedNarrativeSpecs.add(key)
  }
}

export function isNarrativeRevealed(overlay: NarrativeOverlayState): boolean {
  return revealedNarrative.has(narrativeOverlaySignature(overlay))
}

export function markNarrativeRevealed(overlay: NarrativeOverlayState): void {
  revealedNarrative.add(narrativeOverlaySignature(overlay))
}

export function isGeoLabelRevealed(text: string): boolean {
  return revealedGeoLabels.has(text)
}

export function markGeoLabelRevealed(text: string): void {
  revealedGeoLabels.add(text)
}

/** Reset at documentary start — not on seek, so text never re-fades once shown. */
export function resetDisplayRevealRegistry(): void {
  revealedNarrative.clear()
  revealedGeoLabels.clear()
  revealedManifestRoutes.clear()
  revealedGedcomRouteAtMs.clear()
  playedNarrativeSpecAtMs.clear()
  consumedNarrativeSpecs.clear()
}

/** @internal test helper */
export function clearDisplayRevealRegistryForTests(): void {
  resetDisplayRevealRegistry()
}

export { NARRATIVE_OVERLAY_LIFECYCLE_MS }
