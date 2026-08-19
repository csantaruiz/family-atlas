import { buildFamilyEvents } from '../data/buildFamilyEvents'
import { familyDatabase } from '../data/familyDatabase'
import type { FamilyEvent } from '../types'
import type { TimelineFilters } from '../types/timelineFilters'
import { DEFAULT_TIMELINE_FILTERS } from '../types/timelineFilters'
import { canonicalEventId, dedupeFamilyEvents } from '../utils/canonicalEvent'
import {
  eventImportanceScore,
  foldSpatiallyConflictingEvents,
  layoutBirthClustersProgressive,
  layoutFamilyEventsProgressive,
  showBirthPeriodClusters,
  type PlacedFamilyEvent,
} from '../utils/clustering'
import { buildStoryChaptersForViewport } from '../data/buildStoryChapters'
import {
  admitPersistentMarkers,
  maxFamilyEventsForSpan,
  staggerFamilyEventLanes,
} from '../utils/landmarkSelection'
import { buildLineagePalette } from '../utils/lineageColors'
import { semanticZoomMode } from '../utils/semanticZoom'
import { applyFamilyEventFilters } from '../utils/timelineFilters'
import { yearX } from '../utils/timelineMath'
import { classifyEventSynthesis, eventPlaceRaw } from './eventProvenance'
import { buildPlaceResolutionRecord } from './placeResolution'
import type {
  EventLifecycleRecord,
  ExplainVisibilityInput,
  VisibilityClassification,
  VisibilityHiddenReason,
} from './types'

function allEvents(): FamilyEvent[] {
  return dedupeFamilyEvents(buildFamilyEvents(familyDatabase.people))
}

function findEvent(eventId: string, pool: FamilyEvent[]): FamilyEvent | null {
  return pool.find((event) => canonicalEventId(event) === eventId) ?? null
}

function classifyOutcome(input: {
  hiddenReason: VisibilityHiddenReason
  finallyVisible: boolean
  synthesisKind: string
  placeSuspicious: boolean
}): { classification: VisibilityClassification; summary: string } {
  if (input.finallyVisible) {
    return {
      classification: 'EXPECTED',
      summary: 'Event is eligible to render as an individual timeline marker in this viewport.',
    }
  }

  switch (input.hiddenReason) {
    case 'filtered_kind_or_branch':
      return {
        classification: 'EXPECTED',
        summary: 'Hidden by timeline kind/branch filters.',
      }
    case 'outside_viewport':
      return {
        classification: 'EXPECTED',
        summary: 'Event year is outside the current timeline window.',
      }
    case 'chapter_residual_cluster':
      return {
        classification: 'EXPECTED',
        summary: 'Event exists but is represented inside a chapter residual cluster (plaque count).',
      }
    case 'conflict_folded':
      return {
        classification: 'EXPECTED',
        summary: 'Event was folded into a spatial conflict cluster badge at this zoom.',
      }
    case 'landmark_budget_or_diversity':
      return {
        classification: 'EXPECTED',
        summary:
          'Event lost landmark selection / diversity competition at this semantic zoom density.',
      }
    case 'persistent_marker_cap':
      return {
        classification: 'EXPECTED',
        summary: 'Selected but dropped by the persistent-marker / span event cap.',
      }
    case 'birth_period_cluster_mode':
      return {
        classification: 'EXPECTED',
        summary: 'Far zoom birth-period cluster mode is active; individuals may be residual.',
      }
    case 'deduped_away':
      return {
        classification: 'EXPECTED',
        summary: 'A richer duplicate with the same canonical id won deduplication.',
      }
    case 'not_in_event_set':
      return {
        classification: 'SUSPICIOUS',
        summary: 'No FamilyEvent with this id exists after buildFamilyEvents + dedupe.',
      }
    case 'unknown':
      return {
        classification: 'BUG_SUSPECTED',
        summary:
          'Event appears eligible through known layout stages but final visibility is false — investigate rendering.',
      }
    default:
      break
  }

  if (input.placeSuspicious) {
    return {
      classification: 'SUSPICIOUS',
      summary: 'Hidden or ambiguous with a place pipeline disagreement / low-confidence resolution.',
    }
  }

  if (input.synthesisKind === 'inferred-move') {
    return {
      classification: 'SUSPICIOUS',
      summary: 'Inferred migration — verify whether disappearance is product behavior or bad inference.',
    }
  }

  return {
    classification: 'EXPECTED',
    summary: 'Not individually visible under current viewport rules.',
  }
}

/**
 * On-demand visibility explainer — mirrors FamilyLayer layout stages offline.
 * Must not be called from pan/zoom hot paths.
 */
