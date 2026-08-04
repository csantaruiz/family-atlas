import { describe, expect, it } from 'vitest'
import { familyDatabase } from '../data/familyDatabase'
import { buildFamilyTreeLayout } from './buildFamilyTree'

describe('family tree close household', () => {
  it('includes Leah beside Craig and children below', () => {
    const peopleById = Object.fromEntries(familyDatabase.people.map((p) => [p.id, p]))
    const layout = buildFamilyTreeLayout(peopleById, new Set(), familyDatabase.root)

    const byId = Object.fromEntries(layout.nodes.map((n) => [n.person.id, n]))
    const craig = byId[familyDatabase.root]
    const leah = byId['I18123023648']
    const mateo = byId['I18128930147']
    const joaquin = byId['I112802641930']

    expect(craig).toBeTruthy()
    expect(leah, 'Leah should appear on the tree').toBeTruthy()
    expect(mateo, 'Mateo should appear on the tree').toBeTruthy()
    expect(joaquin, 'Joaquin should appear on the tree').toBeTruthy()

    expect(leah.generation).toBe(0)
    expect(mateo.generation).toBe(-1)
    expect(joaquin.generation).toBe(-1)
    expect(Math.abs(leah.y - craig.y)).toBeLessThan(1)
    expect(mateo.y).toBeGreaterThan(craig.y)
    expect(joaquin.y).toBeGreaterThan(craig.y)
    expect(layout.connectors.some((c) => c.kind === 'couple' && c.id.includes('I18123023648'))).toBe(
      true,
    )
  })
})
