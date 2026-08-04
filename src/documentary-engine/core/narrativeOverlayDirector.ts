import type { ApprovedPerson, NarrativeOverlaySpec, SceneChoreography } from '../types/choreography'
import { getCanonicalPlace } from '../data/canonicalPlaceRegistry'
import {
  consumeNarrativeSpec,
  isNarrativeRevealed,
  isNarrativeSpecConsumed,
  markNarrativeRevealed,
  markNarrativeSpecPlayed,
  NARRATIVE_OVERLAY_LIFECYCLE_MS,
  narrativeSpecElapsedMs,
  narrativeSpecSignature,
} from './displayRevealRegistry'
import { narrativeVisibilityOpacity } from './overlayDirector'
import { DOCUMENTARY_V24 } from './renderingPolicy'

export type NarrativeOverlayState = {
  eyebrow?: string
  title?: string
  subtitle?: string
  date?: string
  opacity: number
}

function dedupeAgainstMapLabel(text: string | undefined, mapLabelText: string | null): string | undefined {
  if (!text || !mapLabelText || !DOCUMENTARY_V24.dedupePlaceNames) return text
  const normalized = text.trim().toLowerCase()
  const mapNorm = mapLabelText.trim().toLowerCase()
  if (normalized === mapNorm) return undefined
  if (normalized.startsWith(mapNorm + ',')) return undefined
  return text
}

function applyLifecycle(
  specKey: string,
  timeMs: number,
  overlay: Omit<NarrativeOverlayState, 'opacity'>,
): NarrativeOverlayState | null {
  if (isNarrativeSpecConsumed(specKey)) return null

  markNarrativeSpecPlayed(specKey, timeMs)
  const elapsed = narrativeSpecElapsedMs(specKey, timeMs)
  const opacity = narrativeVisibilityOpacity(elapsed)

  if (elapsed >= NARRATIVE_OVERLAY_LIFECYCLE_MS) {
    consumeNarrativeSpec(specKey)
    return null
  }

  if (opacity >= 0.95) {
    markNarrativeRevealed({ ...overlay, opacity: 1 })
  }

  return { ...overlay, opacity }
}

/** Exactly one narrative overlay object — no stacked duplicate fields. */
export function resolveNarrativeOverlay(
  choreography: SceneChoreography,
  progress: number,
  mapLabelText: string | null,
  timeMs: number,
  sceneStartMs: number,
): NarrativeOverlayState | null {
  if (timeMs < sceneStartMs || progress < 0) return null

  const person = choreography.approvedPeople?.find(() => progress >= 0)

  if (person) {
    const specKey = narrativeSpecSignature(person)
    const overlay = overlayFromPerson(person, mapLabelText)
    if (!overlay) return null
    return applyLifecycle(specKey, timeMs, overlay)
  }

  const spec = choreography.narrativeOverlay
  if (!spec) return null

  const specKey = narrativeSpecSignature(spec)
  const overlay = overlayFromSpec(spec, mapLabelText)
  if (!overlay) return null
  return applyLifecycle(specKey, timeMs, overlay)
}

function overlayFromPerson(
  person: ApprovedPerson,
  mapLabelText: string | null,
): Omit<NarrativeOverlayState, 'opacity'> | null {
  const place = person.placeId ? getCanonicalPlace(person.placeId) : null
  const placeLine = place
    ? [place.canonicalName, place.region].filter(Boolean).join(', ')
    : undefined

  return {
    title: person.displayName,
    date: person.year != null ? String(person.year) : undefined,
    subtitle: dedupeAgainstMapLabel(placeLine, mapLabelText),
  }
}

function overlayFromSpec(
  spec: NarrativeOverlaySpec,
  mapLabelText: string | null,
): Omit<NarrativeOverlayState, 'opacity'> | null {
  if (DOCUMENTARY_V24.disableInsightOverlays) {
    if (spec.title) {
      return {
        title: dedupeAgainstMapLabel(spec.title, mapLabelText),
      }
    }
    if (spec.insight) {
      return {
        title: spec.insight,
      }
    }
    if (spec.subtitle) {
      return {
        title: dedupeAgainstMapLabel(spec.subtitle, mapLabelText),
      }
    }
    if (spec.date) {
      return { date: spec.date }
    }
    return null
  }

  const title = dedupeAgainstMapLabel(spec.title ?? spec.insight, mapLabelText)
  const subtitle = dedupeAgainstMapLabel(spec.subtitle, mapLabelText)
  if (!spec.eyebrow && !title && !subtitle && !spec.date) return null

  return {
    eyebrow: spec.eyebrow,
    title,
    subtitle,
    date: spec.date,
  }
}
