import { useCallback, useEffect, useRef, useState } from 'react'
import { DOCUMENTARY_PREROLL_MS } from '../data/playbackConfig'
import { NARRATION_AUDIO_SRC } from '../data/narrationSource'

export type NarrationClockState = {
  currentTimeMs: number
  durationMs: number
  isPlaying: boolean
  isReady: boolean
  hasEnded: boolean
  /** True during the silent opening hold before narration starts. */
  inPreroll: boolean
}

export function useNarrationClock(active: boolean, prerollMs = DOCUMENTARY_PREROLL_MS) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const prerollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inPrerollRef = useRef(false)
  const [state, setState] = useState<NarrationClockState>({
    currentTimeMs: 0,
    durationMs: 0,
    isPlaying: false,
    isReady: false,
    hasEnded: false,
    inPreroll: false,
  })

  const clearPrerollTimeout = useCallback(() => {
    if (prerollTimeoutRef.current != null) {
      clearTimeout(prerollTimeoutRef.current)
      prerollTimeoutRef.current = null
    }
  }, [])

  const beginNarration = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return
    inPrerollRef.current = false
    audio.currentTime = 0
    setState((prev) => ({ ...prev, inPreroll: false, currentTimeMs: 0 }))
    await audio.play()
  }, [])

  const schedulePreroll = useCallback(() => {
    clearPrerollTimeout()
    if (prerollMs <= 0) {
      void beginNarration()
      return
    }

    inPrerollRef.current = true
    setState((prev) => ({
      ...prev,
      inPreroll: true,
      isPlaying: true,
      currentTimeMs: 0,
      hasEnded: false,
    }))

    prerollTimeoutRef.current = setTimeout(() => {
      void beginNarration()
    }, prerollMs)
  }, [beginNarration, clearPrerollTimeout, prerollMs])

  useEffect(() => {
    const audio = new Audio(NARRATION_AUDIO_SRC)
    audio.preload = 'auto'
    audioRef.current = audio

    const sync = () => {
      if (inPrerollRef.current) return
      setState((prev) => ({
        currentTimeMs: audio.currentTime * 1000,
        durationMs: Number.isFinite(audio.duration) ? audio.duration * 1000 : prev.durationMs,
        isPlaying: !audio.paused && !audio.ended,
        isReady: Number.isFinite(audio.duration),
        hasEnded: audio.ended,
        inPreroll: false,
      }))
    }

    audio.addEventListener('loadedmetadata', sync)
    audio.addEventListener('durationchange', sync)
    audio.addEventListener('seeked', sync)
    audio.addEventListener('play', sync)
    audio.addEventListener('pause', sync)
    audio.addEventListener('ended', sync)
    audio.addEventListener('timeupdate', sync)

    return () => {
      clearPrerollTimeout()
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [clearPrerollTimeout])

  useEffect(() => {
    if (!active) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      return
    }

    const tick = () => {
      const audio = audioRef.current
      if (audio && !audio.paused && !inPrerollRef.current) {
        setState((prev) => ({
          ...prev,
          currentTimeMs: audio.currentTime * 1000,
          durationMs: Number.isFinite(audio.duration) ? audio.duration * 1000 : prev.durationMs,
          isPlaying: true,
          hasEnded: false,
          inPreroll: false,
        }))
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [active])

  const play = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return

    if (audio.currentTime > 0.01 || inPrerollRef.current) {
      if (inPrerollRef.current) return
      await audio.play()
      return
    }

    schedulePreroll()
  }, [schedulePreroll])

  const pause = useCallback(() => {
    clearPrerollTimeout()
    inPrerollRef.current = false
    audioRef.current?.pause()
    setState((prev) => ({
      ...prev,
      isPlaying: false,
      inPreroll: false,
      currentTimeMs: audioRef.current ? audioRef.current.currentTime * 1000 : prev.currentTimeMs,
    }))
  }, [clearPrerollTimeout])

  const toggle = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return
    if (inPrerollRef.current) {
      pause()
      return
    }
    if (audio.paused) {
      if (audio.currentTime <= 0.01) {
        schedulePreroll()
      } else {
        await audio.play()
      }
    } else {
      audio.pause()
    }
  }, [pause, schedulePreroll])

  const seek = useCallback(
    (timeMs: number) => {
      const audio = audioRef.current
      if (!audio) return

      clearPrerollTimeout()
      inPrerollRef.current = false

      const max = Number.isFinite(audio.duration) ? audio.duration * 1000 : timeMs
      const clamped = Math.max(0, Math.min(timeMs, max))
      audio.currentTime = clamped / 1000

      setState((prev) => ({
        ...prev,
        currentTimeMs: clamped,
        hasEnded: false,
        inPreroll: false,
        isPlaying: prev.isPlaying && clamped > 0,
      }))
    },
    [clearPrerollTimeout],
  )

  const reset = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    clearPrerollTimeout()
    inPrerollRef.current = false
    audio.pause()
    audio.currentTime = 0
    setState((prev) => ({
      ...prev,
      currentTimeMs: 0,
      isPlaying: false,
      hasEnded: false,
      inPreroll: false,
    }))
  }, [clearPrerollTimeout])

  return {
    audioRef,
    state,
    play,
    pause,
    toggle,
    seek,
    reset,
  }
}
