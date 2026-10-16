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

    scheduler.propose({ trackId: 'main', unsettled: false, overview: true, explicit: false })
    expect(commits).toEqual(['main'])

    scheduler.propose({ trackId: 'mexico', unsettled: true, overview: false, explicit: false })
    clock.advance(10_000)
    expect(commits).toEqual(['main'])
  })

  it('switches faster for explicit selections than for browsing', () => {
    const commits: string[] = []
    const clock = createClock()
    const scheduler = new TransitionScheduler(
      (id) => commits.push(id),
      {
        settleMs: 4000,
        explicitSettleMs: 1000,
        minDwellMs: 5000,
        explicitDwellMs: 2000,
        overviewDwellMs: 2000,
        revisitWindowMs: 10_000,
        revisitSettleMs: 3000,
      },
      clock,
    )

    scheduler.propose({ trackId: 'main', unsettled: false, overview: true, explicit: false })
    scheduler.propose({ trackId: 'mexico', unsettled: false, overview: false, explicit: true })
    clock.advance(999)
    expect(commits).toEqual(['main'])
    clock.advance(1001)
    expect(commits).toEqual(['main', 'mexico'])
  })

  it('force-commits for manual preview', () => {
    const commits: string[] = []
    const clock = createClock()
    const scheduler = new TransitionScheduler((id) => commits.push(id), undefined, clock)
    scheduler.propose({ trackId: 'main', unsettled: false, overview: true, explicit: false })
    scheduler.force('britain')
    expect(commits).toEqual(['main', 'britain'])
  })
})
