import type { FamilyEvent } from '../types'
import type { SemanticZoomMode } from './semanticZoom'

export const SCOPE_THRESHOLDS = {
  /** Chapter span as proportion of total known timeline */
  FULL_TIMELINE: 0.8,
  BROAD_ERA: 0.35,
  LOCAL_CHAPTER: 0.1,
} as const

export type ScopeCategory = 'full_timeline' | 'broad_era' | 'local_chapter' | 'focused_period'

export type EventTypeCounts = {
  births: number
  deaths: number
  moves: number
  military: number
}

export type ChapterPresentation = {
  title: string
  yearRange: string
  summary: string | null
  hiddenCountLabel: string | null
  ctaLabel: string
}

export type ChapterPresentationInput = {
  title: string
  /** One-sentence narrative subtitle — preferred over event-count summary */
  subtitle?: string | null
  yearStart: number
  yearEnd: number
  summary: string
  hiddenCount: number
  totalCount: number
  totalTimelineStart: number
  totalTimelineEnd: number
  zoomMode: SemanticZoomMode
}

export function chapterScope(
  yearStart: number,
  yearEnd: number,
  totalStart: number,
  totalEnd: number,
): ScopeCategory {
  const totalSpan = Math.max(1, totalEnd - totalStart)
  const chapterSpan = Math.max(0, yearEnd - yearStart)
  const proportion = chapterSpan / totalSpan

  const coversStart = yearStart <= totalStart + totalSpan * 0.08
  const coversEnd = yearEnd >= totalEnd - totalSpan * 0.08

  if (
    proportion >= SCOPE_THRESHOLDS.FULL_TIMELINE ||
    (coversStart && coversEnd && proportion >= 0.72)
  ) {
    return 'full_timeline'
  }
  if (proportion >= SCOPE_THRESHOLDS.BROAD_ERA) return 'broad_era'
  if (proportion >= SCOPE_THRESHOLDS.LOCAL_CHAPTER) return 'local_chapter'
  return 'focused_period'
}

/** True only when the range is concentrated near the beginning of the dataset. */
export function isGenuinelyEarlyRange(
  yearStart: number,
  yearEnd: number,
  earliestYear: number,
  presentYear: number,
): boolean {
  const totalSpan = Math.max(1, presentYear - earliestYear)
  const earlyCutoff = earliestYear + totalSpan * 0.28
  const nearStart = yearStart <= earliestYear + Math.min(45, totalSpan * 0.08)
  return nearStart && yearEnd <= earlyCutoff
}

export function countEventTypes(events: FamilyEvent[]): EventTypeCounts {
  return {
    births: events.filter((e) => e.kind === 'birth').length,
    deaths: events.filter((e) => e.kind === 'death').length,
    moves: events.filter((e) => e.kind === 'move').length,
    military: events.filter((e) => e.kind === 'service').length,
  }
}

export function formatEventSummary(counts: EventTypeCounts, concise = false): string {
  const parts: string[] = []
  if (counts.births) parts.push(`${counts.births} birth${counts.births === 1 ? '' : 's'}`)
  if (counts.deaths) parts.push(`${counts.deaths} death${counts.deaths === 1 ? '' : 's'}`)
  if (counts.moves) parts.push(counts.moves === 1 ? '1 migration' : `${counts.moves} migrations`)
  if (counts.military) {
    parts.push(
      counts.military === 1 ? '1 military record' : `${counts.military} military records`,
    )
  }

  if (!parts.length) return 'family records'

  if (concise && parts.length > 3) {
    return parts.slice(0, 3).join(' • ')
  }

  return parts.join(' • ')
}

export function fullTimelineTitle(yearStart: number, yearEnd: number): string {
  const span = yearEnd - yearStart
  if (span >= 500) return 'Five centuries of family history'
  if (span >= 300) return 'The family across generations'
  return 'The documented family timeline'
}

export function neutralChapterTitle(yearStart: number, yearEnd: number): string {
  return `Family records, ${yearStart}–${yearEnd}`
}

