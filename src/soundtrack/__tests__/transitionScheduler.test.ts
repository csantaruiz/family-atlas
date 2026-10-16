import { afterEach, describe, expect, it, vi } from 'vitest'
import { TransitionScheduler } from '../context/transitionScheduler'

function createClock() {
  let now = 0
  const timers = new Map<number, { fireAt: number; fn: () => void }>()
  let nextId = 1
  return {
    now: () => now,
    setTimeout: (fn: () => void, ms: number) => {
      const id = nextId++
      timers.set(id, { fireAt: now + ms, fn })
      return id
    },
    clearTimeout: (id: number) => {
      timers.delete(id)
    },
    advance(ms: number) {
      now += ms
      for (const [id, timer] of [...timers.entries()]) {
        if (timer.fireAt <= now) {
          timers.delete(id)
          timer.fn()
        }
      }
    },
  }
}

describe('TransitionScheduler', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('commits the first proposal immediately and ignores unsettled changes', () => {
    const commits: string[] = []
    const clock = createClock()
    const scheduler = new TransitionScheduler((id) => commits.push(id), undefined, clock)

    scheduler.propose({ trackId: 'main', unsettled: false, overview: true })
    expect(commits).toEqual(['main'])

    scheduler.propose({ trackId: 'origins', unsettled: true, overview: false })
    clock.advance(10_000)
    expect(commits).toEqual(['main'])
  })

  it('waits for settle and minimum dwell before switching', () => {
    const commits: string[] = []
    const clock = createClock()
    const scheduler = new TransitionScheduler(
      (id) => commits.push(id),
      {
        settleMs: 1000,
        minDwellMs: 5000,
        overviewDwellMs: 2000,
        revisitWindowMs: 10_000,
        revisitSettleMs: 3000,
      },
      clock,
    )

    scheduler.propose({ trackId: 'main', unsettled: false, overview: true })
    scheduler.propose({ trackId: 'origins', unsettled: false, overview: false })
    clock.advance(999)
    expect(commits).toEqual(['main'])
    clock.advance(4001)
    expect(commits).toEqual(['main', 'origins'])
  })

  it('cancels a pending change when the visitor returns to the current track', () => {
    const commits: string[] = []
    const clock = createClock()
    const scheduler = new TransitionScheduler(
      (id) => commits.push(id),
      {
        settleMs: 1000,
        minDwellMs: 1000,
        overviewDwellMs: 1000,
        revisitWindowMs: 10_000,
        revisitSettleMs: 3000,
      },
      clock,
    )

    scheduler.propose({ trackId: 'main', unsettled: false, overview: true })
    scheduler.propose({ trackId: 'origins', unsettled: false, overview: false })
    clock.advance(500)
    scheduler.propose({ trackId: 'main', unsettled: false, overview: true })
    clock.advance(5000)
    expect(commits).toEqual(['main'])
  })

  it('disposes pending timers', () => {
    const commits: string[] = []
    const clock = createClock()
    const scheduler = new TransitionScheduler(
      (id) => commits.push(id),
      {
        settleMs: 1000,
        minDwellMs: 1000,
        overviewDwellMs: 1000,
        revisitWindowMs: 10_000,
        revisitSettleMs: 3000,
      },
      clock,
    )
    scheduler.propose({ trackId: 'main', unsettled: false, overview: true })
    scheduler.propose({ trackId: 'origins', unsettled: false, overview: false })
    scheduler.dispose()
    clock.advance(10_000)
    expect(commits).toEqual(['main'])
  })
})
