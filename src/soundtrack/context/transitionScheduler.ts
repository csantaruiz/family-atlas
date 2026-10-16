export type TransitionTiming = {
  /** Settled browsing must hold this long before a new choice plays. */
  settleMs: number
  /** Explicit person / place / event selections settle faster. */
  explicitSettleMs: number
  /** Minimum time a track plays before another browsing context can replace it. */
  minDwellMs: number
  /** Shorter dwell after an explicit selection so exploration feels responsive. */
  explicitDwellMs: number
  /** Shorter dwell when returning to the main theme from a broad overview. */
  overviewDwellMs: number
  /** Going straight back to the previous track within this window needs a longer settle. */
  revisitWindowMs: number
  revisitSettleMs: number
}

export const DEFAULT_TRANSITION_TIMING: TransitionTiming = {
  settleMs: 4000,
  explicitSettleMs: 1500,
  minDwellMs: 20_000,
  explicitDwellMs: 10_000,
  overviewDwellMs: 10_000,
  revisitWindowMs: 90_000,
  revisitSettleMs: 8000,
}

export type Proposal = {
  trackId: string
  /** Visitor is mid-gesture (dragging, zooming, coasting, camera moving). */
  unsettled: boolean
  /** The proposal is the broad-overview main theme. */
  overview: boolean
  /** Visitor explicitly selected a person, place, event, or route. */
  explicit: boolean
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

/**
 * Turns a stream of context proposals into infrequent, intentional track changes:
 * nothing changes mid-gesture, choices must settle, tracks get a minimum dwell,
 * and ping-ponging back to the previous track is damped.
 */
export class TransitionScheduler {
  private current: string | null = null
  private previous: string | null = null
  private lastCommitAt = -Infinity
  private pending: { trackId: string; timer: number } | null = null
  private readonly onCommit: (trackId: string) => void
  private readonly timing: TransitionTiming
  private readonly clock: Clock

  constructor(
    onCommit: (trackId: string) => void,
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

  propose({ trackId, unsettled, overview, explicit }: Proposal): void {
    if (this.current == null) {
      this.commit(trackId)
      return
    }
    if (unsettled || trackId === this.current) {
      this.cancelPending()
      return
    }
    if (this.pending?.trackId === trackId) return

    const now = this.clock.now()
    const revisit = trackId === this.previous && now - this.lastCommitAt < this.timing.revisitWindowMs
    const settle = revisit
      ? this.timing.revisitSettleMs
      : explicit
        ? this.timing.explicitSettleMs
        : this.timing.settleMs
    const dwell = overview
      ? this.timing.overviewDwellMs
      : explicit
        ? this.timing.explicitDwellMs
        : this.timing.minDwellMs
    const delay = Math.max(settle, this.lastCommitAt + dwell - now)

    this.cancelPending()
    const timer = this.clock.setTimeout(() => {
      this.pending = null
      this.commit(trackId)
    }, delay)
    this.pending = { trackId, timer }
  }

  /** Force an immediate commit (manual preview). */
  force(trackId: string): void {
    this.cancelPending()
    this.commit(trackId)
  }

  dispose(): void {
    this.cancelPending()
  }

  private commit(trackId: string): void {
    if (trackId === this.current) return
    this.previous = this.current
    this.current = trackId
    this.lastCommitAt = this.clock.now()
    this.onCommit(trackId)
  }

  private cancelPending(): void {
    if (!this.pending) return
    this.clock.clearTimeout(this.pending.timer)
    this.pending = null
  }
}
