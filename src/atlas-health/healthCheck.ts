import { familyDatabase } from '../data/familyDatabase'
import { familyMarriages } from '../data/familyMarriages'
import { buildFamilyEvents } from '../data/buildFamilyEvents'
import { getCuratedPersonPortrait } from '../data/personPortraits'
import { dedupeFamilyEvents } from '../utils/canonicalEvent'
import { classifyEventSynthesis } from './eventProvenance'
import { buildPlaceResolutionRecord, collectUniquePlaceStrings } from './placeResolution'
import { sortPlaceFindingsBySeverity } from './placeComparison'
import type {
  AtlasHealthReport,
  PlaceComparisonCategory,
  PlaceComparisonCounts,
  PlaceHealthFinding,
} from './types'

const EMPTY_COUNTS = (): PlaceComparisonCounts => ({
  GEOGRAPHIC_CONFLICT: 0,
  RESOLUTION_GAP: 0,
  PRECISION_MISMATCH: 0,
  CONFIDENCE_MISMATCH: 0,
  AGREEMENT: 0,
})

/**
 * On-demand Atlas Health aggregation.
 * Safe for post-import / DEV debugger — do not call from pan/zoom render paths.
 */
export function runAtlasHealthCheck(): AtlasHealthReport {
  const places = collectUniquePlaceStrings({
    people: familyDatabase.people,
    marriagePlaces: familyMarriages.map((marriage) => marriage.place),
  })

  const records = places.map((place) => buildPlaceResolutionRecord(place))
  const comparisonCounts = EMPTY_COUNTS()
  for (const record of records) {
    comparisonCounts[record.comparison.category] += 1
  }

  const placeFindings: PlaceHealthFinding[] = sortPlaceFindingsBySeverity(
    records
      .filter((record) => record.comparison.category !== 'AGREEMENT')
      .map((record) => ({
        original: record.original,
        category: record.comparison.category,
        summary: record.comparison.summary,
        explorePrecision: record.comparison.explorePrecision,
        documentaryPrecision: record.comparison.documentaryPrecision,
        severity: record.comparison.severity,
      })),
  )

  const priorityPlaces = placeFindings
    .filter(
      (finding) =>
        finding.category === 'GEOGRAPHIC_CONFLICT' || finding.category === 'RESOLUTION_GAP',
    )
    .map(({ original, category, summary, explorePrecision, documentaryPrecision }) => ({
      original,
      category,
      summary,
      explorePrecision,
      documentaryPrecision,
    }))

  const events = dedupeFamilyEvents(buildFamilyEvents(familyDatabase.people))
  const byKind: Record<string, number> = {}
  let inferredMoves = 0
  let curatedServices = 0
  let curatedMarriages = 0
  for (const event of events) {
    byKind[event.kind] = (byKind[event.kind] ?? 0) + 1
    const synthesis = classifyEventSynthesis(event)
    if (synthesis.kind === 'inferred-move') inferredMoves += 1
    if (synthesis.kind === 'curated-special-service') curatedServices += 1
    if (synthesis.kind === 'curated-marriage') curatedMarriages += 1
  }

  const notes: string[] = [
    'Phase 1 observation only — legacy pipelines were not unified.',
    'Phase 2A shadow resolver runs alongside legacy; production consumers unchanged.',
    'Place comparisons are categorized by severity; AGREEMENT is not an actionable disagreement.',
    'Health aggregation is on-demand; it is not wired into Timeline pan/zoom.',
  ]

  let unifiedResolved = 0
  let unifiedCoarse = 0
  let unifiedAmbiguous = 0
  let unifiedUnresolved = 0
  let unifiedRegressions = 0
  let unifiedCorrections = 0
  for (const record of records) {
    switch (record.unified.status) {
      case 'resolved':
        unifiedResolved += 1
        break
      case 'coarse':
        unifiedCoarse += 1
        break
      case 'ambiguous':
        unifiedAmbiguous += 1
        break
      default:
        unifiedUnresolved += 1
        break
    }
    if (record.unifiedComparison.category === 'UNIFIED_REGRESSION') unifiedRegressions += 1
    if (record.unifiedComparison.category === 'UNIFIED_CORRECTS_LEGACY') unifiedCorrections += 1
  }

  return {
    generatedAt: new Date().toISOString(),
    people: familyDatabase.people.length,
    photographsCuratedHint: familyDatabase.people.filter((person) =>
      Boolean(getCuratedPersonPortrait(person.id, person.name)),
    ).length,
    places: {
      uniquePlaceStrings: places.length,
      exploreResolved: records.filter((r) => r.explore.resolved).length,
      exploreUnresolved: records.filter((r) => !r.explore.resolved).length,
      documentaryResolved: records.filter((r) => r.documentary.resolved).length,
      documentaryUnresolved: records.filter((r) => !r.documentary.resolved).length,
      comparisonCounts,
      actionableFindings: placeFindings.length,
      lowConfidenceExplore: records.filter(
        (r) => r.explore.confidence === 'LOW' || r.explore.confidence === 'MEDIUM',
      ).length,
      unifiedResolved,
      unifiedCoarse,
      unifiedAmbiguous,
      unifiedUnresolved,
      unifiedRegressions,
      unifiedCorrections,
    },
    events: {
      totalEvents: events.length,
      byKind,
      inferredMoves,
      curatedServices,
      curatedMarriages,
    },
    placeFindings,
    priorityPlaces,
    notes,
  }
}

export function isActionablePlaceComparison(category: PlaceComparisonCategory): boolean {
  return category !== 'AGREEMENT'
}
