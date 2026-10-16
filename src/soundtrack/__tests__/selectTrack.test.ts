import { describe, expect, it } from 'vitest'
import { AMBIENT_TRACKS, MAIN_THEME_ID, isActiveTrack } from '../ambientManifest'
import type { SoundtrackContext } from '../context/resolveSoundtrackContext'
import { selectTrack } from '../context/selectTrack'

function context(partial: Partial<SoundtrackContext>): SoundtrackContext {
  return {
    environment: 'main',
    mood: 'main',
    period: null,
    region: null,
    overview: false,
    explicit: false,
    reason: 'test',
    ...partial,
  }
}

describe('selectTrack', () => {
  it('plays distinct active recordings for each starter environment', () => {
    const mexico = selectTrack(context({ environment: 'mexico_southwest', region: 'latin_america' }))
    const britain = selectTrack(context({ environment: 'britain_ireland', region: 'british_isles' }))
    const america = selectTrack(
      context({ environment: 'industrial_america', period: 'c19', region: 'north_america' }),
    )
    const war = selectTrack(context({ environment: 'wwii_1940s', period: 'world_wars', mood: 'conflict' }))
    const iberia = selectTrack(context({ environment: 'iberia', region: 'southern_europe' }))
    const main = selectTrack(context({ environment: 'main', overview: true }))

    expect(mexico.track.id).not.toBe(MAIN_THEME_ID)
    expect(britain.track.id).not.toBe(MAIN_THEME_ID)
    expect(america.track.id).not.toBe(MAIN_THEME_ID)
    expect(war.track.id).not.toBe(MAIN_THEME_ID)
    expect(iberia.track.id).not.toBe(MAIN_THEME_ID)
    expect(main.track.id).toBe(MAIN_THEME_ID)

    const ids = new Set([
      mexico.track.id,
      britain.track.id,
      america.track.id,
      war.track.id,
      iberia.track.id,
      main.track.id,
    ])
    expect(ids.size).toBe(6)
    for (const choice of [mexico, britain, america, war, iberia, main]) {
      expect(isActiveTrack(choice.track)).toBe(true)
      expect(choice.usingFallback).toBe(false)
    }
  })

  it('keeps the current track on equal fit so similar contexts do not thrash', () => {
    const first = selectTrack(
      context({ environment: 'mexico_southwest', region: 'latin_america', mood: 'everyday' }),
    )
    const again = selectTrack(
      context({ environment: 'mexico_southwest', region: 'latin_america', mood: 'everyday' }),
      first.track.id,
      AMBIENT_TRACKS,
    )
    expect(again.track.id).toBe(first.track.id)
  })
})
