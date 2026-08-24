import { describe, expect, it } from 'vitest'
import { familyDatabase } from '../../data/familyDatabase'
import { buildFamilyTreeLayout } from '../buildFamilyTree'

describe('tree branch vs full archive', () => {
  it('shows a connected branch of the root, not every person in the archive', () => {
    const peopleById = Object.fromEntries(familyDatabase.people.map((person) => [person.id, person]))
    const layout = buildFamilyTreeLayout(peopleById, new Set(), familyDatabase.root)
    const disconnected = familyDatabase.people.filter(
      (person) => !layout.nodes.some((node) => node.person.id === person.id),
    )

    expect(layout.nodes.length).toBeLessThan(familyDatabase.people.length)
    expect(disconnected.length).toBeGreaterThan(0)
    expect(
      disconnected.every((person) => person.generation == null || Math.abs(person.generation) > 12),
    ).toBe(true)
  })
})
