import {
  getSharedAudioContext,
  isWebAudioSupported,
  resumeSharedAudioContext,
} from '../audio/sharedAudioContext'
import {
  DEFAULT_SOUNDTRACK_ENVIRONMENT,
  tracksForEnvironment,
  type AmbientTrack,
  type SoundtrackEnvironment,
} from './ambientManifest'

export const AMBIENT_CROSSFADE_S = 4
const FADE_IN_FROM_SILENCE_S = 4
const FADE_TO_SILENCE_S = 1.2
const DUCK_FADE_S = 1.2
const VOLUME_SMOOTHING_S = 0.12

type Deck = {
  el: HTMLAudioElement
  gain: GainNode
  track: AmbientTrack | null
  loadedSrc: string | null
  primed: boolean
  stopTimer: number | null
}

export type AmbientSnapshot = {
  supported: boolean
  /** Visitor has switched sound on and the audio graph is unlocked. */
  enabled: boolean
  /** Music is actually sounding (enabled and not held silent). */
  audible: boolean
  volume: number
  environment: SoundtrackEnvironment
  trackId: string | null
}

let silentWavUrl: string | null = null

/** A 50 ms silent clip used to unlock media elements inside a gesture without fetching a track. */
function getSilentWavUrl(): string {
  if (silentWavUrl) return silentWavUrl
  const sampleRate = 8000
  const samples = 400
  const bytes = new Uint8Array(44 + samples * 2)
  const view = new DataView(bytes.buffer)
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + samples * 2, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, samples * 2, true)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  silentWavUrl = `data:audio/wav;base64,${btoa(binary)}`
  return silentWavUrl
}

/**
 * App-wide ambient music. Two media elements stream tracks; all levels run through
 * Web Audio gain nodes so fades and ducking also work on iOS, where element volume is read-only.
 *
 * Graph: deck gains → master (visitor volume) → output (on/off + holds) → destination.
 */
