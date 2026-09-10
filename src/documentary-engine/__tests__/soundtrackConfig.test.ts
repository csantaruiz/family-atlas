import { describe, expect, it } from 'vitest'
import { DEFAULT_DOCUMENTARY_SOUNDTRACK } from '../data/soundtrackConfig'

describe('documentary soundtrack config', () => {
  it('keeps music under narration with a reusable config shape', () => {
    const cfg = DEFAULT_DOCUMENTARY_SOUNDTRACK
    expect(cfg.src).toBe('/audio/documentary-score.mp3')
    expect(cfg.baseVolume).toBeGreaterThanOrEqual(0.12)
    expect(cfg.baseVolume).toBeLessThanOrEqual(0.2)
    expect(cfg.duckedVolume).toBeLessThan(cfg.baseVolume)
    expect(cfg.presenceVolume).toBeGreaterThan(cfg.duckedVolume)
    expect(cfg.fadeInMs).toBeGreaterThanOrEqual(3_000)
    expect(cfg.fadeInMs).toBeLessThanOrEqual(5_000)
    expect(cfg.fadeOutMs).toBeGreaterThanOrEqual(5_000)
    expect(cfg.fadeOutMs).toBeLessThanOrEqual(8_000)
  })
})
