import { describe, expect, it } from 'vitest'
import {
  resolveSoundtrackContext,
  type SoundtrackFocus,
  type SoundtrackSignals,
} from '../context/resolveSoundtrackContext'

const BASE: SoundtrackSignals = {
  surface: 'timeline',
  presentYear: 2026,
  familyRange: { start: 1473, end: 2026 },
  window: { start: 1470, end: 2030, coverage: 1 },
  migrationShare: null,
  windowPlaces: [],
  focus: null,
}

function signals(partial: Partial<SoundtrackSignals>): SoundtrackSignals {
  return { ...BASE, ...partial }
}

function focus(partial: Partial<SoundtrackFocus> & Pick<SoundtrackFocus, 'kind' | 'id'>): SoundtrackFocus {
  return { year: null, places: [], ...partial }
}

describe('resolveSoundtrackContext', () => {
  it('returns the main theme for broad overviews', () => {
    expect(resolveSoundtrackContext(signals({ surface: 'tree' })).category).toBe('main')
    expect(resolveSoundtrackContext(signals({ surface: 'people' })).overview).toBe(true)
    expect(resolveSoundtrackContext(signals({})).category).toBe('main')
  })

  it('picks migration for the journeys map without a selection', () => {
    expect(resolveSoundtrackContext(signals({ surface: 'journeys', window: null })).category).toBe(
      'migration',
    )
  })

  it('uses origins for early timeline windows', () => {
    const result = resolveSoundtrackContext(
      signals({
        window: { start: 1500, end: 1580, coverage: 0.15 },
        windowPlaces: ['Cheshire, England'],
      }),
    )
    expect(result.category).toBe('origins')
    expect(result.period).toBe('medieval_early_modern')
    expect(result.region).toBe('british_isles')
  })

  it('uses conflict for wartime windows and upheaval history', () => {
    expect(
      resolveSoundtrackContext(
        signals({ window: { start: 1939, end: 1945, coverage: 0.02 } }),
      ).category,
    ).toBe('conflict')

    expect(
      resolveSoundtrackContext(
        signals({
          focus: focus({
            kind: 'historical_event',
            id: 'h1',
            year: 1810,
            places: ['Mexico'],
            text: 'Mexican War of Independence',
          }),
        }),
      ).category,
    ).toBe('conflict')
  })

  it('uses migration for moves and routes', () => {
    expect(
      resolveSoundtrackContext(
        signals({
          focus: focus({
            kind: 'migration',
            id: 'm1',
            year: 1915,
            places: ['Chihuahua, Mexico', 'El Paso, Texas'],
          }),
        }),
      ).category,
    ).toBe('migration')

    expect(
      resolveSoundtrackContext(
        signals({
          focus: focus({
            kind: 'family_event',
            id: 'e1',
            year: 1920,
            places: ['Mexico'],
            eventKind: 'move',
          }),
        }),
      ).category,
    ).toBe('migration')
  })

  it('uses everyday for intimate ancestor focus and legacy for recent generations', () => {
    expect(
      resolveSoundtrackContext(
        signals({
          focus: focus({
            kind: 'ancestor',
            id: 'p1',
            year: 1850,
            places: ['Pennsylvania, United States'],
          }),
        }),
      ).category,
    ).toBe('everyday')

    expect(
      resolveSoundtrackContext(
        signals({
          focus: focus({
            kind: 'ancestor',
            id: 'p2',
            year: 2000,
            places: ['California, United States'],
          }),
        }),
      ).category,
    ).toBe('legacy')
  })

  it('derives relative origins from the loaded family span, not a fixed surname', () => {
    const shortTree = resolveSoundtrackContext(
      signals({
        familyRange: { start: 1880, end: 2020 },
        window: { start: 1880, end: 1900, coverage: 0.15 },
      }),
    )
    expect(shortTree.category).toBe('origins')
  })
})
