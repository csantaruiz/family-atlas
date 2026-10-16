import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AMBIENT_TRACKS,
  getMainTheme,
  isActiveTrack,
  MAIN_THEME_ID,
  type AmbientTrack,
} from '../ambientManifest'
import {
  DEFAULT_AMBIENT_PREFERENCES,
  DEFAULT_AMBIENT_VOLUME,
  parseAmbientPreferences,
} from '../ambientPreferences'
import { SOUNDTRACK_CATEGORIES, type SoundtrackCategoryId } from '../context/categories'

const CATEGORY_IDS = SOUNDTRACK_CATEGORIES.map((category) => category.id)

describe('ambient soundtrack manifest', () => {
  it('keeps an active main theme with verified rights and a same-origin file', () => {
    const theme = getMainTheme()
    expect(theme.id).toBe(MAIN_THEME_ID)
    expect(theme.status).toBe('active')
    expect(theme.categories).toContain('main')
    expect(theme.rights.license.trim()).not.toBe('')
    expect(theme.rights.licenseUrl).toMatch(/^https:\/\//)
    expect(theme.rights.source.trim()).not.toBe('')
    expect(theme.rights.verifiedBy.trim()).not.toBe('')
    expect(theme.rights.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(theme.src.startsWith('/')).toBe(true)
    expect(existsSync(join(process.cwd(), 'public', theme.src))).toBe(true)
    expect(theme.gain).toBeGreaterThan(0)
    expect(theme.gain).toBeLessThanOrEqual(1)
  })

  it('only activates tracks that carry rights and exist on disk', () => {
    for (const track of AMBIENT_TRACKS) {
      if (isActiveTrack(track)) {
        expect(track.src.startsWith('/')).toBe(true)
        expect(existsSync(join(process.cwd(), 'public', track.src))).toBe(true)
        expect(track.rights).not.toBeNull()
        expect(track.gain).toBeGreaterThan(0)
        expect(track.gain).toBeLessThanOrEqual(1)
      } else {
        expect(track.src).toBeNull()
        expect(track.rights).toBeNull()
        expect(track.brief.trim().length).toBeGreaterThan(10)
      }
    }
  })

  it('has unique track ids and covers every soundtrack category', () => {
    const ids = AMBIENT_TRACKS.map((track) => track.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const category of CATEGORY_IDS) {
      expect(
        AMBIENT_TRACKS.some((track: AmbientTrack) => track.categories.includes(category)),
      ).toBe(true)
    }
  })
})

describe('ambient preferences', () => {
  it('defaults to sound off at a quiet volume', () => {
    expect(parseAmbientPreferences(null)).toEqual(DEFAULT_AMBIENT_PREFERENCES)
    expect(DEFAULT_AMBIENT_PREFERENCES.enabled).toBe(false)
    expect(DEFAULT_AMBIENT_VOLUME).toBeLessThanOrEqual(0.5)
  })

  it('restores muted preference and clamps volume', () => {
    expect(parseAmbientPreferences('{"enabled":true,"volume":0.35}')).toEqual({
      enabled: true,
      volume: 0.35,
    })
    expect(parseAmbientPreferences('{"enabled":true,"volume":7}').volume).toBe(1)
  })

  it('migrates the Phase 1 default volume to the quieter Phase 2 level', () => {
    expect(parseAmbientPreferences('{"enabled":true,"volume":0.7}')).toEqual({
      enabled: true,
      volume: DEFAULT_AMBIENT_VOLUME,
    })
  })

  it('ignores corrupt storage', () => {
    expect(parseAmbientPreferences('not json')).toEqual(DEFAULT_AMBIENT_PREFERENCES)
    expect(parseAmbientPreferences('{"enabled":"yes"}').enabled).toBe(false)
  })
})

describe('soundtrack categories', () => {
  it('defines the six atmospheric categories without family-specific names', () => {
    expect(CATEGORY_IDS).toEqual([
      'main',
      'origins',
      'migration',
      'everyday',
      'conflict',
      'legacy',
    ] satisfies SoundtrackCategoryId[])
    for (const category of SOUNDTRACK_CATEGORIES) {
      expect(category.label.toLowerCase()).not.toMatch(/santa|ruiz/)
      expect(category.usage.toLowerCase()).not.toMatch(/santa|ruiz/)
    }
  })
})
