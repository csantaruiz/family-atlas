import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { AmbientAudioEngine, type AmbientSnapshot } from './ambientAudioEngine'
import type { SoundtrackEnvironment } from './ambientManifest'
import { readAmbientPreferences, writeAmbientPreferences } from './ambientPreferences'

type AmbientSoundtrackValue = AmbientSnapshot & {
  /** The visitor's saved choice; music starts on their next interaction when true. */
  wantsSound: boolean
  toggleSound: () => void
  setVolume: (volume: number) => void
  setEnvironment: (environment: SoundtrackEnvironment) => void
  /** Duck (0–1) or silence (0) music until the returned release is called. */
  hold: (reason: string, level: number) => () => void
}

const AmbientSoundtrackContext = createContext<AmbientSoundtrackValue | null>(null)

export function AmbientSoundtrackProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState(readAmbientPreferences)
  const [engine] = useState(() => new AmbientAudioEngine(prefs.volume))
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot)

  useEffect(() => {
    writeAmbientPreferences(prefs)
  }, [prefs])

  // Browsers only start audio from a gesture, so a saved "on" resumes at the next interaction.
  useEffect(() => {
    if (!prefs.enabled) return
    const onGesture = () => {
      if (engine.isEnabled()) engine.resumeIfInterrupted()
      else engine.enable()
    }
    window.addEventListener('pointerdown', onGesture, true)
    window.addEventListener('keydown', onGesture, true)
    return () => {
      window.removeEventListener('pointerdown', onGesture, true)
      window.removeEventListener('keydown', onGesture, true)
    }
  }, [engine, prefs.enabled])

  useEffect(() => {
    let release: (() => void) | null = null
    const sync = () => {
      if (document.visibilityState === 'hidden') {
        release ??= engine.hold('hidden', 0)
      } else {
        release?.()
        release = null
      }
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      release?.()
    }
  }, [engine])

  // enable() must run in the click's call stack (autoplay unlock), not inside a state updater.
  const toggleSound = useCallback(() => {
    const enabled = !prefs.enabled
    if (enabled) engine.enable()
    else engine.disable()
    setPrefs((prev) => ({ ...prev, enabled }))
  }, [engine, prefs.enabled])

  const setVolume = useCallback(
    (volume: number) => {
      engine.setVolume(volume)
      const saved = engine.getSnapshot().volume
      setPrefs((prev) => ({ ...prev, volume: saved }))
    },
    [engine],
  )

  const setEnvironment = useCallback(
    (environment: SoundtrackEnvironment) => engine.setEnvironment(environment),
    [engine],
  )

  const hold = useCallback((reason: string, level: number) => engine.hold(reason, level), [engine])

  const value = useMemo<AmbientSoundtrackValue>(
    () => ({
      ...snapshot,
      wantsSound: prefs.enabled,
      toggleSound,
      setVolume,
      setEnvironment,
      hold,
    }),
    [hold, prefs.enabled, setEnvironment, setVolume, snapshot, toggleSound],
  )

  return <AmbientSoundtrackContext.Provider value={value}>{children}</AmbientSoundtrackContext.Provider>
}

export function useAmbientSoundtrack(): AmbientSoundtrackValue {
  const ctx = useContext(AmbientSoundtrackContext)
  if (!ctx) throw new Error('useAmbientSoundtrack must be used within AmbientSoundtrackProvider')
  return ctx
}

/** Keep ambient music at `level` while mounted with a non-null level (null releases the hold). */
export function useAmbientHold(reason: string, level: number | null): void {
  const { hold } = useAmbientSoundtrack()
  useEffect(() => {
    if (level == null) return
    return hold(reason, level)
  }, [hold, level, reason])
}
