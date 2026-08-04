import { describe, expect, it, beforeEach } from 'vitest'
import { familyDatabase } from '../data/familyDatabase'
import { buildFamilyEvents } from '../data/buildFamilyEvents'
import { buildStoryChaptersForViewport } from '../data/buildStoryChapters'
import { layoutFamilyEventsProgressive, eventImportanceScore } from './clustering'
import { selectDistributedLandmarks, placeHybridLandmarks } from './landmarkSelection'
import { resetLandmarkStability } from './landmarkSelectionStability'
import { generationProximityScore } from './familyPriority'

describe('near-generation family prioritization', () => {
  beforeEach(() => {
    resetLandmarkStability()
  })

  const motherId = 'I18123023741'
  const fatherId = 'I18123023681'
  const rootId = familyDatabase.root

  it('scores parents above distant modern events', () => {
    const chapters: never[] = []
    const earliest = familyDatabase.stats.earliestYear
    const motherBirth = buildFamilyEvents(familyDatabase.people).find(
      (e) => e.kind === 'birth' && e.person.id === motherId,
    )
    const distant = buildFamilyEvents(familyDatabase.people).find(
      (e) => e.kind === 'death' && e.year === 1922 && e.person.name.includes('Hinojos'),
    )
    expect(motherBirth).toBeTruthy()
    expect(distant).toBeTruthy()
    const motherScore = eventImportanceScore(motherBirth!, chapters, earliest, rootId)
    const distantScore = eventImportanceScore(distant!, chapters, earliest, rootId)
    expect(generationProximityScore(motherBirth!.person)).toBeGreaterThan(
      generationProximityScore(distant!.person),
    )
    expect(motherScore).toBeGreaterThan(distantScore)
  })

  it('keeps Tamara Hendry 1949 birth visible in a roomy mid-century viewport', () => {
    const width = 1400
    const height = 700
    const start = 1914
    const end = 1980
    const span = end - start
    const fullSpan = familyDatabase.stats.latestYear - familyDatabase.stats.earliestYear
    const events = buildFamilyEvents(familyDatabase.people)
    const visible = events.filter((e) => e.year >= start && e.year <= end)
    const scoreOf = (event: (typeof events)[number]) =>
      eventImportanceScore(
        event,
        [],
        familyDatabase.stats.earliestYear,
        familyDatabase.root,
      )

    const selected = selectDistributedLandmarks(
      visible,
      start,
      end,
      span,
      width,
      'near',
      scoreOf,
    )

    expect(selected.some((e) => e.kind === 'birth' && e.person.id === motherId)).toBe(true)
    expect(selected.some((e) => e.kind === 'birth' && e.person.id === fatherId)).toBe(true)

    const chapters = buildStoryChaptersForViewport(
      visible,
      start,
      end,
      span,
      familyDatabase.stats.earliestYear,
      2026,
      12,
      fullSpan,
    )
    const layoutSelected = selectDistributedLandmarks(
      visible,
      start,
      end,
      span,
      width,
      'near',
      (event) =>
        eventImportanceScore(
          event,
          chapters,
          familyDatabase.stats.earliestYear,
          familyDatabase.root,
        ),
    )
    expect(
      layoutSelected.some((e) => e.person.id === motherId),
      `layoutSelected=${layoutSelected.map((e) => `${e.year} ${e.person.name}`).join(' | ')}`,
    ).toBe(true)

    const { placed: directPlaced } = placeHybridLandmarks(
      selected,
      visible,
      start,
      span,
      width,
      height,
      null,
      scoreOf,
      'near',
    )
    expect(
      directPlaced.some((p) => p.event.person.id === motherId),
      `direct=${directPlaced.map((p) => p.event.person.name).join(', ')}`,
    ).toBe(true)

    const layout = layoutFamilyEventsProgressive(
      events,
      start,
      end,
      span,
      width,
      height,
      'decades',
      fullSpan,
      familyDatabase.stats.earliestYear,
      familyDatabase.root,
      2026,
    )

    const placedAll = layout.events.map(
      (p) => `${p.event.year} ${p.event.kind} ${p.event.person.name} g${p.event.person.generation}`,
    )
    expect(
      layout.events.some((p) => p.event.kind === 'birth' && p.event.person.id === motherId),
      `placed=${placedAll.join(' | ')}`,
    ).toBe(true)
  })

  it('scores spouse and children as near family', () => {
    const spouseId = 'I18123023648'
    const childId = 'I18128930147'
    const events = buildFamilyEvents(familyDatabase.people)
    const spouseBirth = events.find((e) => e.kind === 'birth' && e.person.id === spouseId)
    const childBirth = events.find((e) => e.kind === 'birth' && e.person.id === childId)
    const distant = events.find(
      (e) => e.kind === 'death' && e.year === 1922 && e.person.name.includes('Hinojos'),
    )
    expect(spouseBirth).toBeTruthy()
    expect(childBirth).toBeTruthy()
    expect(distant).toBeTruthy()
    expect(spouseBirth!.person.generation).toBe(0)
    expect(childBirth!.person.generation).toBe(-1)

    const earliest = familyDatabase.stats.earliestYear
    const spouseScore = eventImportanceScore(spouseBirth!, [], earliest, rootId)
    const childScore = eventImportanceScore(childBirth!, [], earliest, rootId)
    const distantScore = eventImportanceScore(distant!, [], earliest, rootId)
    expect(spouseScore).toBeGreaterThan(distantScore)
    expect(childScore).toBeGreaterThan(distantScore)
  })

  it('keeps Leah and sons visible in a modern roomy viewport', () => {
    const width = 1400
    const start = 1965
    const end = 2020
    const span = end - start
    const events = buildFamilyEvents(familyDatabase.people)
    const visible = events.filter((e) => e.year >= start && e.year <= end)
    const scoreOf = (event: (typeof events)[number]) =>
      eventImportanceScore(event, [], familyDatabase.stats.earliestYear, familyDatabase.root)

    const selected = selectDistributedLandmarks(visible, start, end, span, width, 'near', scoreOf)
    const ids = new Set(selected.map((e) => e.person.id))
    expect(ids.has('I18123023648'), `selected=${selected.map((e) => e.person.name).join(' | ')}`).toBe(
      true,
    )
    expect(ids.has('I18128930147') || ids.has('I112802641930')).toBe(true)
  })
})
