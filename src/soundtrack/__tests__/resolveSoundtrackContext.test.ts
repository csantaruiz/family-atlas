import { describe, expect, it } from 'vitest'
import {
  resolveSoundtrackContext,
  type SoundtrackFocus,
  type SoundtrackSignals,
} from '../context/resolveSoundtrackContext'
import { selectTrack } from '../context/selectTrack'

const BASE: SoundtrackSignals = {
  surface: 'timeline',
  presentYear: 2026,
  timelineYear: 1900,
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
    expect(result.focusId).toBeNull()
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
    expect(result.focusId).toBe('1707')
  })

  it('resolves ancestor geography without surname inference', () => {
    const mexico = resolveSoundtrackContext(
      signals({
        timelineYear: null,
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

  it('uses birth year for ancestors, not lifespan midpoint (Theresa Jackson pattern)', () => {
    const theresa = resolveSoundtrackContext(
      signals({
        timelineYear: null,
        focus: focus({
          kind: 'ancestor',
          id: 'person:theresa',
          year: 1925,
          yearEnd: 1998,
          places: ['New Jersey, USA'],
        }),
      }),
    )
    expect(theresa.subjectYear).toBe(1925)
    expect(theresa.subjectYear).not.toBe(1961)
    expect(theresa.yearSource).toMatch(/birth/i)
  })

  it('prefers timeline year while an ancestor was living', () => {
    const theresa = resolveSoundtrackContext(
      signals({
        timelineYear: 1944,
        focus: focus({
          kind: 'ancestor',
          id: 'person:theresa',
          year: 1925,
          yearEnd: 1998,
          places: ['New Jersey, USA'],
        }),
      }),
    )
    expect(theresa.subjectYear).toBe(1944)
    expect(theresa.yearSource).toMatch(/timeline/i)
  })

  it('does not treat civilian WWII births as wartime soundtrack contexts (Alfred Ruiz pattern)', () => {
    const alfred = resolveSoundtrackContext(
      signals({
        timelineYear: null,
        focus: focus({
          kind: 'ancestor',
          id: 'person:alfred',
          year: 1943,
          yearEnd: null,
          places: ['Bexar, Texas', 'San Antonio, TX, USA'],
        }),
      }),
    )
    expect(alfred.subjectYear).toBe(1943)
    expect(alfred.mood).not.toBe('conflict')
    expect(alfred.environment).not.toBe('wwii_1940s')
    // No industrial-era Canadian/US ragtime after 1930 — honest cinematic fallback.
    expect(selectTrack(alfred).track.id).toBe('atlas-main-theme')
  })

  it('uses wartime music for explicit military service, not birth year alone', () => {
    const service = resolveSoundtrackContext(
      signals({
        focus: focus({
          kind: 'family_event',
          id: 'service:1',
          year: 1943,
          places: ['United States'],
          eventKind: 'service',
          text: 'Military service',
        }),
      }),
    )
    expect(service.mood).toBe('conflict')
    expect(service.environment).toBe('wwii_1940s')
    expect(selectTrack(service).track.id).toBe('wwii-goin-home')
  })

  it('restores overview when focus is cleared (panel closed)', () => {
    const open = resolveSoundtrackContext(
      signals({
        focus: focus({
          kind: 'ancestor',
          id: 'person:alfred',
          year: 1943,
          places: ['Texas'],
        }),
      }),
    )
    expect(open.explicit).toBe(true)

    const closed = resolveSoundtrackContext(signals({ focus: null }))
    expect(closed.overview).toBe(true)
    expect(closed.explicit).toBe(false)
    expect(closed.focusId).toBeNull()
    expect(selectTrack(closed).track.id).toBe('atlas-main-theme')
  })
})
