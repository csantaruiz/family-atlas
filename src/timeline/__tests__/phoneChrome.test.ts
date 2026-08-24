import { describe, expect, it } from 'vitest'
import { phoneTimelineClassName, phoneTimelinePhase } from '../phoneChrome'

describe('phone Timeline chrome', () => {
  it('keeps desktop mode above the phone breakpoint', () => {
    expect(phoneTimelinePhase(false, true)).toBe('desktop')
    expect(phoneTimelineClassName('desktop')).toBe('')
  })

  it('starts in a cinematic arrival state, then collapses after exploring', () => {
    expect(phoneTimelinePhase(true, false)).toBe('arrival')
    expect(phoneTimelinePhase(true, true)).toBe('exploring')
    expect(phoneTimelineClassName('arrival')).toContain('timeline-phone--arrival')
    expect(phoneTimelineClassName('exploring')).toContain('timeline-phone--exploring')
  })
})
