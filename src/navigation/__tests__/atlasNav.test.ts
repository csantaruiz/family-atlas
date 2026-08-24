import { describe, expect, it } from 'vitest'
import { EXPLORE_NAV, OWNER_ACTIONS, exploreMenuLabel } from '../atlasNav'

describe('Atlas navigation configuration', () => {
  it('keeps five primary Explore destinations', () => {
    expect(EXPLORE_NAV.map((item) => item.label)).toEqual([
      'Timeline',
      'Journeys',
      'Tree',
      'People',
      'About',
    ])
  })

  it('names the compact Explore control without adding a sixth destination', () => {
    expect(exploreMenuLabel()).toBe('Explore')
    expect(EXPLORE_NAV).toHaveLength(5)
  })

  it('keeps owner actions grouped separately for a future Manage menu', () => {
    expect(OWNER_ACTIONS.map((item) => item.id)).toEqual(['review', 'update-tree'])
    expect(OWNER_ACTIONS.every((item) => item.title && item.description)).toBe(true)
  })
})
