import { describe, expect, it } from 'vitest'
import {
  buildPlaceResolutionRecord,
  COMPARISON_SEVERITY,
  inferExplorePrecision,
  inferDocumentaryPrecision,
  runAtlasHealthCheck,
} from '../index'
import { diagnoseExplorePlace, resolvePlaceCoordinate } from '../../data/placeCoordinates'
import {
  diagnoseGedcomPlaceResolution,
  resolveGedcomPlaceToCanonicalId,
} from '../../documentary-engine/core/gedcomMigrationDirector'
import { familyDatabase } from '../../data/familyDatabase'
import { familyMarriages } from '../../data/familyMarriages'
import { collectUniquePlaceStrings } from '../placeResolution'

describe('atlas-health place parity', () => {
  const places = collectUniquePlaceStrings({
    people: familyDatabase.people,
    marriagePlaces: familyMarriages.map((m) => m.place),
  })

  it('diagnoseExplorePlace matches resolvePlaceCoordinate for every atlas place string', () => {
    for (const place of places) {
      const legacy = resolvePlaceCoordinate(place)
      const diagnosed = diagnoseExplorePlace(place).coordinate
      expect(diagnosed).toEqual(legacy)
    }
  })

  it('diagnoseGedcomPlaceResolution matches resolveGedcomPlaceToCanonicalId', () => {
    for (const place of places) {
      expect(diagnoseGedcomPlaceResolution(place).canonicalId).toBe(
        resolveGedcomPlaceToCanonicalId(place),
      )
    }
  })

  it('buildPlaceResolutionRecord preserves verbatim original strings', () => {
    const malformed = ' , , , England'
    const record = buildPlaceResolutionRecord(malformed)
    expect(record.original).toBe(malformed)
    expect(record.humanConfirmed).toBe(false)
  })
})

describe('atlas-health place comparison categories', () => {
  it('classifies El Paso as confidence-only mismatch (compatible geography)', () => {
    const record = buildPlaceResolutionRecord('El Paso, Texas, USA')
    expect(record.comparison.category).toBe('CONFIDENCE_MISMATCH')
    expect(record.explore.precision).toBe('exact/city')
    expect(record.documentary.precision).toBe('exact/city')
  })

  it('classifies Gloucester City full string as confidence-only mismatch', () => {
    const record = buildPlaceResolutionRecord('Gloucester City, Camden, New Jersey')
    expect(record.comparison.category).toBe('CONFIDENCE_MISMATCH')
  })

  it('classifies short Gloucester NJ variant as GEOGRAPHIC_CONFLICT when explore hits England', () => {
    const record = buildPlaceResolutionRecord('Gloucester, New Jersey, USA')
    if (record.explore.label?.toLowerCase().includes('britain')) {
      expect(record.comparison.category).toBe('GEOGRAPHIC_CONFLICT')
      expect(record.comparison.severity).toBe(COMPARISON_SEVERITY.GEOGRAPHIC_CONFLICT)
    }
  })

  it('exposes precision on both pipelines', () => {
    const record = buildPlaceResolutionRecord('Gloucester City, Camden, New Jersey')
    expect(record.explore.precision).toBeTruthy()
    expect(record.documentary.precision).toBeTruthy()
    expect(inferExplorePrecision(record.explore, record.original)).toBe(record.explore.precision)
    expect(inferDocumentaryPrecision(record.documentary)).toBe(record.documentary.precision)
  })
})

describe('atlas-health aggregation', () => {
  it('runAtlasHealthCheck summarizes by comparison category', () => {
    const report = runAtlasHealthCheck()
    expect(report.people).toBe(familyDatabase.people.length)
    expect(report.places.uniquePlaceStrings).toBeGreaterThan(0)
    expect(report.events.totalEvents).toBeGreaterThan(0)
    expect(report.places.comparisonCounts.AGREEMENT).toBeGreaterThan(0)
    const sum = Object.values(report.places.comparisonCounts).reduce((a, b) => a + b, 0)
    expect(sum).toBe(report.places.uniquePlaceStrings)
    expect(report.places.actionableFindings).toBe(
      report.places.uniquePlaceStrings - report.places.comparisonCounts.AGREEMENT,
    )
    expect(Array.isArray(report.placeFindings)).toBe(true)
    if (report.placeFindings.length > 1) {
      expect(report.placeFindings[0].severity).toBeLessThanOrEqual(report.placeFindings[1].severity)
    }
    expect(report.notes.length).toBeGreaterThan(0)
  })
})
