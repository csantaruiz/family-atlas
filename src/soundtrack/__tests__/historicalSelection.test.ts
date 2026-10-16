import { describe, expect, it } from 'vitest'
import { selectTrack } from '../context/selectTrack'
import {
  resolveSoundtrackContext,
  type SoundtrackContext,
  type SoundtrackSignals,
} from '../context/resolveSoundtrackContext'

const BASE: SoundtrackSignals = {
  surface: 'timeline',
  presentYear: 2026,
  timelineYear: null,
  familyRange: { start: 1473, end: 2026 },
  window: { start: 1470, end: 2030, coverage: 1 },
  migrationShare: null,
  windowPlaces: [],
  focus: null,
}

function choose(partial: Partial<SoundtrackContext>) {
  const context: SoundtrackContext = {
    environment: 'main',
    mood: 'everyday',
    subjectYear: null,
    yearSource: null,
    period: null,
    region: null,
    overview: false,
    explicit: true,
    precedence: 'historical_event',
    reason: 'test',
    focusId: 'test',
    ...partial,
  }
  return selectTrack(context)
}

describe('historical authenticity selection', () => {
  it('does not use Londonderry Air for 1600s Irish/English or 1707 Britain', () => {
    const irish1600 = choose({
      subjectYear: 1650,
      period: 'c17_18',
      region: 'british_isles',
      environment: 'britain_ireland',
      mood: 'origins',
      precedence: 'ancestor_or_story',
    })
    expect(irish1600.track.id).not.toBe('britain-londonderry-air')

    const britain1707 = choose({
      subjectYear: 1707,
      period: 'c17_18',
      region: 'british_isles',
      environment: 'britain_ireland',
      mood: 'everyday',
      precedence: 'historical_event',
      reason: 'Kingdom of Great Britain',
    })
    expect(britain1707.track.id).not.toBe('britain-londonderry-air')
    expect(britain1707.track.id).toBe('britain-greensleeves')
  })

  it('uses Greensleeves for early-modern British Isles and Londonderry only after 1855', () => {
    expect(
      choose({
        subjectYear: 1603,
        region: 'british_isles',
        environment: 'britain_ireland',
        mood: 'origins',
      }).track.id,
    ).toBe('britain-greensleeves')

    expect(
      choose({
        subjectYear: 1860,
        region: 'british_isles',
        environment: 'britain_ireland',
        mood: 'everyday',
        period: 'c19',
      }).track.id,
    ).toBe('britain-londonderry-air')
  })

  it('uses Early One Morning for late-18th / 19th British everyday contexts', () => {
    const choice = choose({
      subjectYear: 1810,
      region: 'british_isles',
      environment: 'britain_ireland',
      mood: 'everyday',
      period: 'c19',
    })
    expect(['britain-early-one-morning', 'britain-londonderry-air', 'ireland-brian-boru-march']).toContain(
      choice.track.id,
    )
    expect(choice.track.id).not.toBe('britain-greensleeves')
  })

  it('falls back to cinematic main theme for early colonial Mexico (pre son-jarocho window)', () => {
    const choice = choose({
      subjectYear: 1720,
      region: 'latin_america',
      environment: 'mexico_southwest',
      mood: 'origins',
      precedence: 'ancestor_or_story',
    })
    expect(choice.track.id).toBe('atlas-main-theme')
    expect(choice.usingFallback).toBe(true)
  })

  it('allows son jarocho for late-colonial / 19th-century Mexican contexts', () => {
    expect(
      choose({
        subjectYear: 1820,
        region: 'latin_america',
        environment: 'mexico_southwest',
        mood: 'everyday',
      }).track.id,
    ).toBe('mexico-la-guacamaya')
  })

  it('uses WWII remembrance only for conflict mood, not civilian birth years', () => {
    expect(
      choose({
        subjectYear: 1943,
        period: 'world_wars',
        region: 'north_america',
        environment: 'wwii_1940s',
        mood: 'conflict',
      }).track.id,
    ).toBe('wwii-goin-home')

    expect(
      choose({
        subjectYear: 1943,
        period: 'world_wars',
        region: 'north_america',
        environment: 'industrial_america',
        mood: 'everyday',
      }).track.id,
    ).toBe('america-shenandoah')

    const overview = resolveSoundtrackContext({ ...BASE, focus: null })
    expect(overview.overview).toBe(true)
    expect(selectTrack(overview).track.id).toBe('atlas-main-theme')
  })

  it('keeps explicit historical events above the viewport year window', () => {
    const resolved = resolveSoundtrackContext({
      ...BASE,
      window: { start: 1880, end: 1920, coverage: 0.1 },
      windowPlaces: ['Pennsylvania, United States'],
      focus: {
        kind: 'historical_event',
        id: 'gb-1707',
        year: 1707,
        places: ['Britain'],
        text: 'Kingdom of Great Britain',
      },
    })
    expect(resolved.subjectYear).toBe(1707)
    expect(resolved.precedence).toBe('historical_event')
    expect(selectTrack(resolved).track.id).toBe('britain-greensleeves')
  })

  it('selects Maple Leaf Rag or Shenandoah for Theresa Jackson birth-year context (1925 NJ)', () => {
    const theresa = resolveSoundtrackContext({
      ...BASE,
      timelineYear: null,
      focus: {
        kind: 'ancestor',
        id: 'person:theresa',
        year: 1925,
        yearEnd: 1998,
        places: ['New Jersey, USA', 'Gloucester, Camden, New Jersey, USA'],
      },
    })
    expect(theresa.subjectYear).toBe(1925)
    expect(['industrial-maple-leaf-rag', 'america-shenandoah']).toContain(selectTrack(theresa).track.id)
  })

  it('uses Shenandoah for Esther Madelyn Ace (1896 Pennsylvania) instead of documentary fallback', () => {
    const esther = resolveSoundtrackContext({
      ...BASE,
      timelineYear: null,
      focus: {
        kind: 'ancestor',
        id: 'person:esther',
        year: 1896,
        yearEnd: null,
        places: ['Pennsylvania, United States', 'Gloucester City, Camden, New Jersey, United States'],
      },
    })
    expect(esther.subjectYear).toBe(1896)
    expect(esther.region).toBe('north_america')
    // Maple Leaf starts 1899 — Esther’s birth is covered by Shenandoah (1860–1960).
    expect(selectTrack(esther).track.id).toBe('america-shenandoah')
  })

  it('keeps son jarocho for Pedro Luna (1880 Mexico)', () => {
    const pedro = resolveSoundtrackContext({
      ...BASE,
      timelineYear: null,
      focus: {
        kind: 'ancestor',
        id: 'person:pedro',
        year: 1880,
        places: ['Mexico', 'Westminster, Orange, California, USA'],
      },
    })
    expect(selectTrack(pedro).track.id).toBe('mexico-la-guacamaya')
  })

  it('uses Shenandoah for Alfred Ruiz civilian mid-century US birth (not Goin Home)', () => {
    const alfred = resolveSoundtrackContext({
      ...BASE,
      timelineYear: null,
      focus: {
        kind: 'ancestor',
        id: 'person:alfred',
        year: 1943,
        yearEnd: null,
        places: ['Bexar, Texas', 'San Antonio, TX, USA'],
      },
    })
    expect(selectTrack(alfred).track.id).not.toBe('wwii-goin-home')
    expect(selectTrack(alfred).track.id).toBe('america-shenandoah')
  })
})
