import { describe, expect, it } from 'vitest'
import {
  conflictClusterZoomSpan,
  foldSpatiallyConflictingEvents,
} from './clustering'
import type { FamilyEvent } from '../types'

function fakeEvent(id: string, year: number, name: string): FamilyEvent {
  return {
    kind: 'birth',
    year,
    person: {
      id,
      name,
      sex: 'M',
      generation: 1,
      birthYear: year,
      deathYear: null,
      birthPlace: null,
      deathPlace: null,
      places: [],
      focus: false,
    },
    importance: 4,
    detail: '',
  }
}

describe('foldSpatiallyConflictingEvents', () => {
  it('folds nearby markers into a count cluster', () => {
    const placed = [
      { event: fakeEvent('a', 1933, 'Story'), x: 400, y: 200 },
      { event: fakeEvent('b', 1934, 'Move A'), x: 430, y: 180 },
      { event: fakeEvent('c', 1936, 'Move B'), x: 455, y: 160 },
      { event: fakeEvent('d', 1980, 'Alone'), x: 900, y: 200 },
    ]

    const { events, clusters } = foldSpatiallyConflictingEvents(placed, 80, 1400, 700)
    expect(clusters).toHaveLength(1)
    expect(clusters[0].count).toBe(3)
    expect(clusters[0].from).toBe(1933)
    expect(clusters[0].to).toBe(1936)
    expect(events).toHaveLength(1)
    expect(events[0].event.person.id).toBe('d')
  })

  it('leaves individuals alone when deeply zoomed', () => {
    const placed = [
      { event: fakeEvent('a', 1934, 'Move A'), x: 400, y: 200 },
      { event: fakeEvent('b', 1936, 'Move B'), x: 430, y: 180 },
    ]
    // span 20 on 1400px => 70 px/year — above the deep-zoom cutoff
    const { events, clusters } = foldSpatiallyConflictingEvents(placed, 20, 1400, 700)
    expect(clusters).toHaveLength(0)
    expect(events).toHaveLength(2)
  })

  it('leaves well-spaced markers alone on a roomy axis', () => {
    const placed = [
      { event: fakeEvent('a', 1740, 'Nicolas'), x: 200, y: 200 },
      { event: fakeEvent('b', 1755, 'Thomas'), x: 520, y: 200 },
      { event: fakeEvent('c', 1780, 'Richard'), x: 980, y: 200 },
    ]
    // span 40 on 1400px => 35 px/year — roomy decades view
    const { events, clusters } = foldSpatiallyConflictingEvents(placed, 40, 1400, 700)
    expect(clusters).toHaveLength(0)
    expect(events).toHaveLength(3)
  })

  it('still folds a tight local stack on a roomy axis', () => {
    const placed = [
      { event: fakeEvent('a', 1933, 'Story'), x: 400, y: 200 },
      { event: fakeEvent('b', 1934, 'Move A'), x: 418, y: 180 },
      { event: fakeEvent('c', 1935, 'Move B'), x: 434, y: 160 },
      { event: fakeEvent('d', 1980, 'Alone'), x: 900, y: 200 },
    ]
    const { events, clusters } = foldSpatiallyConflictingEvents(placed, 50, 1400, 700)
    expect(clusters).toHaveLength(1)
    expect(clusters[0].count).toBe(3)
    expect(events).toHaveLength(1)
  })

  it('folds label-collision neighbors that sit inside a readable diameter', () => {
    // James @1880 next to a stack badge ~70px away on a compressed far axis
    const placed = [
      { event: fakeEvent('a', 1880, 'James'), x: 900, y: 200 },
      { event: fakeEvent('b', 1880, 'Peer A'), x: 948, y: 180 },
      { event: fakeEvent('c', 1881, 'Peer B'), x: 962, y: 160 },
      { event: fakeEvent('d', 1949, 'Tamara'), x: 1200, y: 200 },
    ]
    const { events, clusters } = foldSpatiallyConflictingEvents(placed, 553, 1400, 700)
    expect(clusters.some((c) => c.count >= 3 && c.from <= 1880 && c.to >= 1880)).toBe(true)
    expect(events.some((e) => e.event.person.id === 'd')).toBe(true)
  })

  it('computes a deeper zoom span for conflict clusters', () => {
    const next = conflictClusterZoomSpan(1933, 1936, 80)
    expect(next).toBeLessThan(80 * 0.95)
    expect(next).toBeGreaterThanOrEqual(6)
  })
})
