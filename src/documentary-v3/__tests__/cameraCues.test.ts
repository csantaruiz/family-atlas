import { describe, expect, it } from 'vitest'
import { findActiveCameraCue } from '../data/cameraCues'
import { isAfricaCenter, V3_PLACES } from '../data/gedcomPlaces'

describe('documentary-v3 camera cues', () => {
  it('starts at world overview away from Africa', () => {
    expect(findActiveCameraCue(0).id).toBe('world')
    expect(isAfricaCenter(findActiveCameraCue(0).center)).toBe(false)
  })

  it('restores Britain at 15 seconds over the British Isles', () => {
    const cue = findActiveCameraCue(15)
    expect(cue.id).toBe('britain')
    expect(cue.center).toEqual(V3_PLACES.britain)
    expect(cue.marker).toEqual(cue.center)
    expect(cue.label).toBe('Britain')
    expect(isAfricaCenter(cue.center)).toBe(false)
  })

  it('restores Cheshire at 30 seconds from GEDCOM', () => {
    const cue = findActiveCameraCue(30)
    expect(cue.id).toBe('cheshire')
    expect(cue.center).toEqual([-2.4, 53.2])
    expect(cue.marker).toEqual(cue.center)
    expect(cue.label).toBe('Cheshire')
  })

  it('restores Gawsworth at 42 seconds from GEDCOM', () => {
    const cue = findActiveCameraCue(42)
    expect(cue.id).toBe('gawsworth')
    expect(cue.center).toEqual([-2.2, 53.2])
    expect(cue.marker).toEqual(cue.center)
    expect(cue.label).toBe('Gawsworth')
  })

  it('uses [longitude, latitude] order', () => {
    const gawsworth = findActiveCameraCue(42)
    expect(gawsworth.marker?.[0]).toBeLessThan(0)
    expect(gawsworth.marker?.[1]).toBeGreaterThan(50)
  })

  it('never uses the Africa trap coordinate [0, 20]', () => {
    for (const cue of [findActiveCameraCue(0), findActiveCameraCue(15), findActiveCameraCue(30), findActiveCameraCue(42)]) {
      expect(cue.center).not.toEqual([0, 20])
      expect(isAfricaCenter(cue.center)).toBe(false)
    }
  })
})
