import { allCanonicalPlaces, getCanonicalPlace } from '../data/canonicalPlaceRegistry'
import type { GeographicScale, ResolvedGeoLabel, ResolvedMarker } from '../types/choreography'
import type { NarrativeOverlayState } from './narrativeOverlayDirector'
import { DOCUMENTARY_V24 } from './renderingPolicy'

/** Screen-space px — never scaled by map transform. */
export const GEO_LABEL_PX = {
  min: 11,
  max: 22,
  activeLocal: 24,
} as const

function fontSizePx(active: boolean, geographicScale: GeographicScale): number {
  if (active && geographicScale === 'local') return GEO_LABEL_PX.activeLocal
  if (geographicScale === 'continental' || geographicScale === 'world') return 13
  if (geographicScale === 'country') return 15
  if (geographicScale === 'regional') return 14
  return GEO_LABEL_PX.min
}

/**
 * Single geographic label renderer — active place only, optional parent at local scale.
 * Output positions are map viewBox coords; screen placement happens in ScreenSpaceGeoLabels.
 */
export function resolveGeographicLabel(
  markers: ResolvedMarker[],
  geographicScale: GeographicScale,
  activePlaceId?: string,
): ResolvedGeoLabel[] {
  let activeMarker =
    markers.find(
      (m) =>
        !m.preview &&
        m.lateScript &&
        (m.id === activePlaceId || m.placeId === activePlaceId),
    ) ??
    markers.find((m) => !m.preview && m.lateScript && m.active) ??
    markers.find(
      (m) => !m.preview && (m.id === activePlaceId || m.placeId === activePlaceId),
    ) ??
    markers.find((m) => m.active && !m.preview) ??
    null

  if (!activeMarker && activePlaceId) {
    activeMarker =
      markers.find(
        (m) => !m.preview && m.lateScript && m.placeId === activePlaceId,
      ) ?? null
  }

  if (!activeMarker) return []

  const place = getCanonicalPlace(activeMarker.placeId)
  if (!place) return []

  const fontSizePxValue = fontSizePx(true, geographicScale)
  let subtext: string | undefined

  if (geographicScale === 'local' && place.region) {
    subtext = [place.region, place.country].filter(Boolean).join(', ')
  } else if (geographicScale === 'regional' && place.country) {
    subtext = place.country
  }

  return [
    {
      id: activeMarker.id,
      text: place.canonicalName,
      subtext: DOCUMENTARY_V24.singleGeoLabel ? subtext : undefined,
      x: place.x,
      y: place.y,
      priority: 0,
      active: true,
      fontSizePx: fontSizePxValue,
      opacity: activeMarker.opacity,
    },
  ]
}

function normalizeLabelText(text: string): string {
  return text.trim().toLowerCase()
}

/** True when text is a canonical place name (or starts with one). */
export function isPlaceLabelText(text: string | undefined): boolean {
  if (!text?.trim()) return false
  const normalized = normalizeLabelText(text)

  for (const place of allCanonicalPlaces()) {
    const candidates = [place.canonicalName, place.locality, place.region, place.country].filter(
      Boolean,
    ) as string[]

    for (const candidate of candidates) {
      const placeNorm = normalizeLabelText(candidate)
      if (normalized === placeNorm) return true
      if (normalized.startsWith(`${placeNorm},`)) return true
      if (normalized.startsWith(`${placeNorm} `)) return true
    }
  }

  return false
}

/** Remove place-name fields from narrative overlay during the final quarter. */
export function stripPlaceLabelsFromOverlay(
  overlay: NarrativeOverlayState | null,
): NarrativeOverlayState | null {
  if (!overlay) return null

  const title = isPlaceLabelText(overlay.title) ? undefined : overlay.title
  const subtitle = isPlaceLabelText(overlay.subtitle) ? undefined : overlay.subtitle

  if (!overlay.eyebrow && !title && !subtitle && !overlay.date) return null

  return {
    ...overlay,
    title,
    subtitle,
  }
}
