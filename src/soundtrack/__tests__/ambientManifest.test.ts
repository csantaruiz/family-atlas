import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AMBIENT_TRACKS,
  activeTracks,
  getMainTheme,
  isActiveTrack,
  MAIN_THEME_ID,
  tracksForEnvironment,
} from '../ambientManifest'
import {
  DEFAULT_AMBIENT_PREFERENCES,
  DEFAULT_AMBIENT_VOLUME,
  parseAmbientPreferences,
} from '../ambientPreferences'
import { SOUNDTRACK_ENVIRONMENTS } from '../context/environments'

describe('ambient soundtrack manifest', () => {
  it('ships six active playable environments with verified rights and on-disk files', () => {
    const playable = activeTracks()
    expect(playable.length).toBeGreaterThanOrEqual(6)
    expect(getMainTheme().id).toBe(MAIN_THEME_ID)

    for (const environment of SOUNDTRACK_ENVIRONMENTS) {
      const tracks = tracksForEnvironment(environment.id).filter(isActiveTrack)
      expect(tracks.length).toBeGreaterThan(0)
    }

    for (const track of playable) {
      expect(track.rights.license.trim()).not.toBe('')
      expect(track.rights.licenseUrl).toMatch(/^https:\/\//)
      expect(track.rights.source.trim()).not.toBe('')
      expect(track.rights.verifiedBy.trim()).not.toBe('')
      expect(track.rights.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(track.rights.compositionNotes.trim()).not.toBe('')
      expect(track.rights.recordingNotes.trim()).not.toBe('')
      expect(track.src.startsWith('/')).toBe(true)
      expect(existsSync(join(process.cwd(), 'public', track.src))).toBe(true)
      expect(track.gain).toBeGreaterThan(0)
      expect(track.gain).toBeLessThanOrEqual(1)
    }
  })

  it('has unique track ids and no Santa Ruiz hardcoding in the catalog', () => {
    const ids = AMBIENT_TRACKS.map((track) => track.id)
    expect(new Set(ids).size).toBe(ids.length)
    const blob = JSON.stringify(AMBIENT_TRACKS).toLowerCase()
    expect(blob).not.toMatch(/santa ruiz|santaruiz/)
  })
})

describe('ambient preferences', () => {
  it('defaults to sound off at a quiet volume', () => {
    expect(parseAmbientPreferences(null)).toEqual(DEFAULT_AMBIENT_PREFERENCES)
    expect(DEFAULT_AMBIENT_PREFERENCES.enabled).toBe(false)
    expect(DEFAULT_AMBIENT_VOLUME).toBeLessThanOrEqual(0.5)
  })

  it('restores muted preference and migrates the Phase 1 default volume', () => {
    expect(parseAmbientPreferences('{"enabled":true,"volume":0.35}')).toEqual({
      enabled: true,
      volume: 0.35,
    })
    expect(parseAmbientPreferences('{"enabled":true,"volume":0.7}')).toEqual({
      enabled: true,
      volume: DEFAULT_AMBIENT_VOLUME,
    })
  })
})
