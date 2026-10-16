export const AMBIENT_PREFS_KEY = 'atlas-ambient-sound-v1'

export type AmbientPreferences = {
  enabled: boolean
  volume: number
}

/** Quiet museum-like level; track gain (~0.35) brings the effective output lower still. */
export const DEFAULT_AMBIENT_VOLUME = 0.4

export const DEFAULT_AMBIENT_PREFERENCES: AmbientPreferences = {
  enabled: false,
  volume: DEFAULT_AMBIENT_VOLUME,
}

/** Phase 1 shipped 0.7; treat that stored default as the quieter Phase 2 level. */
const LEGACY_DEFAULT_VOLUME = 0.7

export function parseAmbientPreferences(raw: string | null): AmbientPreferences {
  if (!raw) return DEFAULT_AMBIENT_PREFERENCES
  try {
    const value = JSON.parse(raw) as Partial<AmbientPreferences>
    let volume =
      typeof value.volume === 'number' && Number.isFinite(value.volume)
        ? Math.min(1, Math.max(0, value.volume))
        : DEFAULT_AMBIENT_PREFERENCES.volume
    if (volume === LEGACY_DEFAULT_VOLUME) volume = DEFAULT_AMBIENT_VOLUME
    return { enabled: value.enabled === true, volume }
  } catch {
    return DEFAULT_AMBIENT_PREFERENCES
  }
}

export function readAmbientPreferences(): AmbientPreferences {
  try {
    return parseAmbientPreferences(localStorage.getItem(AMBIENT_PREFS_KEY))
  } catch {
    return DEFAULT_AMBIENT_PREFERENCES
  }
}

export function writeAmbientPreferences(prefs: AmbientPreferences): void {
  try {
    localStorage.setItem(AMBIENT_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Private mode / quota — preference just won't persist.
  }
}
