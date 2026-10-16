export type TransitionTiming = {
  /** Settled browsing must hold this long before a new choice plays. */
  settleMs: number
  /** Explicit person / place / event selections settle this long (0 = immediate). */
  explicitSettleMs: number
  /** Closing / releasing an explicit panel restores the underlying track after this. */
  releaseSettleMs: number
  /** Returning to the Atlas overview uses this settle before commit. */
  overviewSettleMs: number
}

/** Target Phase 2.2 timings — settle delays only; crossfade duration lives on the engine. */
export const DEFAULT_TRANSITION_TIMING: TransitionTiming = {
  settleMs: 500,
  explicitSettleMs: 0,
  releaseSettleMs: 0,
  overviewSettleMs: 0,
}

export type Proposal = {
  trackId: string
  /** Visitor is mid-gesture (dragging, zooming, coasting, camera moving). */
  unsettled: boolean
  /** The proposal is the broad-overview main theme. */
  overview: boolean
  /** Visitor explicitly selected a person, place, event, or route. */
  explicit: boolean
  /**
   * Panel open/close/switch or other intentional navigation — skip browsing settle
   * and cancel any pending browsing proposal immediately.
   */
  immediate?: boolean
  /** Desired crossfade once committed (engine uses this). */
  crossfadeSec?: number
}

export type CommitPayload = {
  trackId: string
  crossfadeSec: number
  generation: number
}

type Clock = {
  now: () => number
  setTimeout: (fn: () => void, ms: number) => number
  clearTimeout: (id: number) => void
}

const browserClock: Clock = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (id) => window.clearTimeout(id),
}

export type SchedulerStatus = 'idle' | 'waiting' | 'committed'

const DEFAULT_CROSSFADE_SEC = 0.6

/**
 * Turns a stream of context proposals into intentional track changes.
 * Explicit panel selections and releases commit promptly; browsing waits briefly to settle.
 * Older pending timers are cancelled so only the latest authoritative proposal can commit.
 */
export class TransitionScheduler {
  private current: string | null = null
  private pending: { trackId: string; timer: number; generation: number; crossfadeSec: number } | null =
    null
  private generation = 0
  private wasExplicit = false
  private readonly onCommit: (payload: CommitPayload) => void
  private readonly timing: TransitionTiming
  private readonly clock: Clock

  constructor(
    onCommit: (payload: CommitPayload) => void,
    timing: TransitionTiming = DEFAULT_TRANSITION_TIMING,
    clock: Clock = browserClock,
  ) {
    this.onCommit = onCommit
    this.timing = timing
    this.clock = clock
  }

  get currentTrackId(): string | null {
    return this.current
  }

  get status(): SchedulerStatus {
    if (this.pending) return 'waiting'
    if (this.current) return 'committed'
    return 'idle'
  }

  get pendingTrackId(): string | null {
    return this.pending?.trackId ?? null
  }

  get currentGeneration(): number {
    return this.generation
  }

  propose({ trackId, unsettled, overview, explicit, immediate, crossfadeSec }: Proposal): void {
    const fade = crossfadeSec ?? this.defaultCrossfade(explicit, overview, immediate)
    if (this.current == null) {
      this.commit(trackId, fade)
      this.wasExplicit = explicit
      return
    }
    if (unsettled || trackId === this.current) {
      this.cancelPending()
      this.wasExplicit = explicit
      return
    }
    if (this.pending?.trackId === trackId) return

    const releasing = this.wasExplicit && !explicit
    const delay = immediate || explicit || releasing
      ? explicit || releasing
        ? this.timing.explicitSettleMs || this.timing.releaseSettleMs
        : 0
      : overview
        ? this.timing.overviewSettleMs || this.timing.settleMs
        : this.timing.settleMs

    this.cancelPending()
    const generation = ++this.generation
    if (delay <= 0) {
      this.commit(trackId, fade, generation)
      this.wasExplicit = explicit
      return
    }

    const timer = this.clock.setTimeout(() => {
      if (this.pending?.generation !== generation) return
      this.pending = null
      this.commit(trackId, fade, generation)
      this.wasExplicit = explicit
    }, delay)
    this.pending = { trackId, timer, generation, crossfadeSec: fade }
    this.wasExplicit = explicit
  }

  /** Force an immediate commit (manual preview / restore-from-preview). */
  force(trackId: string, crossfadeSec = DEFAULT_CROSSFADE_SEC): void {
    this.cancelPending()
    this.commit(trackId, crossfadeSec)
  }

  /** Invalidate in-flight proposals (e.g. provider unmount). */
  invalidate(): void {
    this.generation += 1
    this.cancelPending()
  }

  dispose(): void {
    this.invalidate()
  }

  private defaultCrossfade(explicit: boolean, overview: boolean, immediate?: boolean): number {
    if (overview && !explicit) return 1
    if (explicit || immediate) return 0.6
    return 0.6
  }

  private commit(trackId: string, crossfadeSec: number, generation = ++this.generation): void {
    if (trackId === this.current) return
    this.current = trackId
    this.onCommit({ trackId, crossfadeSec, generation })
  }

  private cancelPending(): void {
    if (!this.pending) return
    this.clock.clearTimeout(this.pending.timer)
    this.pending = null
  }
}
