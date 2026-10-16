import { describe, expect, it } from 'vitest'
import {
  AMBIENT_TRACKS,
  getMainTheme,
  isActiveTrack,
  MAIN_THEME_ID,
  type AmbientTrack,
} from '../ambientManifest'
import type { SoundtrackContext } from '../context/resolveSoundtrackContext'
import { selectTrack } from '../context/selectTrack'

const MAIN = getMainTheme()

function context(partial: Partial<SoundtrackContext>): SoundtrackContext {
  return {
    category: 'main',
    period: null,
    region: null,
    overview: false,
    reason: 'test',
    ...partial,
  }
}

/** Library with one playable non-main track so selection can leave the theme. */
function libraryWithEveryday(): AmbientTrack[] {
  return [
    ...AMBIENT_TRACKS,
    {
      id: 'test-everyday-active',
      status: 'active',
      title: 'Test Everyday',
      artist: 'Test',
      categories: ['everyday'],
      periods: 'any',
      regions: ['north_america'],
      mood: ['intimate'],
      src: MAIN.src,
      gain: 0.3,
      playback: {},
      rights: MAIN.rights,
    },
  ]
}

describe('selectTrack', () => {
  it('falls back to the main theme when category tracks are only placeholders', () => {
    const choice = selectTrack(context({ category: 'origins', period: 'c17_18', region: 'british_isles' }))
    expect(choice.track.id).toBe(MAIN_THEME_ID)
    expect(choice.usingFallback).toBe(true)
    expect(choice.ideal.status).toBe('placeholder')
    expect(choice.ideal.categories).toContain('origins')
  })

  it('plays an active category match when one exists', () => {
    const library = libraryWithEveryday()
    const choice = selectTrack(
      context({ category: 'everyday', period: 'c19', region: 'north_america' }),
      null,
      library,
    )
    expect(choice.track.id).toBe('test-everyday-active')
    expect(choice.usingFallback).toBe(false)
    expect(isActiveTrack(choice.track)).toBe(true)
  })

  it('keeps the current track on equal fit so similar contexts do not thrash', () => {
    const library = libraryWithEveryday()
    const same = selectTrack(
      context({ category: 'everyday', period: 'c19', region: 'north_america' }),
      'test-everyday-active',
      library,
    )
    expect(same.track.id).toBe('test-everyday-active')
  })
})
