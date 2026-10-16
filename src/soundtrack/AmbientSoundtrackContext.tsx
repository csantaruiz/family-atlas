import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { AmbientAudioEngine, type AmbientSnapshot } from './ambientAudioEngine'
import { AMBIENT_TRACKS, isActiveTrack, type ActiveTrack } from './ambientManifest'
import { readAmbientPreferences, writeAmbientPreferences } from './ambientPreferences'
import type { SoundtrackContext } from './context/resolveSoundtrackContext'
import { selectTrack } from './context/selectTrack'
import { TransitionScheduler } from './context/transitionScheduler'

/** Music level while narration or spoken content plays. */
export const NARRATION_DUCK_LEVEL = 0.25
/** Mark any narration <audio>/<video> in the page with this attribute to duck music automatically. */
export const NARRATION_ATTRIBUTE = 'data-atlas-narration'
const DEBUG_KEY = 'atlas-soundtrack-debug'

type AmbientSoundtrackValue = AmbientSnapshot & {
  /** The visitor's saved choice; music starts on their next interaction when true. */
  wantsSound: boolean
  toggleSound: () => void
  setVolume: (volume: number) => void
  /** Report what the visitor is exploring; the scheduler decides if and when the music changes. */
  reportContext: (context: SoundtrackContext, unsettled: boolean) => void
  /** Duck (0–1) or silence (0) music until the returned release is called. */
  hold: (reason: string, level: number) => () => void
  /** Duck music under spoken content; call the returned function when it ends. */
  duckForNarration: () => () => void
}

const AmbientSoundtrackContext = createContext<AmbientSoundtrackValue | null>(null)

const PLAYABLE_BY_ID = new Map(
  AMBIENT_TRACKS.filter(isActiveTrack).map((track): [string, ActiveTrack] => [track.id, track]),
)

function debugEnabled(): boolean {
  try {
    return localStorage.getItem(DEBUG_KEY) === '1'
  } catch {
    return false
  }
}

/** Counts overlapping narration sources so music restores only after the last one ends. */
function useNarrationDucking(hold: (reason: string, level: number) => () => void) {
  const countRef = useRef(0)
  const releaseRef = useRef<(() => void) | null>(null)

  const duckForNarration = useCallback(() => {
    countRef.current += 1
    releaseRef.current ??= hold('narration', NARRATION_DUCK_LEVEL)
    let done = false
    return () => {
      if (done) return
      done = true
      countRef.current = Math.max(0, countRef.current - 1)
      if (countRef.current === 0) {
        releaseRef.current?.()
        releaseRef.current = null
      }
    }
  }, [hold])

  useEffect(() => {
    const active = new Map<EventTarget, () => void>()
    const isNarration = (target: EventTarget | null): target is HTMLMediaElement =>
      target instanceof HTMLMediaElement && target.hasAttribute(NARRATION_ATTRIBUTE)
    const onPlaying = (event: Event) => {
      if (!isNarration(event.target) || active.has(event.target)) return
      active.set(event.target, duckForNarration())
    }
    const onStop = (event: Event) => {
      const release = active.get(event.target as EventTarget)
      if (!release) return
      active.delete(event.target as EventTarget)
      release()
    }
    // Media events do not bubble, so listen in the capture phase.
    document.addEventListener('playing', onPlaying, true)
    for (const type of ['pause', 'ended', 'emptied']) document.addEventListener(type, onStop, true)
    return () => {
      document.removeEventListener('playing', onPlaying, true)
      for (const type of ['pause', 'ended', 'emptied']) document.removeEventListener(type, onStop, true)
      for (const release of active.values()) release()
      active.clear()
    }
  }, [duckForNarration])

  return duckForNarration
}

export function AmbientSoundtrackProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState(readAmbientPreferences)
  const [engine] = useState(() => new AmbientAudioEngine(prefs.volume))
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot)
  const lastReasonRef = useRef<string | null>(null)

  const [scheduler] = useState(
    () =>
      new TransitionScheduler((trackId) => {
        const track = PLAYABLE_BY_ID.get(trackId)
        if (!track) return
        if (debugEnabled()) console.info('[soundtrack] now playing', trackId)
        engine.setTrack(track)
      }),
  )
  useEffect(() => () => scheduler.dispose(), [scheduler])

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

  const reportContext = useCallback(
    (context: SoundtrackContext, unsettled: boolean) => {
      const choice = selectTrack(context, scheduler.currentTrackId)
      if (debugEnabled() && !unsettled) {
        const reason = `${context.category}:${context.period ?? '-'}:${context.region ?? '-'}:${context.reason}`
        if (reason !== lastReasonRef.current) {
          lastReasonRef.current = reason
          console.info('[soundtrack] context', {
            ...context,
            ideal: choice.ideal.id,
            playing: choice.track.id,
            placeholder: choice.usingFallback,
          })
        }
      }
      scheduler.propose({ trackId: choice.track.id, unsettled, overview: context.overview })
      if (!unsettled) engine.prepare(choice.track)
    },
    [engine, scheduler],
  )

  const hold = useCallback((reason: string, level: number) => engine.hold(reason, level), [engine])
  const duckForNarration = useNarrationDucking(hold)

  const value = useMemo<AmbientSoundtrackValue>(
    () => ({
      ...snapshot,
      wantsSound: prefs.enabled,
      toggleSound,
      setVolume,
      reportContext,
      hold,
      duckForNarration,
    }),
    [duckForNarration, hold, prefs.enabled, reportContext, setVolume, snapshot, toggleSound],
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
