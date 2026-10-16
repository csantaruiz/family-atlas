import {
  getSharedAudioContext,
  isWebAudioSupported,
  resumeSharedAudioContext,
} from '../audio/sharedAudioContext'
import { getMainTheme, type ActiveTrack } from './ambientManifest'

/** Default loop / long atmospheric crossfade (seconds). Context switches use shorter fades. */
export const AMBIENT_CROSSFADE_S = 4
/** Target crossfade for intentional context changes. */
export const CONTEXT_CROSSFADE_S = 0.6
const FADE_IN_FROM_SILENCE_S = 0.8
const FADE_TO_SILENCE_S = 0.35
const DUCK_FADE_S = 0.45
const RESTORE_FADE_S = 1.2
const VOLUME_SMOOTHING_S = 0.12
const MUTE_FADE_S = 0.08
/** Max wait for a cold asset before starting the fade anyway (avoids UI freeze). */
const READY_TIMEOUT_MS = 8000
const HAVE_FUTURE_DATA = 3

type Deck = {
  el: HTMLAudioElement
  gain: GainNode
  track: ActiveTrack | null
  loadedSrc: string | null
  primed: boolean
  stopTimer: number | null
}

export type TrackReadiness = 'idle' | 'loading' | 'ready' | 'playing'

export type TransitionDiagnostics = {
  /** Wall-clock performance.now() when setTrack was requested. */
  requestedAt: number | null
  /** When the destination deck became audible (gain ramp started). */
  audibleAt: number | null
  /** requestedAt → audibleAt in ms; null while pending. */
  selectionToAudibleMs: number | null
  crossfadeSec: number | null
  trackId: string | null
  /** True when the destination src was not already buffered on a deck. */
  coldLoad: boolean
  readiness: TrackReadiness
  lastCancelReason: string | null
  /** Rolling sample of recent selection→audible latencies (ms). */
  recentLatenciesMs: readonly number[]
}

