import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AMBIENT_TRACKS,
  activeTracks,
  getMainTheme,
  MAIN_THEME_ID,
} from '../ambientManifest'
import {
  DEFAULT_AMBIENT_PREFERENCES,
  DEFAULT_AMBIENT_VOLUME,
  parseAmbientPreferences,
} from '../ambientPreferences'

describe('ambient soundtrack manifest', () => {
  it('ships multiple historically dated playable tracks with on-disk files', () => {
    const playable = activeTracks()
    expect(playable.length).toBeGreaterThanOrEqual(8)
    expect(getMainTheme().id).toBe(MAIN_THEME_ID)

    for (const track of playable) {
      expect(track.history.authenticity).toMatch(/period_repertoire|modern_interpretation|cinematic_atmosphere/)
      expect(track.history.confidence).toMatch(/high|medium|low/)
      expect(track.history.attestationNotes.trim()).not.toBe('')
      expect(track.rights.license.trim()).not.toBe('')
      expect(track.src.startsWith('/')).toBe(true)
      expect(existsSync(join(process.cwd(), 'public', track.src))).toBe(true)
    }

    const placeholders = AMBIENT_TRACKS.filter((track) => track.status === 'placeholder')
    expect(placeholders.length).toBeGreaterThan(0)
    for (const track of placeholders) {
      expect(track.src).toBeNull()
      expect(track.brief.trim().length).toBeGreaterThan(10)
    }
  })

  it('marks Londonderry Air as unusable before its 1855 attestation', () => {
    const air = AMBIENT_TRACKS.find((track) => track.id === 'britain-londonderry-air')
    expect(air?.history.earliestAttestationYear).toBe(1855)
    expect(air?.history.usableFromYear).toBe(1855)
  })
})

describe('ambient preferences', () => {
  it('defaults to sound off at a quiet volume', () => {
    expect(parseAmbientPreferences(null)).toEqual(DEFAULT_AMBIENT_PREFERENCES)
    expect(DEFAULT_AMBIENT_PREFERENCES.enabled).toBe(false)
    expect(DEFAULT_AMBIENT_VOLUME).toBeLessThanOrEqual(0.5)
  })

  it('keeps muted preference and migrates the Phase 1 default volume', () => {
    expect(parseAmbientPreferences('{"enabled":true,"volume":0.35}').enabled).toBe(true)
    expect(parseAmbientPreferences('{"enabled":true,"volume":0.7}').volume).toBe(DEFAULT_AMBIENT_VOLUME)
  })
})
