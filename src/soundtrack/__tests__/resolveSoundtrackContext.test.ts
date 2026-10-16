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
  it('returns the main environment for broad overviews', () => {
    expect(resolveSoundtrackContext(signals({ surface: 'tree' })).environment).toBe('main')
    expect(resolveSoundtrackContext(signals({ surface: 'people' })).overview).toBe(true)
    expect(resolveSoundtrackContext(signals({})).environment).toBe('main')
  })

  it('selects Mexico / Southwest for Latin American geography', () => {
    const result = resolveSoundtrackContext(
      signals({
        focus: focus({
          kind: 'ancestor',
          id: 'p-mx',
          year: 1880,
          places: ['Chihuahua, Mexico'],
        }),
      }),
    )
    expect(result.environment).toBe('mexico_southwest')
    expect(result.region).toBe('latin_america')
    expect(result.explicit).toBe(true)
  })

  it('selects Britain & Ireland for Isles ancestors', () => {
    const result = resolveSoundtrackContext(
      signals({
        focus: focus({
          kind: 'ancestor',
          id: 'p-uk',
          year: 1600,
          places: ['Cheshire, England'],
        }),
      }),
    )
    expect(result.environment).toBe('britain_ireland')
    expect(result.mood).toBe('origins')
  })

  it('selects Industrial America for U.S. late-19th / early-20th context', () => {
    const result = resolveSoundtrackContext(
      signals({
        window: { start: 1880, end: 1910, coverage: 0.1 },
        windowPlaces: ['Pennsylvania, United States', 'New Jersey, United States'],
      }),
    )
    expect(result.environment).toBe('industrial_america')
    expect(result.period).toBe('c19')
  })

  it('selects WWII for wartime windows and military service', () => {
    expect(
      resolveSoundtrackContext(
        signals({ window: { start: 1939, end: 1945, coverage: 0.02 } }),
      ).environment,
    ).toBe('wwii_1940s')

    expect(
      resolveSoundtrackContext(
        signals({
          focus: focus({
            kind: 'family_event',
            id: 'svc',
            year: 1943,
            places: ['United States'],
            eventKind: 'service',
          }),
        }),
      ).environment,
    ).toBe('wwii_1940s')
  })

  it('selects Iberia for Spanish geography', () => {
    const result = resolveSoundtrackContext(
      signals({
        focus: focus({
          kind: 'ancestor',
          id: 'p-es',
          year: 1650,
          places: ['Reinos de Castilla, Spain'],
        }),
      }),
    )
    expect(result.environment).toBe('iberia')
  })

  it('falls back to main for unsupported regions rather than inventing ethnicity from surnames', () => {
    const result = resolveSoundtrackContext(
      signals({
        focus: focus({
          kind: 'ancestor',
          id: 'p-jp',
          year: 1900,
          places: ['Tokyo, Japan'],
        }),
      }),
    )
    expect(result.environment).toBe('main')
    expect(result.reason.toLowerCase()).toMatch(/no matching|fallback|catalog/)
  })
})
