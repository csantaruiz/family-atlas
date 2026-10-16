import { describe, expect, it } from 'vitest'
import { MAIN_THEME_ID } from '../ambientManifest'
import {
  resolveSoundtrackContext,
  type SoundtrackSignals,
} from '../context/resolveSoundtrackContext'
import { selectTrack } from '../context/selectTrack'
import { TransitionScheduler } from '../context/transitionScheduler'

const BASE: SoundtrackSignals = {
  surface: 'timeline',
  presentYear: 2026,
  timelineYear: 1928,
  familyRange: { start: 1473, end: 2026 },
  window: { start: 1900, end: 1950, coverage: 0.1 },
  migrationShare: null,
  windowPlaces: ['New Jersey, USA'],
  focus: null,
}

describe('panel lifecycle → History Documentary', () => {
  it('Theresa open → Maple Leaf; close → Documentary even when zoomed', () => {
    const open = resolveSoundtrackContext({
      ...BASE,
      focus: {
        kind: 'ancestor',
        id: 'person:theresa',
        year: 1925,
        yearEnd: 1998,
        places: ['New Jersey, USA'],
      },
    })
    expect(selectTrack(open).track.id).toBe('industrial-maple-leaf-rag')

    const closed = resolveSoundtrackContext({ ...BASE, focus: null })
    expect(selectTrack(closed).track.id).toBe(MAIN_THEME_ID)
  })

  it('Alfred open → Documentary fallback; close → Documentary', () => {
    const open = resolveSoundtrackContext({
      ...BASE,
      timelineYear: null,
      focus: {
        kind: 'ancestor',
        id: 'person:alfred',
        year: 1943,
        yearEnd: null,
        places: ['Bexar, Texas'],
      },
    })
    expect(selectTrack(open).track.id).toBe(MAIN_THEME_ID)

    const closed = resolveSoundtrackContext({ ...BASE, focus: null })
    expect(selectTrack(closed).track.id).toBe(MAIN_THEME_ID)
  })

  it('historical event close restores Documentary', () => {
    const open = resolveSoundtrackContext({
      ...BASE,
      focus: {
        kind: 'historical_event',
        id: 'gb-1707',
        year: 1707,
        places: ['Britain'],
        text: 'Kingdom of Great Britain',
      },
    })
    expect(selectTrack(open).track.id).toBe('britain-greensleeves')

    const closed = resolveSoundtrackContext({ ...BASE, focus: null })
    expect(selectTrack(closed).track.id).toBe(MAIN_THEME_ID)
  })

  it('switch A → B → close restores Documentary via forced commits', () => {
    const commits: string[] = []
    const scheduler = new TransitionScheduler((payload) => commits.push(payload.trackId))

    const a = selectTrack(
      resolveSoundtrackContext({
        ...BASE,
        timelineYear: null,
        focus: {
          kind: 'ancestor',
          id: 'person:theresa',
          year: 1925,
          yearEnd: 1998,
          places: ['New Jersey, USA'],
        },
      }),
    )
    scheduler.force(a.track.id, 0.6)

    const b = selectTrack(
      resolveSoundtrackContext({
        ...BASE,
        timelineYear: null,
        focus: {
          kind: 'ancestor',
          id: 'person:alfred',
          year: 1943,
          places: ['Bexar, Texas'],
        },
      }),
    )
    scheduler.force(b.track.id, 0.6)

    const closed = selectTrack(resolveSoundtrackContext({ ...BASE, focus: null }))
    scheduler.force(closed.track.id, 0.6)

    expect(commits[0]).toBe('industrial-maple-leaf-rag')
    expect(commits[commits.length - 1]).toBe(MAIN_THEME_ID)
  })
})
