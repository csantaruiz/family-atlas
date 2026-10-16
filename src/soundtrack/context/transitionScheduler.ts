export type TransitionTiming = {
  /** A new choice must hold this long after the view settles before it plays. */
  settleMs: number
  /** Minimum time a track plays before another context can replace it. */
  minDwellMs: number
  /** Shorter dwell when returning to the main theme from a broad overview. */
  overviewDwellMs: number
  /** Going straight back to the previous track within this window needs a longer settle. */
  revisitWindowMs: number
  revisitSettleMs: number
}

export const DEFAULT_TRANSITION_TIMING: TransitionTiming = {
  settleMs: 2500,
  minDwellMs: 30_000,
  overviewDwellMs: 12_000,
  revisitWindowMs: 90_000,
  revisitSettleMs: 8000,
}

export type Proposal = {
  trackId: string
  /** Visitor is mid-gesture (dragging, zooming, coasting, camera moving). */
  unsettled: boolean
  /** The proposal is the broad-overview main theme. */
  overview: boolean
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

  propose({ trackId, unsettled, overview }: Proposal): void {
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
    const settle = revisit ? this.timing.revisitSettleMs : this.timing.settleMs
    const dwell = overview ? this.timing.overviewDwellMs : this.timing.minDwellMs
    const delay = Math.max(settle, this.lastCommitAt + dwell - now)

    this.cancelPending()
    const timer = this.clock.setTimeout(() => {
      this.pending = null
      this.commit(trackId)
    }, delay)
    this.pending = { trackId, timer }
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
