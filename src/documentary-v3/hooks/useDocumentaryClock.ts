import { useCallback, useEffect, useRef, useState } from 'react'
import { POC_DURATION_SECONDS } from '../data/cameraCues'

export function useDocumentaryClock() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [seekVersion, setSeekVersion] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const seekingRef = useRef(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => {
      if (seekingRef.current) return
      setCurrentTime(Math.min(audio.currentTime, POC_DURATION_SECONDS))
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  const play = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.currentTime >= POC_DURATION_SECONDS) {
      audio.currentTime = 0
      setCurrentTime(0)
      setSeekVersion((v) => v + 1)
    }
    await audio.play()
  }, [])

  const pause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    seekingRef.current = true
    const clamped = Math.max(0, Math.min(POC_DURATION_SECONDS, seconds))
    audio.currentTime = clamped
    setCurrentTime(clamped)
    setSeekVersion((v) => v + 1)
    requestAnimationFrame(() => {
      seekingRef.current = false
    })
  }, [])

  const restart = useCallback(async () => {
    seek(0)
    await play()
  }, [play, seek])

  return {
    audioRef,
    currentTime,
    duration: POC_DURATION_SECONDS,
    isPlaying,
    play,
    pause,
    seek,
    restart,
    seekVersion,
  }
}
