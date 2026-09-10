import { describe, expect, it } from 'vitest'
import { familyDatabase } from '../data/familyDatabase'
import { buildFamilyTreeLayout, TREE_CARD_WIDTH, TREE_H_GAP } from './buildFamilyTree'

describe('family tree close household', () => {
  it('includes Leah beside Craig and children below the couple union', () => {
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
    expect(layout.householdIds).toContain(familyDatabase.root)
    expect(layout.householdIds).toContain('I18123023648')
    expect(layout.coupleBounds).toBeTruthy()
    expect(layout.householdBounds).toBeTruthy()
    // Couple frame is tighter than the full household (parents + children).
    const coupleArea =
      (layout.coupleBounds!.maxX - layout.coupleBounds!.minX) *
      (layout.coupleBounds!.maxY - layout.coupleBounds!.minY)
    const householdArea =
      (layout.householdBounds!.maxX - layout.householdBounds!.minX) *
      (layout.householdBounds!.maxY - layout.householdBounds!.minY)
    expect(coupleArea).toBeLessThan(householdArea)

    const couple = layout.connectors.find(
      (c) => c.kind === 'couple' && c.id.includes('I18123023648'),
    )
    expect(couple).toBeTruthy()
    // Couple rail must sit below the household cards, not through them.
    const match = couple!.path.match(/^M [\d.]+ ([\d.]+)/)
    expect(match).toBeTruthy()
    const y = Number(match![1])
    expect(y).toBeGreaterThan(craig.y + 88)

    // Children descend from the couple mid-point, not Craig's card center alone.
    const childConnector = layout.connectors.find((c) => c.id === `${familyDatabase.root}-I18128930147`)
    expect(childConnector).toBeTruthy()
    const startX = Number(childConnector!.path.match(/^M ([\d.]+)/)?.[1])
    const craigCenter = craig.x + 132 / 2
    const leahCenter = leah.x + 132 / 2
    const mid = (craigCenter + leahCenter) / 2
    expect(Math.abs(startX - mid)).toBeLessThan(1)
  })

  it('keeps each spouse parent couple on its own side without nesting', () => {
    const peopleById = Object.fromEntries(familyDatabase.people.map((p) => [p.id, p]))
    const layout = buildFamilyTreeLayout(peopleById, new Set(), familyDatabase.root)
    const byId = Object.fromEntries(layout.nodes.map((n) => [n.person.id, n]))

    const craigParents = (peopleById[familyDatabase.root]?.parents ?? [])
      .map((id) => byId[id])
      .filter(Boolean)
    const leahParents = (peopleById['I18123023648']?.parents ?? [])
      .map((id) => byId[id])
      .filter(Boolean)

    expect(craigParents.length).toBe(2)
    expect(leahParents.length).toBe(2)

    const parentGap = TREE_CARD_WIDTH + TREE_H_GAP
    const craigSpan = Math.abs(craigParents[0]!.x - craigParents[1]!.x)
    const leahSpan = Math.abs(leahParents[0]!.x - leahParents[1]!.x)
    // Immediate parents of the household stay as compact couples.
    expect(craigSpan).toBeLessThanOrEqual(parentGap + 1)
    expect(leahSpan).toBeLessThanOrEqual(parentGap + 1)

    const craigParentMin = Math.min(craigParents[0]!.x, craigParents[1]!.x)
    const craigParentMax =
      Math.max(craigParents[0]!.x, craigParents[1]!.x) + TREE_CARD_WIDTH
    const leahParentMin = Math.min(leahParents[0]!.x, leahParents[1]!.x)
    const leahParentMax =
      Math.max(leahParents[0]!.x, leahParents[1]!.x) + TREE_CARD_WIDTH

    const overlaps =
      leahParentMin < craigParentMax - 1 && leahParentMax > craigParentMin + 1
    expect(overlaps).toBe(false)
  })

  it('does not overlap cards within the same generation', () => {
    const peopleById = Object.fromEntries(familyDatabase.people.map((p) => [p.id, p]))
    const layout = buildFamilyTreeLayout(peopleById, new Set(), familyDatabase.root)
    const byGen = new Map<number, typeof layout.nodes>()
    for (const node of layout.nodes) {
      if (node.generation >= 110) continue
      const row = byGen.get(node.generation) ?? []
      row.push(node)
      byGen.set(node.generation, row)
    }
    for (const [, row] of byGen) {
      const sorted = [...row].sort((a, b) => a.x - b.x)
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]
        const next = sorted[i]
        expect(
          next.x,
          `${prev.person.name} overlaps ${next.person.name} at gen ${next.generation}`,
        ).toBeGreaterThanOrEqual(prev.x + TREE_CARD_WIDTH + TREE_H_GAP - 0.5)
      }
    }
  })
})
