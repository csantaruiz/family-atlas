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
  it('returns overview precedence without a subject year for broad views', () => {
    const result = resolveSoundtrackContext(signals({ surface: 'tree' }))
    expect(result.overview).toBe(true)
    expect(result.subjectYear).toBeNull()
    expect(result.precedence).toBe('overview')
  })

  it('gives historical events subject-year precedence over the timeline viewport', () => {
    const result = resolveSoundtrackContext(
      signals({
        window: { start: 1880, end: 1920, coverage: 0.08 },
        windowPlaces: ['United States'],
        focus: focus({
          kind: 'historical_event',
          id: '1707',
          year: 1707,
          places: ['Britain'],
          text: 'Kingdom of Great Britain',
        }),
      }),
    )
    expect(result.subjectYear).toBe(1707)
    expect(result.precedence).toBe('historical_event')
    expect(result.explicit).toBe(true)
  })

  it('resolves ancestor geography without surname inference', () => {
    const mexico = resolveSoundtrackContext(
      signals({
        focus: focus({
          kind: 'ancestor',
          id: 'mx',
          year: 1880,
          places: ['Chihuahua, Mexico'],
        }),
      }),
    )
    expect(mexico.region).toBe('latin_america')
    expect(mexico.subjectYear).toBe(1880)
    expect(mexico.precedence).toBe('ancestor_or_story')
  })
})