export type AmbientSnapshot = {
  supported: boolean
  /** Visitor has switched sound on and the audio graph is unlocked. */
  enabled: boolean
  /** Music is actually sounding (enabled and not held silent). */
  audible: boolean
  volume: number
  /** The track chosen for the current context (plays once sound is audible). */
  trackId: string
  /** Currently audible deck track (may lag desired during a pending load). */
  audibleTrackId: string | null
  transition: TransitionDiagnostics
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

function emptyTransition(): TransitionDiagnostics {
  return {
    requestedAt: null,
    audibleAt: null,
    selectionToAudibleMs: null,
    crossfadeSec: null,
    trackId: null,
    coldLoad: false,
    readiness: 'idle',
    lastCancelReason: null,
    recentLatenciesMs: [],
  }
}

/**
 * App-wide ambient music. Two media elements stream tracks; all levels run through
 * Web Audio gain nodes so fades and ducking also work on iOS, where element volume is read-only.
 *
 * Graph: deck gains → master (visitor volume) → output (on/off + holds) → destination.
 *
 * Context crossfades wait until the destination element can play before starting the gain ramp,
 * so cold network loads are not mistaken for long crossfades.
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
  private desired: ActiveTrack = getMainTheme()
  private pendingCrossfadeSec = CONTEXT_CROSSFADE_S
  private holds = new Map<string, number>()
  private pauseTimer: number | null = null
  private listeners = new Set<() => void>()
  private snapshot: AmbientSnapshot
  /** Monotonic generation so stale async loads never override newer selections. */
  private playbackGeneration = 0
  private transition: TransitionDiagnostics = emptyTransition()
  private recentLatencies: number[] = []
  private warmSrcs = new Set<string>()

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
    this.reconcile(MUTE_FADE_S)
  }

  disable(): void {
    if (!this.enabled) return
    this.enabled = false
    this.reconcile(MUTE_FADE_S)
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

  /**
   * Crossfade to a track; a no-op when it is already the chosen one (never restarts a track).
   * Starts the audible gain ramp only after the destination asset is ready (or times out).
   */
  setTrack(track: ActiveTrack, crossfadeSec = CONTEXT_CROSSFADE_S, generation?: number): void {
    if (generation != null) {
      if (generation < this.playbackGeneration) {
        this.noteCancel('stale generation ignored')
        return
      }
      this.playbackGeneration = generation
    } else {
      this.playbackGeneration += 1
    }
    if (track.id === this.desired.id) {
      this.emit()
      return
    }

    const requestedAt = performance.now()
    const coldLoad = !this.isSrcWarm(track.src)
    this.desired = track
    this.pendingCrossfadeSec = Math.max(0.05, crossfadeSec)
    this.transition = {
      ...this.transition,
      requestedAt,
      audibleAt: null,
      selectionToAudibleMs: null,
      crossfadeSec: this.pendingCrossfadeSec,
      trackId: track.id,
      coldLoad,
      readiness: coldLoad ? 'loading' : 'ready',
      lastCancelReason: null,
    }
    this.emit()

    const current = this.decks[this.active]?.track
    if (this.sounding && current && current.id !== track.id) {
      void this.crossfadeTo(track, false, this.pendingCrossfadeSec, this.playbackGeneration, requestedAt)
    } else if (this.sounding && !current) {
      void this.crossfadeTo(track, false, this.pendingCrossfadeSec, this.playbackGeneration, requestedAt)
    }
  }

  /** Prefetch a likely next track on the idle deck so the next crossfade is warm. */
  prepare(track: ActiveTrack): void {
    if (!this.ensureGraph()) return
    if (track.id === this.desired.id) return
    const idle = this.decks[this.active === 0 ? 1 : 0]
    if (!idle || idle.stopTimer != null) return
    if (idle.loadedSrc === track.src && idle.el.readyState >= HAVE_FUTURE_DATA) {
      this.warmSrcs.add(track.src)
      return
    }
    if (!idle.el.paused && idle.track) return
    idle.track = null
    idle.loadedSrc = track.src
    idle.el.preload = 'auto'
    idle.el.src = track.src
    idle.el.load()
    const onReady = () => {
      this.warmSrcs.add(track.src)
      idle.el.removeEventListener('canplaythrough', onReady)
    }
    idle.el.addEventListener('canplaythrough', onReady, { once: true })
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
      this.reconcile(RESTORE_FADE_S)
    }
  }

  private isSrcWarm(src: string): boolean {
    if (this.warmSrcs.has(src)) return true
    return this.decks.some((deck) => deck.loadedSrc === src && deck.el.readyState >= HAVE_FUTURE_DATA)
  }

  private noteCancel(reason: string): void {
    this.transition = { ...this.transition, lastCancelReason: reason, readiness: 'idle' }
    this.emit()
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
    el.preload = 'auto'
    el.loop = false
    const gain = ctx.createGain()
    gain.gain.value = 0
    ctx.createMediaElementSource(el).connect(gain).connect(this.master!)
    const deck: Deck = { el, gain, track: null, loadedSrc: null, primed: false, stopTimer: null }
    el.addEventListener('timeupdate', () => this.onTimeUpdate(deck))
    el.addEventListener('ended', () => {
      if (deck === this.decks[this.active] && this.sounding) {
        void this.crossfadeTo(this.desired, true, undefined, this.playbackGeneration, performance.now())
      }
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
      if (deck.track?.id !== this.desired.id) {
        this.clearDeckTimer(deck)
        this.load(deck, this.desired)
        deck.gain.gain.cancelScheduledValues(this.ctx.currentTime)
        deck.gain.gain.value = this.desired.gain
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

  private load(deck: Deck, track: ActiveTrack, fromLoopStart = false): void {
    deck.track = track
    const startAt = fromLoopStart ? (track.playback.loopStartSec ?? 0) : 0
    if (deck.loadedSrc !== track.src) {
      deck.loadedSrc = track.src
      deck.el.preload = 'auto'
      deck.el.src = track.src
      deck.el.load()
      if (startAt > 0) {
        deck.el.addEventListener('loadedmetadata', () => this.seek(deck, startAt), { once: true })
      }
    } else {
      deck.el.preload = 'auto'
      this.seek(deck, startAt)
    }
  }

  private seek(deck: Deck, seconds: number): void {
    try {
      deck.el.currentTime = seconds
    } catch {
      // Not seekable yet — it is already at the start.
    }
  }

  private play(deck: Deck): void {
    void deck.el.play().catch(() => {
      // Autoplay refused (no gesture yet); the next gesture calls resumeIfInterrupted().
    })
  }

  private waitUntilPlayable(deck: Deck, generation: number): Promise<'ready' | 'timeout' | 'cancelled'> {
    if (deck.el.readyState >= HAVE_FUTURE_DATA) return Promise.resolve('ready')
    return new Promise((resolve) => {
      let settled = false
      const finish = (result: 'ready' | 'timeout' | 'cancelled') => {
        if (settled) return
        settled = true
        deck.el.removeEventListener('canplay', onReady)
        deck.el.removeEventListener('canplaythrough', onReady)
        deck.el.removeEventListener('playing', onReady)
        window.clearTimeout(timer)
        resolve(result)
      }
      const onReady = () => {
        if (generation !== this.playbackGeneration) {
          finish('cancelled')
          return
        }
        finish('ready')
      }
      deck.el.addEventListener('canplay', onReady)
      deck.el.addEventListener('canplaythrough', onReady)
      deck.el.addEventListener('playing', onReady)
      const timer = window.setTimeout(() => finish('timeout'), READY_TIMEOUT_MS)
      // Kick decoding/network without making it audible (gain is 0).
      this.play(deck)
    })
  }

  /** Only two decks exist, so at most the outgoing and incoming track ever overlap. */
  private async crossfadeTo(
    track: ActiveTrack,
    isLoop = false,
    crossfadeSec?: number,
    generation = this.playbackGeneration,
    requestedAt = performance.now(),
  ): Promise<void> {
    if (!this.ctx) return
    if (generation !== this.playbackGeneration) {
      this.noteCancel('superseded before crossfade start')
      return
    }

    const seconds = isLoop
      ? (track.playback.loopCrossfadeSec ?? AMBIENT_CROSSFADE_S)
      : (crossfadeSec ?? this.pendingCrossfadeSec ?? CONTEXT_CROSSFADE_S)
    const from = this.decks[this.active]
    const toIndex = this.active === 0 ? 1 : 0
    const to = this.decks[toIndex]
    this.clearDeckTimer(to)
    this.clearDeckTimer(from)
    this.load(to, track, isLoop)
    to.gain.gain.cancelScheduledValues(this.ctx.currentTime)
    to.gain.gain.value = 0

    this.transition = {
      ...this.transition,
      readiness: 'loading',
      trackId: track.id,
      crossfadeSec: seconds,
      requestedAt,
    }
    this.emit()

    const ready = await this.waitUntilPlayable(to, generation)
    if (generation !== this.playbackGeneration || this.desired.id !== track.id) {
      this.noteCancel('superseded while waiting for audio ready')
      return
    }
    if (ready === 'cancelled') {
      this.noteCancel('ready wait cancelled')
      return
    }

    const audibleAt = performance.now()
    const latency = Math.round(audibleAt - requestedAt)
    this.warmSrcs.add(track.src)
    this.recentLatencies = [...this.recentLatencies, latency].slice(-40)
    this.transition = {
      requestedAt,
      audibleAt,
      selectionToAudibleMs: latency,
      crossfadeSec: seconds,
      trackId: track.id,
      coldLoad: ready === 'timeout' || this.transition.coldLoad,
      readiness: 'playing',
      lastCancelReason: ready === 'timeout' ? 'ready timeout — fade started anyway' : null,
      recentLatenciesMs: this.recentLatencies,
    }

    if (!this.ctx) return
    this.play(to)
    this.ramp(to.gain.gain, track.gain, seconds)
    this.ramp(from.gain.gain, 0, seconds)
    from.stopTimer = window.setTimeout(() => {
      from.stopTimer = null
      if (generation !== this.playbackGeneration) return
      from.el.pause()
      // Keep the documentary theme warm on the idle deck after context switches.
      if (track.id !== getMainTheme().id) this.prepare(getMainTheme())
    }, seconds * 1000 + 100)
    this.active = toIndex
    this.emit()
  }

  private onTimeUpdate(deck: Deck): void {
    if (deck !== this.decks[this.active] || !this.sounding || !deck.track) return
    const end = deck.track.playback.loopEndSec ?? deck.el.duration
    if (!Number.isFinite(end)) return
    const overlap = deck.track.playback.loopCrossfadeSec ?? AMBIENT_CROSSFADE_S
    if (end - deck.el.currentTime <= overlap) {
      void this.crossfadeTo(this.desired, deck.track.id === this.desired.id, undefined, this.playbackGeneration)
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
    const audibleDeck = this.decks[this.active]
    return {
      supported: isWebAudioSupported(),
      enabled: this.enabled,
      audible: this.sounding,
      volume: this.volume,
      trackId: this.desired.id,
      audibleTrackId: audibleDeck?.track?.id ?? null,
      transition: this.transition,
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
      prev.trackId === next.trackId &&
      prev.audibleTrackId === next.audibleTrackId &&
      prev.transition.selectionToAudibleMs === next.transition.selectionToAudibleMs &&
      prev.transition.readiness === next.transition.readiness &&
      prev.transition.trackId === next.transition.trackId &&
      prev.transition.lastCancelReason === next.transition.lastCancelReason
    ) {
      return
    }
    this.snapshot = next
    for (const listener of this.listeners) listener()
  }
}
