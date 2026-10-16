import { describe, expect, it } from 'vitest'
import { MAIN_THEME_ID } from '../ambientManifest'
import type { SoundtrackContext } from '../context/resolveSoundtrackContext'
import { selectTrack } from '../context/selectTrack'

function context(partial: Partial<SoundtrackContext>): SoundtrackContext {
  return {
    environment: 'main',
    mood: 'main',
    subjectYear: null,
    yearSource: null,
    period: null,
    region: null,
    overview: false,
    explicit: false,
    precedence: 'overview',
    reason: 'test',
    focusId: null,
    ...partial,
  }
}

describe('selectTrack', () => {
  it('uses the cinematic main theme for undated overviews', () => {
    const choice = selectTrack(context({ overview: true }))
    expect(choice.track.id).toBe(MAIN_THEME_ID)
    expect(choice.usingFallback).toBe(false)
  })

  it('keeps the current historically valid track when scores remain close', () => {
    const first = selectTrack(
      context({
        subjectYear: 1865,
        region: 'british_isles',
        environment: 'britain_ireland',
        mood: 'everyday',
        period: 'c19',
        precedence: 'viewport',
      }),
    )
    const again = selectTrack(
      context({
        subjectYear: 1865,
        region: 'british_isles',
        environment: 'britain_ireland',
        mood: 'everyday',
        period: 'c19',
        precedence: 'viewport',
      }),
      first.track.id,
    )
    expect(again.track.id).toBe(first.track.id)
  })
})