export class AmbientAudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private output: GainNode | null = null
  private decks: Deck[] = []
  private active = 0
  private enabled = false
  private sounding = false
  private volume: number
  private environment: SoundtrackEnvironment = DEFAULT_SOUNDTRACK_ENVIRONMENT
  private rotation = new Map<SoundtrackEnvironment, number>()
  private holds = new Map<string, number>()
  private pauseTimer: number | null = null
  private listeners = new Set<() => void>()
  private snapshot: AmbientSnapshot

  constructor(volume: number) {
    this.volume = volume
    this.snapshot = this.buildSnapshot()
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly getSnapshot = () => this.snapshot

  isEnabled(): boolean {
    return this.enabled
  }

  /** Call from a user gesture: unlocks the context and media elements, then starts if not held. */
  enable(): void {
    if (!this.ensureGraph()) return
    resumeSharedAudioContext()
    this.enabled = true
    this.primeDecks()
    this.reconcile(DUCK_FADE_S)
  }

  disable(): void {
    if (!this.enabled) return
    this.enabled = false
    this.reconcile(FADE_TO_SILENCE_S)
  }

  /** Re-unlock after iOS interruptions (calls, Siri) — call from any gesture. */
  resumeIfInterrupted(): void {
    if (!this.enabled || !this.ctx) return
    if (this.ctx.state !== 'running') resumeSharedAudioContext()
    const deck = this.decks[this.active]
    if (this.sounding && deck?.el.paused && deck.track) this.play(deck)
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume))
    if (this.ctx && this.master) this.ramp(this.master.gain, this.volume, VOLUME_SMOOTHING_S)
    this.emit()
  }

  /** Switch musical environment; a no-op when it is already playing (never restarts a track). */
  setEnvironment(environment: SoundtrackEnvironment): void {
    if (environment === this.environment) return
    this.environment = environment
    const current = this.decks[this.active]?.track
    if (this.sounding && current && !tracksForEnvironment(environment).includes(current)) {
      this.crossfadeTo(this.nextTrack(environment))
    }
    this.emit()
  }

  /**
   * Hold music at a fraction of its level (0 = silent and paused) until released.
   * Holds from different sources combine by taking the quietest.
   */
  hold(reason: string, level: number): () => void {
    this.holds.set(reason, Math.min(1, Math.max(0, level)))
    this.reconcile(level === 0 ? FADE_TO_SILENCE_S : DUCK_FADE_S)
    let released = false
    return () => {
      if (released) return
      released = true
      this.holds.delete(reason)
      this.reconcile(DUCK_FADE_S)
    }
  }

  private holdLevel(): number {
    let level = 1
    for (const value of this.holds.values()) level = Math.min(level, value)
    return level
  }

  private ensureGraph(): boolean {
    if (this.ctx) return true
    if (!isWebAudioSupported()) return false
    const ctx = getSharedAudioContext()
    if (!ctx) return false
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = this.volume
    this.output = ctx.createGain()
    this.output.gain.value = 0
    this.master.connect(this.output).connect(ctx.destination)
    this.decks = [this.createDeck(ctx), this.createDeck(ctx)]
    return true
  }

  private createDeck(ctx: AudioContext): Deck {
    const el = new Audio()
    el.preload = 'none'
    el.loop = false
    const gain = ctx.createGain()
    gain.gain.value = 0
    ctx.createMediaElementSource(el).connect(gain).connect(this.master!)
    const deck: Deck = { el, gain, track: null, loadedSrc: null, primed: false, stopTimer: null }
    el.addEventListener('timeupdate', () => this.onTimeUpdate(deck))
    el.addEventListener('ended', () => {
      if (deck === this.decks[this.active] && this.sounding) this.crossfadeTo(this.nextTrack(this.environment))
    })
    return deck
  }

  /** iOS lifts a media element's autoplay restriction after one gesture-initiated play(). */
  private primeDecks(): void {
    for (const deck of this.decks) {
      if (deck.primed || deck.loadedSrc) continue
      deck.primed = true
      deck.el.src = getSilentWavUrl()
      deck.el.play().then(
        () => {
          if (!deck.loadedSrc) deck.el.pause()
        },
        () => {
          deck.primed = false
        },
      )
    }
  }

  private reconcile(fadeS: number): void {
    if (!this.ctx || !this.output) {
      this.emit()
      return
    }
    const target = this.enabled ? this.holdLevel() : 0
    if (target > 0) {
      this.clearPauseTimer()
      const fromSilence = !this.sounding
      this.sounding = true
      const deck = this.decks[this.active]
      if (!deck.track) {
        this.load(deck, this.nextTrack(this.environment))
        deck.gain.gain.value = deck.track!.gain
      }
      if (deck.el.paused) this.play(deck)
      this.ramp(this.output.gain, target, fromSilence ? FADE_IN_FROM_SILENCE_S : fadeS)
    } else if (this.sounding) {
      this.sounding = false
      this.ramp(this.output.gain, 0, fadeS)
      this.clearPauseTimer()
      this.pauseTimer = window.setTimeout(() => {
        this.pauseTimer = null
        for (const deck of this.decks) {
          this.clearDeckTimer(deck)
          deck.el.pause()
          if (deck !== this.decks[this.active]) deck.gain.gain.value = 0
        }
      }, fadeS * 1000 + 60)
    }
    this.emit()
  }

  private nextTrack(environment: SoundtrackEnvironment): AmbientTrack {
    const tracks = tracksForEnvironment(environment)
    const index = this.rotation.get(environment) ?? 0
    this.rotation.set(environment, index + 1)
    return tracks[index % tracks.length]
  }

  private load(deck: Deck, track: AmbientTrack): void {
    deck.track = track
    if (deck.loadedSrc !== track.src) {
      deck.loadedSrc = track.src
      deck.el.preload = 'auto'
      deck.el.src = track.src
    } else {
      try {
        deck.el.currentTime = 0
      } catch {
        // Not seekable yet — it is already at the start.
      }
    }
  }

  private play(deck: Deck): void {
    void deck.el.play().catch(() => {
      // Autoplay refused (no gesture yet); the next gesture calls resumeIfInterrupted().
    })
  }

  private crossfadeTo(track: AmbientTrack): void {
    if (!this.ctx) return
    const from = this.decks[this.active]
    const toIndex = this.active === 0 ? 1 : 0
    const to = this.decks[toIndex]
    this.clearDeckTimer(to)
    this.clearDeckTimer(from)
    this.load(to, track)
    to.gain.gain.cancelScheduledValues(this.ctx.currentTime)
    to.gain.gain.value = 0
    this.play(to)
    this.ramp(to.gain.gain, track.gain, AMBIENT_CROSSFADE_S)
    this.ramp(from.gain.gain, 0, AMBIENT_CROSSFADE_S)
    from.stopTimer = window.setTimeout(() => {
      from.stopTimer = null
      from.el.pause()
    }, AMBIENT_CROSSFADE_S * 1000 + 100)
    this.active = toIndex
    this.emit()
  }

  private onTimeUpdate(deck: Deck): void {
    if (deck !== this.decks[this.active] || !this.sounding || !deck.track) return
    const end = deck.track.loopEndSec ?? deck.el.duration
    if (!Number.isFinite(end)) return
    if (end - deck.el.currentTime <= AMBIENT_CROSSFADE_S) {
      this.crossfadeTo(this.nextTrack(this.environment))
    }
  }

  private ramp(param: AudioParam, target: number, seconds: number): void {
    const ctx = this.ctx
    if (!ctx) return
    const now = ctx.currentTime
    param.cancelScheduledValues(now)
    param.setValueAtTime(param.value, now)
    if (seconds <= 0) param.setValueAtTime(target, now)
    else param.linearRampToValueAtTime(target, now + seconds)
  }

  private clearDeckTimer(deck: Deck): void {
    if (deck.stopTimer != null) {
      window.clearTimeout(deck.stopTimer)
      deck.stopTimer = null
    }
  }

  private clearPauseTimer(): void {
    if (this.pauseTimer != null) {
      window.clearTimeout(this.pauseTimer)
      this.pauseTimer = null
    }
  }

  private buildSnapshot(): AmbientSnapshot {
    return {
      supported: isWebAudioSupported(),
      enabled: this.enabled,
      audible: this.sounding,
      volume: this.volume,
      environment: this.environment,
      trackId: this.decks[this.active]?.track?.id ?? null,
    }
  }

  private emit(): void {
    const next = this.buildSnapshot()
    const prev = this.snapshot
    if (
      prev.supported === next.supported &&
      prev.enabled === next.enabled &&
      prev.audible === next.audible &&
      prev.volume === next.volume &&
      prev.environment === next.environment &&
      prev.trackId === next.trackId
    ) {
      return
    }
    this.snapshot = next
    for (const listener of this.listeners) listener()
  }
}
