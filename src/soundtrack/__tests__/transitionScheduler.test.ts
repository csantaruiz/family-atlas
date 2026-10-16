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
    const scheduler = new TransitionScheduler((payload) => commits.push(payload.trackId), undefined, clock)

    scheduler.propose({ trackId: 'main', unsettled: false, overview: true, explicit: false })
    expect(commits).toEqual(['main'])

    scheduler.propose({ trackId: 'mexico', unsettled: true, overview: false, explicit: false })
    clock.advance(10_000)
    expect(commits).toEqual(['main'])
  })

  it('commits explicit panel selections immediately', () => {
    const commits: Array<{ id: string; fade: number }> = []
    const clock = createClock()
    const scheduler = new TransitionScheduler(
      (payload) => commits.push({ id: payload.trackId, fade: payload.crossfadeSec }),
      undefined,
      clock,
    )

    scheduler.propose({ trackId: 'main', unsettled: false, overview: true, explicit: false })
    scheduler.propose({
      trackId: 'mexico',
      unsettled: false,
      overview: false,
      explicit: true,
      immediate: true,
      crossfadeSec: 0.6,
    })
    expect(commits.map((c) => c.id)).toEqual(['main', 'mexico'])
    expect(commits[1].fade).toBe(0.6)
  })

  it('restores underlying track immediately when an explicit panel closes', () => {
    const commits: string[] = []
    const clock = createClock()
    const scheduler = new TransitionScheduler((payload) => commits.push(payload.trackId), undefined, clock)

    scheduler.propose({ trackId: 'main', unsettled: false, overview: true, explicit: false })
    scheduler.propose({
      trackId: 'alfred',
      unsettled: false,
      overview: false,
      explicit: true,
      immediate: true,
    })
    scheduler.propose({
      trackId: 'main',
      unsettled: false,
      overview: true,
      explicit: false,
      immediate: true,
      crossfadeSec: 0.6,
    })
    expect(commits).toEqual(['main', 'alfred', 'main'])
  })

  it('settles briefly for browsing timeline changes', () => {
    const commits: string[] = []
    const clock = createClock()
    const scheduler = new TransitionScheduler(
      (payload) => commits.push(payload.trackId),
      {
        settleMs: 500,
        explicitSettleMs: 0,
        releaseSettleMs: 0,
        overviewSettleMs: 0,
      },
      clock,
    )

    scheduler.propose({ trackId: 'main', unsettled: false, overview: true, explicit: false })
    scheduler.propose({ trackId: 'britain', unsettled: false, overview: false, explicit: false })
    clock.advance(499)
    expect(commits).toEqual(['main'])
    clock.advance(1)
    expect(commits).toEqual(['main', 'britain'])
  })

  it('force-commits for manual preview and invalidates pending browsing', () => {
    const commits: string[] = []
    const clock = createClock()
    const scheduler = new TransitionScheduler((payload) => commits.push(payload.trackId), undefined, clock)
    scheduler.propose({ trackId: 'main', unsettled: false, overview: true, explicit: false })
    scheduler.propose({ trackId: 'britain', unsettled: false, overview: false, explicit: false })
    scheduler.force('preview')
    clock.advance(1000)
    expect(commits).toEqual(['main', 'preview'])
  })

  it('cancels stale pending commits when a newer proposal arrives', () => {
    const commits: string[] = []
    const clock = createClock()
    const scheduler = new TransitionScheduler(
      (payload) => commits.push(payload.trackId),
      {
        settleMs: 500,
        explicitSettleMs: 0,
        releaseSettleMs: 0,
        overviewSettleMs: 0,
      },
      clock,
    )

    scheduler.propose({ trackId: 'main', unsettled: false, overview: true, explicit: false })
    scheduler.propose({ trackId: 'a', unsettled: false, overview: false, explicit: false })
    scheduler.propose({ trackId: 'b', unsettled: false, overview: false, explicit: false })
    clock.advance(500)
    expect(commits).toEqual(['main', 'b'])
  })
})
