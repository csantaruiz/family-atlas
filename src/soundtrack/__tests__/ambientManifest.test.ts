import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AMBIENT_TRACKS, tracksForEnvironment, type SoundtrackEnvironment } from '../ambientManifest'
import { DEFAULT_AMBIENT_PREFERENCES, parseAmbientPreferences } from '../ambientPreferences'

const ENVIRONMENTS: SoundtrackEnvironment[] = [
  'main',
  'mexico',
  'britain_ireland',
  'industrial_america',
  'wwii',
  'california',
]

describe('ambient soundtrack manifest', () => {
  it('only lists tracks with verified rights and a same-origin file that exists', () => {
    expect(AMBIENT_TRACKS.length).toBeGreaterThan(0)
    for (const track of AMBIENT_TRACKS) {
      expect(track.rights.license.trim()).not.toBe('')
      expect(track.rights.licenseUrl).toMatch(/^https:\/\//)
      expect(track.rights.source.trim()).not.toBe('')
      expect(track.rights.verifiedBy.trim()).not.toBe('')
      expect(track.rights.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(track.src.startsWith('/')).toBe(true)
      expect(existsSync(join(process.cwd(), 'public', track.src))).toBe(true)
      expect(track.gain).toBeGreaterThan(0)
      expect(track.gain).toBeLessThanOrEqual(1)
    }
  })

  it('has unique track ids', () => {
    const ids = AMBIENT_TRACKS.map((track) => track.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('falls back to the main theme for environments without tracks', () => {
    const main = tracksForEnvironment('main')
    expect(main.length).toBeGreaterThan(0)
    for (const environment of ENVIRONMENTS) {
      expect(tracksForEnvironment(environment).length).toBeGreaterThan(0)
    }
  })
})

describe('ambient preferences', () => {
  it('defaults to sound off', () => {
    expect(parseAmbientPreferences(null)).toEqual(DEFAULT_AMBIENT_PREFERENCES)
    expect(DEFAULT_AMBIENT_PREFERENCES.enabled).toBe(false)
  })

  it('restores saved values and clamps volume', () => {
    expect(parseAmbientPreferences('{"enabled":true,"volume":0.4}')).toEqual({ enabled: true, volume: 0.4 })
    expect(parseAmbientPreferences('{"enabled":true,"volume":7}').volume).toBe(1)
  })

  it('ignores corrupt storage', () => {
    expect(parseAmbientPreferences('not json')).toEqual(DEFAULT_AMBIENT_PREFERENCES)
    expect(parseAmbientPreferences('{"enabled":"yes"}').enabled).toBe(false)
  })
})