function ctaForScopeAndZoom(scope: ScopeCategory, zoomMode: SemanticZoomMode): string {
  if (scope === 'full_timeline' || zoomMode === 'far') {
    return 'Explore the timeline'
  }

  if (scope === 'broad_era') {
    return zoomMode === 'medium' ? 'Explore this era' : 'Reveal key chapters'
  }

  if (scope === 'local_chapter') {
    return zoomMode === 'near' ? 'Reveal related lives' : 'Explore this chapter'
  }

  return zoomMode === 'near' ? 'View more events' : 'Reveal individual records'
}

/**
 * Detect when hidden-count line duplicates information already in the summary.
 * At far zoom every record is clustered; summary totals match hiddenCount.
 */
export function isRedundantHiddenCount(
  hiddenCount: number,
  totalCount: number,
  zoomMode: SemanticZoomMode,
  hasSummary: boolean,
): boolean {
  if (hiddenCount <= 0) return true
  if (zoomMode === 'far') return true
  if (hasSummary && hiddenCount >= totalCount) return true
  return false
}

export type CalloutLayoutTier = 'dense' | 'balanced' | 'sparse'

export type CalloutLayoutProfile = {
  tier: CalloutLayoutTier
  maxWidthPx: number
  showNarrative: boolean
  showMeta: boolean
  showCta: boolean
}

/** Balance callout size against visible timeline density. */
export function getCalloutLayoutProfile(input: {
  zoomMode: SemanticZoomMode
  totalVisibleEvents: number
  placedEventCount: number
  viewportWidth: number
}): CalloutLayoutProfile {
  const { zoomMode, totalVisibleEvents, placedEventCount, viewportWidth } = input
  const labelDensity: CalloutLayoutTier =
    placedEventCount >= 4 || (placedEventCount >= 2 && totalVisibleEvents >= 8)
      ? 'dense'
      : totalVisibleEvents <= 3 || placedEventCount <= 1
        ? 'sparse'
        : 'balanced'

  const widthCap = (ratio: number, max: number) =>
    Math.min(max, Math.max(220, viewportWidth * ratio))

  if (labelDensity === 'dense') {
    return {
      tier: 'dense',
      maxWidthPx: widthCap(0.34, 300),
      showNarrative: zoomMode === 'far' || zoomMode === 'medium',
      showMeta: false,
      showCta: zoomMode !== 'detail',
    }
  }

  if (labelDensity === 'sparse') {
    return {
      tier: 'sparse',
      maxWidthPx: widthCap(0.4, 360),
      showNarrative: zoomMode !== 'detail',
      showMeta: placedEventCount < totalVisibleEvents && zoomMode !== 'far',
      showCta: zoomMode !== 'detail',
    }
  }

  return {
    tier: 'balanced',
    maxWidthPx: widthCap(0.37, 330),
    showNarrative: zoomMode === 'far' || zoomMode === 'medium',
    showMeta: placedEventCount < totalVisibleEvents,
    showCta: zoomMode !== 'detail',
  }
}

export function getChapterPresentation(input: ChapterPresentationInput): ChapterPresentation {
  const {
    title,
    subtitle,
    yearStart,
    yearEnd,
    summary,
    hiddenCount,
    totalCount,
    totalTimelineStart,
    totalTimelineEnd,
    zoomMode,
  } = input

  const scope = chapterScope(yearStart, yearEnd, totalTimelineStart, totalTimelineEnd)
  const yearRange = yearStart === yearEnd ? String(yearStart) : `${yearStart}–${yearEnd}`

  const narrative = subtitle?.trim() || null
  let displaySummary: string | null = narrative
  if (!displaySummary && zoomMode !== 'near' && zoomMode !== 'detail') {
    displaySummary = summary || null
  }
  if (zoomMode === 'detail') {
    displaySummary = null
  }

  const redundantHidden = isRedundantHiddenCount(
    hiddenCount,
    totalCount,
    zoomMode,
    Boolean(displaySummary),
  )

  const hiddenCountLabel =
    !redundantHidden && hiddenCount > 0
      ? `+${hiddenCount} additional record${hiddenCount === 1 ? '' : 's'}`
      : null

  return {
    title,
    yearRange,
    summary: displaySummary,
    hiddenCountLabel,
    ctaLabel: ctaForScopeAndZoom(scope, zoomMode),
  }
}
