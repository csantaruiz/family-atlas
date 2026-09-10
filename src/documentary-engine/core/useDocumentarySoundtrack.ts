import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_DOCUMENTARY_SOUNDTRACK,
  SOUNDTRACK_MUTE_SESSION_KEY,
  type DocumentarySoundtrackConfig,
} from '../data/soundtrackConfig'

export type SoundtrackPresence = 'bed' | 'ducked' | 'presence'

type FadeKind = 'in' | 'out' | 'level'

type UseDocumentarySoundtrackOptions = {
  config?: DocumentarySoundtrackConfig
  /** When false, score must not keep playing (welcome / complete). */
  enabled: boolean
}

function readSessionMuted(): boolean {
  try {
    return sessionStorage.getItem(SOUNDTRACK_MUTE_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function writeSessionMuted(muted: boolean) {
  try {
    sessionStorage.setItem(SOUNDTRACK_MUTE_SESSION_KEY, muted ? '1' : '0')
  } catch {
    // Ignore quota / private-mode failures.
  }
}

/**
 * Documentary-bound soundtrack layer.
 * Follows engine lifecycle; start() must be called from a user gesture (Begin Documentary).
 */
export function useDocumentarySoundtrack({
  config = DEFAULT_DOCUMENTARY_SOUNDTRACK,
  enabled,
}: UseDocumentarySoundtrackOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fadeRafRef = useRef<number | null>(null)
  const softLoopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const targetVolumeRef = useRef(config.baseVolume)
  const presenceRef = useRef<SoundtrackPresence>('bed')
  const mutedRef = useRef(readSessionMuted())
  const startedRef = useRef(false)
  const outroActiveRef = useRef(false)
  const configRef = useRef(config)
  configRef.current = config

  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const [muted, setMuted] = useState(() => mutedRef.current)
  const [durationMs, setDurationMs] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  const cancelFade = useCallback(() => {
    if (fadeRafRef.current != null) {
      cancelAnimationFrame(fadeRafRef.current)
      fadeRafRef.current = null
    }
  }, [])

  const clearSoftLoop = useCallback(() => {
    if (softLoopTimerRef.current != null) {
      clearTimeout(softLoopTimerRef.current)
      softLoopTimerRef.current = null
    }
  }, [])

  const resolveTargetForPresence = useCallback((presence: SoundtrackPresence) => {
    const cfg = configRef.current
    if (presence === 'ducked') return cfg.duckedVolume
    if (presence === 'presence') return cfg.presenceVolume
    return cfg.baseVolume
  }, [])

  const fadeTo = useCallback(
    (toVolume: number, durationMsFade: number, kind: FadeKind = 'level') => {
      const audio = audioRef.current
      if (!audio) return Promise.resolve()

      cancelFade()
      const from = audio.volume
      const to = mutedRef.current ? 0 : toVolume
      targetVolumeRef.current = toVolume

      if (durationMsFade <= 0 || Math.abs(from - to) < 0.004) {
        audio.volume = to
        return Promise.resolve()
      }

      const startedAt = performance.now()
      return new Promise<void>((resolve) => {
        const tick = (now: number) => {
          const t = Math.min(1, (now - startedAt) / durationMsFade)
          const eased =
            kind === 'in' ? t * t : kind === 'out' ? 1 - (1 - t) * (1 - t) : t
          audio.volume = from + (to - from) * eased
          if (t < 1) {
            fadeRafRef.current = requestAnimationFrame(tick)
          } else {
            fadeRafRef.current = null
            audio.volume = to
            resolve()
          }
        }
        fadeRafRef.current = requestAnimationFrame(tick)
      })
    },
    [cancelFade],
  )

  const fadeToRef = useRef(fadeTo)
  fadeToRef.current = fadeTo
  const resolvePresenceRef = useRef(resolveTargetForPresence)
  resolvePresenceRef.current = resolveTargetForPresence

  // Keep one Audio element for the score lifetime (src changes only).
  useEffect(() => {
    const audio = new Audio(config.src)
    audio.preload = 'auto'
    audio.loop = false
    audio.volume = 0
    audioRef.current = audio

    const onMeta = () => {
      if (Number.isFinite(audio.duration)) {
        setDurationMs(audio.duration * 1000)
      }
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => {
      setIsPlaying(false)
      if (!startedRef.current || outroActiveRef.current || !enabledRef.current) return
      const cfg = configRef.current
      clearSoftLoop()
      softLoopTimerRef.current = setTimeout(() => {
        softLoopTimerRef.current = null
        const el = audioRef.current
        if (!el || !startedRef.current || outroActiveRef.current) return
        el.currentTime = 0
        el.volume = 0
        void el.play().then(() => {
          void fadeToRef.current(
            resolvePresenceRef.current(presenceRef.current),
            cfg.softLoopFadeInMs,
            'in',
          )
        })
      }, cfg.softLoopGapMs)
    }

    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('durationchange', onMeta)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)

    return () => {
      cancelFade()
      clearSoftLoop()
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      audioRef.current = null
    }
  }, [cancelFade, clearSoftLoop, config.src])

  const start = useCallback(async () => {
    const audio = audioRef.current
    // Do NOT gate on React `enabled` — begin() runs in the click stack before
    // phase flips to playing, so enabled is still false in that closure.
    if (!audio) return

    const cfg = configRef.current
    clearSoftLoop()
    cancelFade()
    outroActiveRef.current = false
    startedRef.current = true
    presenceRef.current = 'bed'
    try {
      audio.currentTime = 0
    } catch {
      // Ignore seek-before-metadata errors.
    }
    audio.volume = 0

    try {
      // play() must run in the user-gesture stack (before long awaits).
      const playAttempt = audio.play()
      await playAttempt
      await fadeTo(cfg.baseVolume, cfg.fadeInMs, 'in')
      if (!outroActiveRef.current && startedRef.current) {
        presenceRef.current = 'ducked'
        await fadeTo(cfg.duckedVolume, 1_600, 'level')
      }
    } catch (error) {
      startedRef.current = false
      console.warn('[documentary-soundtrack] play blocked or failed', error)
    }
  }, [cancelFade, clearSoftLoop, fadeTo])

  const pause = useCallback(() => {
    clearSoftLoop()
    cancelFade()
    audioRef.current?.pause()
  }, [cancelFade, clearSoftLoop])

  const resume = useCallback(async () => {
    const audio = audioRef.current
    if (!audio || !startedRef.current || outroActiveRef.current) return
    try {
      await audio.play()
      await fadeTo(resolveTargetForPresence(presenceRef.current), 900, 'level')
    } catch (error) {
      console.warn('[documentary-soundtrack] resume failed', error)
    }
  }, [fadeTo, resolveTargetForPresence])

  const setPresence = useCallback(
    (presence: SoundtrackPresence) => {
      if (outroActiveRef.current) return
      if (presenceRef.current === presence) return
      presenceRef.current = presence
      if (!startedRef.current || audioRef.current?.paused) return
      void fadeTo(resolveTargetForPresence(presence), 1_400, 'level')
    },
    [fadeTo, resolveTargetForPresence],
  )

  const beginOutro = useCallback(async () => {
    const audio = audioRef.current
    if (!audio || !startedRef.current) return
    const cfg = configRef.current

    clearSoftLoop()
    outroActiveRef.current = true
    presenceRef.current = 'presence'

    try {
      if (audio.paused) await audio.play()
    } catch {
      // Continue fade toward silence even if play fails.
    }

    await fadeTo(cfg.presenceVolume, 1_200, 'level')
    await fadeTo(0, cfg.fadeOutMs, 'out')
    audio.pause()
    try {
      audio.currentTime = 0
    } catch {
      // ignore
    }
    startedRef.current = false
    outroActiveRef.current = false
    setIsPlaying(false)
  }, [clearSoftLoop, fadeTo])

  const stop = useCallback(
    async (fadeMs?: number) => {
      const audio = audioRef.current
      const ms = fadeMs ?? configRef.current.exitFadeMs
      clearSoftLoop()
      outroActiveRef.current = true
      startedRef.current = false
      if (!audio) return
      await fadeTo(0, ms, 'out')
      audio.pause()
      try {
        audio.currentTime = 0
      } catch {
        // ignore
      }
      outroActiveRef.current = false
      setIsPlaying(false)
    },
    [clearSoftLoop, fadeTo],
  )

  const reset = useCallback(() => {
    clearSoftLoop()
    cancelFade()
    outroActiveRef.current = false
    startedRef.current = false
    presenceRef.current = 'bed'
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    try {
      audio.currentTime = 0
    } catch {
      // ignore
    }
    audio.volume = 0
    setIsPlaying(false)
  }, [cancelFade, clearSoftLoop])

  const setMutedPreference = useCallback(
    (next: boolean) => {
      mutedRef.current = next
      setMuted(next)
      writeSessionMuted(next)
      const audio = audioRef.current
      if (!audio) return
      if (next) {
        audio.volume = 0
      } else if (startedRef.current && !audio.paused) {
        audio.volume = resolveTargetForPresence(presenceRef.current)
      }
    },
    [resolveTargetForPresence],
  )

  const toggleMute = useCallback(() => {
    setMutedPreference(!mutedRef.current)
  }, [setMutedPreference])

  useEffect(() => {
    if (!enabled && startedRef.current) {
      void stop()
    }
  }, [enabled, stop])

  return {
    muted,
    isPlaying,
    durationMs,
    start,
    pause,
    resume,
    stop,
    reset,
    beginOutro,
    setPresence,
    toggleMute,
    setMuted: setMutedPreference,
  }
}
