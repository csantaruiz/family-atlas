import { describe, expect, it } from 'vitest'
import { MAIN_THEME_ID } from '../ambientManifest'
import { selectTrack } from '../context/selectTrack'
import {
  resolveSoundtrackContext,
  type SoundtrackContext,
  type SoundtrackSignals,
} from '../context/resolveSoundtrackContext'
import { connectionSentence } from '../dev/connectionSentence'
import { AMBIENT_TRACKS, isActiveTrack } from '../ambientManifest'

const BASE: SoundtrackSignals = {
  surface: 'timeline',
  presentYear: 2026,
  timelineYear: 1832,
  familyRange: { start: 1473, end: 2026 },
  window: { start: 1820, end: 1840, coverage: 0.05 },
  migrationShare: null,
  windowPlaces: [],
  focus: null,
}

function focus(partial: Record<string, unknown>) {
  return {
    kind: 'ancestor' as const,
    id: 'x',
    year: null as number | null,
    yearEnd: null as number | null,
    places: [] as string[],
    ...partial,
  }
}

function choose(partial: Partial<SoundtrackContext>) {
  return selectTrack({
    environment: 'main',
    mood: 'everyday',
    subjectYear: null,
    yearSource: null,
    period: null,
    region: null,
    overview: false,
    explicit: true,
    precedence: 'ancestor_or_story',
    reason: 'test',
    focusId: 'test',
    ...partial,
  })
}

describe('guaranteed documentary fallback (Phase 2.6)', () => {
  it('José de la Luz Loya 1832 Mexico → contextual Guacamaya', () => {
    const ctx = resolveSoundtrackContext({
      ...BASE,
      focus: focus({
        id: 'jose',
        year: 1832,
        yearEnd: null,
        places: ['Mexico'],
      }),
    })
    const choice = selectTrack(ctx)
    expect(ctx.subjectYear).toBe(1832)
    expect(ctx.region).toBe('latin_america')
    expect(choice.track.id).toBe('mexico-la-guacamaya')
    expect(choice.usingFallback).toBe(false)
    expect(choice.matchKind).toMatch(/historical/)
  })

  it('Henshaw Stubbs at shared 1832 timeline → British contextual music (never silence)', () => {
    const ctx = resolveSoundtrackContext({
      ...BASE,
      focus: focus({
        id: 'henshaw',
        year: 1763,
        yearEnd: 1834,
        places: ['Gawsworth, Cheshire, , England'],
      }),
    })
    const choice = selectTrack(ctx)
    expect(ctx.subjectYear).toBe(1832)
    expect(ctx.region).toBe('british_isles')
    expect(choice.track.id).not.toBeFalsy()
    expect(choice.track.src).toBeTruthy()
    expect(['britain-early-one-morning', 'ireland-brian-boru-march']).toContain(choice.track.id)
    expect(choice.usingFallback).toBe(false)
  })

  it('unmatched historical context resolves to documentary, not null/empty', () => {
    const choice = choose({
      subjectYear: 1200,
      region: 'asia',
      environment: 'main',
      mood: 'everyday',
    })
    expect(choice.track.id).toBe(MAIN_THEME_ID)
    expect(choice.usingFallback).toBe(true)
    expect(choice.matchKind).toBe('documentary_fallback')
    expect(choice.track.src).toBeTruthy()
    expect(choice.selectionReason).toContain('documentary soundtrack')
  })

  it('unmatched historical event and family-event contexts fall back to documentary', () => {
    const event = resolveSoundtrackContext({
      ...BASE,
      timelineYear: null,
      focus: {
        kind: 'historical_event',
        id: 'evt:obscure',
        year: 1100,
        yearEnd: null,
        places: ['Unknown'],
        text: 'Obscure local event',
      },
    })
    const eventChoice = selectTrack(event)
    expect(eventChoice.track.id).toBe(MAIN_THEME_ID)
    expect(eventChoice.usingFallback).toBe(true)

    const story = resolveSoundtrackContext({
      ...BASE,
      timelineYear: null,
      focus: {
        kind: 'family_event',
        id: 'story:1',
        year: 1100,
        yearEnd: null,
        places: [],
        text: 'Family story without geography',
        eventKind: 'other',
      },
    })
    const storyChoice = selectTrack(story)
    expect(storyChoice.track.id).toBe(MAIN_THEME_ID)
    expect(storyChoice.usingFallback).toBe(true)
  })

  it('José → Henshaw selects different playable tracks (crossfade candidates)', () => {
    const jose = selectTrack(
      resolveSoundtrackContext({
        ...BASE,
        focus: focus({ id: 'jose', year: 1832, places: ['Mexico'] }),
      }),
    )
    const henshaw = selectTrack(
      resolveSoundtrackContext({
        ...BASE,
        focus: focus({
          id: 'henshaw',
          year: 1763,
          yearEnd: 1834,
          places: ['Gawsworth, Cheshire, , England'],
        }),
      }),
      jose.track.id,
    )
    expect(jose.track.id).toBe('mexico-la-guacamaya')
    expect(henshaw.track.id).not.toBe(jose.track.id)
    expect(henshaw.track.src).toBeTruthy()
  })

  it('two unmatched ancestors keep documentary without requiring a restart signal', () => {
    const a = choose({ subjectYear: 1200, region: 'asia' })
    const b = choose({ subjectYear: 1250, region: 'asia' })
    const again = selectTrack(
      {
        environment: 'main',
        mood: 'everyday',
        subjectYear: 1250,
        yearSource: 'test',
        period: null,
        region: 'asia',
        overview: false,
        explicit: true,
        precedence: 'ancestor_or_story',
        reason: 'test',
        focusId: 'b',
      },
      a.track.id,
    )
    expect(a.track.id).toBe(MAIN_THEME_ID)
    expect(b.track.id).toBe(MAIN_THEME_ID)
    expect(again.track.id).toBe(MAIN_THEME_ID)
  })

  it('visitor fallback copy explains documentary when no historical match exists', () => {
    const main = AMBIENT_TRACKS.find((t) => t.id === MAIN_THEME_ID)
    expect(main && isActiveTrack(main)).toBe(true)
    if (!main || !isActiveTrack(main)) return
    const sentence = connectionSentence(
      main,
      {
        environment: 'main',
        mood: 'everyday',
        subjectYear: 1200,
        yearSource: 'test',
        period: null,
        region: 'asia',
        overview: false,
        explicit: true,
        precedence: 'ancestor_or_story',
        reason: 'unmatched',
        focusId: 'x',
      },
      true,
    )
    expect(sentence).toContain('No historically appropriate track')
  })

  it('panel close overview keeps documentary as non-fallback overview', () => {
    const closed = resolveSoundtrackContext({ ...BASE, focus: null, timelineYear: 1832 })
    const choice = selectTrack(closed)
    expect(closed.overview).toBe(true)
    expect(choice.track.id).toBe(MAIN_THEME_ID)
    expect(choice.matchKind).toBe('overview')
  })
})
