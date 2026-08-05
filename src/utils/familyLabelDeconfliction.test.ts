import { describe, expect, it } from 'vitest'
import { deconflictFamilyAnchorYs } from './labelMeasure'
import { staggerFamilyEventLanes } from './landmarkSelection'
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
    importance: 3,
    detail: '',
  }
}

describe('family label vertical deconfliction', () => {
  it('separates anchors that share a vertical band with overlapping widths', () => {
    const separated = deconflictFamilyAnchorYs(
      [
        { id: 'a', x: 400, y: 220, width: 160, height: 70 },
        { id: 'b', x: 430, y: 224, width: 150, height: 70 },
        { id: 'c', x: 460, y: 228, width: 140, height: 70 },
      ],
      16,
    )

    const byId = Object.fromEntries(separated.map((item) => [item.id, item.y]))
    expect(byId.b - byId.a).toBeGreaterThanOrEqual(70 + 16)
    expect(byId.c - byId.b).toBeGreaterThanOrEqual(70 + 16)
  })

  it('staggers nearby births onto distinct vertical lanes', () => {
    const placed = [
      { event: fakeEvent('I1', 1910, 'Victor Manuel Ruiz'), x: 420, y: 200 },
      { event: fakeEvent('I2', 1912, 'Juanita Luna'), x: 450, y: 200 },
      { event: fakeEvent('I3', 1916, 'Birth of Rosa'), x: 490, y: 200 },
    ]

    const staggered = staggerFamilyEventLanes(placed, 700, 100, 1400)
    const ys = staggered.map((entry) => entry.y)
    const unique = new Set(ys.map((y) => Math.round(y)))
    expect(staggered.length).toBeGreaterThanOrEqual(2)
    expect(unique.size).toBe(staggered.length)
    const sorted = [...ys].sort((a, b) => a - b)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(60)
    }
  })
})
