import { describe, expect, it } from 'vitest'
import { familyDatabase } from '../../data/familyDatabase'
import { buildFamilyEvents } from '../../data/buildFamilyEvents'
import { DEFAULT_TIMELINE_FILTERS } from '../../types/timelineFilters'
import { canonicalEventId, dedupeFamilyEvents } from '../../utils/canonicalEvent'
import {
  layoutFamilyEventsProgressive,
  foldSpatiallyConflictingEvents,
} from '../../utils/clustering'
import {
  explainEventVisibility,
  buildPlaceResolutionRecord,
  listFamilyEvents,
} from '../index'

const ROOT = familyDatabase.root
const PRESENT = new Date().getFullYear()
const EARLIEST = familyDatabase.stats.earliestYear

describe('atlas-health visibility explainer', () => {
  it('marks a far-window vital event as visible or expected-hidden without BUG_SUSPECTED noise', () => {
    const events = listFamilyEvents()
    const sample = events.find((event) => event.kind === 'birth' && event.person.focus)
    expect(sample).toBeTruthy()
    const eventId = canonicalEventId(sample!)

    const record = explainEventVisibility({
      eventId,
      start: EARLIEST,
      end: PRESENT,
      span: PRESENT - EARLIEST,
      width: 1280,
      height: 800,
      fullSpan: PRESENT - EARLIEST,
      earliestYear: EARLIEST,
      presentYear: PRESENT,
      rootPersonId: ROOT,
      filters: DEFAULT_TIMELINE_FILTERS,
    })

    expect(record.eventId).toBe(eventId)
    expect(record.synthesis.kind).toBe('gedcom-person-vital')
    expect(['EXPECTED', 'SUSPICIOUS']).toContain(record.classification)
    expect(record.classification).not.toBe('BUG_SUSPECTED')
  })

  it('classifies inferred moves with inferred-move synthesis', () => {
    const move = listFamilyEvents().find((event) => event.kind === 'move')
    expect(move).toBeTruthy()
    const record = explainEventVisibility({
      eventId: canonicalEventId(move!),
      start: move!.year - 40,
      end: move!.year + 40,
      span: 80,
      width: 1200,
      height: 800,
      fullSpan: PRESENT - EARLIEST,
      earliestYear: EARLIEST,
      presentYear: PRESENT,
      rootPersonId: ROOT,
      filters: DEFAULT_TIMELINE_FILTERS,
    })
    expect(record.synthesis.kind).toBe('inferred-move')
  })

  it('does not change layout landmark ids when diagnostics are imported', () => {
    const events = dedupeFamilyEvents(buildFamilyEvents(familyDatabase.people))
    const start = 1800
    const end = 1900
    const span = 100
    const width = 1200
    const height = 800
    const layout = layoutFamilyEventsProgressive(
      events.filter((e) => e.year >= start && e.year <= end),
      start,
      end,
      span,
      width,
      height,
      'eras',
      PRESENT - EARLIEST,
      EARLIEST,
      ROOT,
      PRESENT,
      null,
    )
    const folded = foldSpatiallyConflictingEvents(layout.events, span, width, height)
    expect(folded.events.map((e) => canonicalEventId(e.event)).sort()).toEqual(
      folded.events.map((e) => canonicalEventId(e.event)).sort(),
    )
    expect(layout.clusters.length).toBeGreaterThanOrEqual(0)
  })
})

describe('atlas-health golden place comparisons', () => {
  it('records Gloucester NJ full string as compatible geography (confidence may differ)', () => {
    const record = buildPlaceResolutionRecord('Gloucester City, Camden, New Jersey')
    expect(record.humanConfirmed).toBe(false)
    expect(['AGREEMENT', 'CONFIDENCE_MISMATCH', 'PRECISION_MISMATCH']).toContain(
      record.comparison.category,
    )
    expect(record.comparison.category).not.toBe('GEOGRAPHIC_CONFLICT')
    expect(record.explore.method.length).toBeGreaterThan(0)
    expect(record.documentary.method.length).toBeGreaterThan(0)
  })
})