export function explainEventVisibility(input: ExplainVisibilityInput): EventLifecycleRecord {
  const {
    eventId,
    start,
    end,
    span,
    width,
    height,
    fullSpan,
    earliestYear,
    presentYear,
    rootPersonId,
    filters,
  } = input

  const rawBuilt = buildFamilyEvents(familyDatabase.people)
  const beforeDedupe = rawBuilt.find((event) => canonicalEventId(event) === eventId) ?? null
  const events = dedupeFamilyEvents(rawBuilt)
  const event = findEvent(eventId, events)

  const lineagePalette = buildLineagePalette(familyDatabase.people, familyDatabase.root)
  const peopleIdMap = new Map(familyDatabase.people.map((person) => [person.id, person]))

  if (!event) {
    const ghost = beforeDedupe
    return {
      eventId,
      personId: ghost?.person.id ?? 'unknown',
      personName: ghost?.person.name ?? 'unknown',
      kind: ghost?.kind ?? 'unknown',
      year: ghost?.year ?? 0,
      title: ghost?.title ?? '',
      detail: ghost?.detail ?? '',
      placeRaw: ghost ? eventPlaceRaw(ghost) : null,
      synthesis: ghost
        ? classifyEventSynthesis(ghost)
        : { kind: 'unknown', notes: ['Event id not found in built set.'] },
      importanceBase: ghost?.importance ?? 0,
      importanceLayoutScore: null,
      filterPassed: false,
      filterNotes: ghost
        ? ['Lost during dedupeFamilyEvents (richer duplicate kept).']
        : ['Not present after buildFamilyEvents.'],
      withinViewport: false,
      semanticZoomMode: null,
      birthPeriodClusterMode: false,
      selectedAsLandmark: false,
      placedInLayout: false,
      admittedAfterCap: false,
      conflictFolded: false,
      conflictClusterId: null,
      chapterClusterId: null,
      chapterHiddenCount: null,
      finallyVisible: false,
      hiddenReason: ghost ? 'deduped_away' : 'not_in_event_set',
      classification: ghost ? 'EXPECTED' : 'SUSPICIOUS',
      summary: ghost
        ? 'Event was consolidated with a richer duplicate.'
        : 'Event does not exist in the synthesized FamilyEvent set.',
      placeResolution: null,
    }
  }

  const synthesis = classifyEventSynthesis(event)
  const placeRaw = eventPlaceRaw(event)
  const placeResolution = placeRaw ? buildPlaceResolutionRecord(placeRaw) : null
  const placeSuspicious =
    placeResolution?.comparison.category === 'GEOGRAPHIC_CONFLICT' ||
    placeResolution?.comparison.category === 'RESOLUTION_GAP' ||
    placeResolution?.comparison.category === 'PRECISION_MISMATCH' ||
    placeResolution?.explore.confidence === 'LOW' ||
    placeResolution?.explore.confidence === 'UNRESOLVED'

  const filtered = applyFamilyEventFilters(events, filters, lineagePalette, peopleIdMap)
  const filterPassed = filtered.some((item) => canonicalEventId(item) === eventId)
  const filterNotes = filterPassed
    ? ['Passes kind and branch filters.']
    : ['Removed by applyFamilyEventFilters (kind and/or branch).']

  const withinViewport = event.year >= start && event.year <= end
  const birthPeriodClusterMode = showBirthPeriodClusters(span) && filters.births
  const zoomMode = semanticZoomMode(span, fullSpan)

  const chapters = buildStoryChaptersForViewport(
    filtered.filter((item) => item.year >= start && item.year <= end),
    start,
    end,
    span,
    earliestYear,
    presentYear,
    8,
    fullSpan,
  )
  const importanceLayoutScore = eventImportanceScore(event, chapters, earliestYear, rootPersonId)

  let selectedAsLandmark = false
  let placedInLayout = false
  let admittedAfterCap = false
  let conflictFolded = false
  let conflictClusterId: string | null = null
  let chapterClusterId: string | null = null
  let chapterHiddenCount: number | null = null
  let finallyVisible = false
  let hiddenReason: VisibilityHiddenReason = 'unknown'

  if (!filterPassed) {
    hiddenReason = 'filtered_kind_or_branch'
  } else if (!withinViewport) {
    hiddenReason = 'outside_viewport'
  } else {
    const viewportEvents = filtered.filter((item) => item.year >= start && item.year <= end)
    const layout = birthPeriodClusterMode
      ? layoutBirthClustersProgressive(
          [],
          viewportEvents,
          start,
          end,
          span,
          width,
          height,
          fullSpan,
          earliestYear,
          rootPersonId,
          presentYear,
          null,
        )
      : layoutFamilyEventsProgressive(
          viewportEvents,
          start,
          end,
          span,
          width,
          height,
          'eras',
          fullSpan,
          earliestYear,
          rootPersonId,
          presentYear,
          null,
        )

    const layoutIds = new Set(layout.events.map((entry) => canonicalEventId(entry.event)))
    placedInLayout = layoutIds.has(eventId)
    selectedAsLandmark = placedInLayout

    for (const cluster of layout.clusters) {
      // Chapter residual: event in chapter year range and not placed
      if (event.year >= cluster.from && event.year <= cluster.to && !placedInLayout) {
        chapterClusterId = cluster.chapterId
        chapterHiddenCount = cluster.hiddenCount
      }
    }

    const candidates: PlacedFamilyEvent[] = layout.events.map((entry) => ({
      ...entry,
      x: yearX(entry.event.year, start, span, width),
    }))

    const limit = maxFamilyEventsForSpan(span, width)
    const admitted = admitPersistentMarkers(
      candidates,
      [],
      (entry) => canonicalEventId(entry.event),
      (entry) =>
        (entry.event.importance ?? 0) * 12 +
        (entry.event.kind === 'move' || entry.event.kind === 'service'
          ? 40
          : entry.event.kind === 'marriage'
            ? 36
            : entry.event.kind === 'birth'
              ? 20
              : entry.event.kind === 'death'
                ? 10
                : 0) +
        (entry.event.person.focus ? 30 : 0),
      limit,
    )
    admittedAfterCap = admitted.some((entry) => canonicalEventId(entry.event) === eventId)

    const staggered = staggerFamilyEventLanes(admitted, height, span, width, new Set())
    const folded = foldSpatiallyConflictingEvents(staggered, span, width, height)
    finallyVisible = folded.events.some((entry) => canonicalEventId(entry.event) === eventId)

    for (const cluster of folded.clusters) {
      if (cluster.events.some((item) => canonicalEventId(item) === eventId)) {
        conflictFolded = true
        conflictClusterId = cluster.id
      }
    }

    if (finallyVisible) {
      hiddenReason = 'visible'
    } else if (conflictFolded) {
      hiddenReason = 'conflict_folded'
    } else if (placedInLayout && !admittedAfterCap) {
      hiddenReason = 'persistent_marker_cap'
    } else if (chapterClusterId && chapterHiddenCount && chapterHiddenCount > 0) {
      hiddenReason = 'chapter_residual_cluster'
    } else if (birthPeriodClusterMode && !placedInLayout) {
      hiddenReason = 'birth_period_cluster_mode'
    } else if (!placedInLayout) {
      hiddenReason = 'landmark_budget_or_diversity'
    } else {
      hiddenReason = 'unknown'
    }
  }

  const outcome = classifyOutcome({
    hiddenReason,
    finallyVisible,
    synthesisKind: synthesis.kind,
    placeSuspicious: Boolean(placeSuspicious),
  })

  // Upgrade classification when place disagreement accompanies an otherwise expected hide
  let classification = outcome.classification
  let summary = outcome.summary
  if (
    !finallyVisible &&
    placeSuspicious &&
    classification === 'EXPECTED' &&
    (hiddenReason === 'landmark_budget_or_diversity' || hiddenReason === 'chapter_residual_cluster')
  ) {
    classification = 'SUSPICIOUS'
    summary = `${outcome.summary} Place resolution is also uncertain or pipelines disagree.`
  }

  return {
    eventId,
    personId: event.person.id,
    personName: event.person.name,
    kind: event.kind,
    year: event.year,
    title: event.title,
    detail: event.detail,
    placeRaw,
    synthesis,
    importanceBase: event.importance,
    importanceLayoutScore,
    filterPassed,
    filterNotes,
    withinViewport,
    semanticZoomMode: zoomMode,
    birthPeriodClusterMode,
    selectedAsLandmark,
    placedInLayout,
    admittedAfterCap,
    conflictFolded,
    conflictClusterId,
    chapterClusterId,
    chapterHiddenCount,
    finallyVisible,
    hiddenReason,
    classification,
    summary,
    placeResolution,
  }
}

/** Convenience: explain using default filters and a provided viewport. */
export function explainEventVisibilityWithDefaults(
  eventId: string,
  viewport: Omit<ExplainVisibilityInput, 'eventId' | 'filters'> & {
    filters?: TimelineFilters
  },
): EventLifecycleRecord {
  return explainEventVisibility({
    eventId,
    ...viewport,
    filters: viewport.filters ?? DEFAULT_TIMELINE_FILTERS,
  })
}

export function listFamilyEvents(): FamilyEvent[] {
  return allEvents()
}

export function listCanonicalEventIds(): string[] {
  return allEvents().map((event) => canonicalEventId(event))
}

export function findEventsForPerson(personId: string): FamilyEvent[] {
  return allEvents().filter((event) => event.person.id === personId || event.spouse?.id === personId)
}
