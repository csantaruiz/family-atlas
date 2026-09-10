import { describe, expect, it } from 'vitest'
import { familyDatabase } from '../data/familyDatabase'
import { TREE_CARD_HEIGHT, TREE_CARD_WIDTH, TREE_H_GAP } from './buildFamilyTree'
import { buildFocusTreeLayout, CARD_CONNECTOR_GAP } from './buildFocusTreeLayout'
import { selectFocusNeighborhood } from './treeNeighborhood'

const peopleById = Object.fromEntries(familyDatabase.people.map((p) => [p.id, p]))
const ROOT = familyDatabase.root
const LEAH = 'I18123023648'

describe('selectFocusNeighborhood', () => {
  it('returns parent expand overlays without treating them as people', () => {
    const neighborhood = selectFocusNeighborhood(peopleById, ROOT, null, 1, 1)
    expect(neighborhood.isHouseholdFocus).toBe(true)
    expect(neighborhood.parentExpands.length).toBeGreaterThan(0)
    for (const expand of neighborhood.parentExpands) {
      expect(neighborhood.personIds.has(expand.personId)).toBe(true)
      for (const parentId of expand.parentIds) {
        expect(neighborhood.personIds.has(parentId)).toBe(false)
      }
    }
  })

  it('expands one generation of parents for a person', () => {
    const base = selectFocusNeighborhood(peopleById, ROOT, null, 1, 1)
    const target = base.parentExpands[0]
    expect(target).toBeTruthy()
    const expanded = selectFocusNeighborhood(
      peopleById,
      ROOT,
      null,
      1,
      1,
      new Set(target.parentIds),
    )
    expect(expanded.focusIds).toEqual(base.focusIds)
    for (const id of target.parentIds) {
      expect(expanded.personIds.has(id)).toBe(true)
    }
    expect(expanded.parentExpands.some((e) => e.personId === target.personId)).toBe(false)
  })
})

describe('buildFocusTreeLayout', () => {
  it('keeps Craig and Leah adjacent at household focus', () => {
    const layout = buildFocusTreeLayout(peopleById, ROOT, null, 1, 1)
    const byId = Object.fromEntries(layout.nodes.map((n) => [n.person.id, n]))
    expect(byId[ROOT]).toBeTruthy()
    expect(byId[LEAH]).toBeTruthy()
    expect(Math.abs(byId[LEAH].y - byId[ROOT].y)).toBeLessThan(1)
    expect(Math.abs(byId[LEAH].x - byId[ROOT].x)).toBeLessThanOrEqual(
      TREE_CARD_WIDTH + TREE_H_GAP + 1,
    )
  })

  it('keeps +Parents overlays out of person geometry and off people cards', () => {
    const layout = buildFocusTreeLayout(peopleById, ROOT, null, 1, 1)
    expect(layout.parentsOverlays.length).toBeGreaterThan(0)
    for (const overlay of layout.parentsOverlays) {
      const anchor = layout.nodes.find((n) => n.person.id === overlay.personId)
      expect(anchor).toBeTruthy()
      expect(overlay.y + 30).toBeLessThanOrEqual(anchor!.y)
      // Overlay must not occupy a person-card slot in nodes.
      expect(layout.nodes.some((n) => n.person.id === `parents-${overlay.personId}`)).toBe(false)
      for (const node of layout.nodes) {
        if (node.person.id === overlay.personId) continue
        const overlapX =
          overlay.x < node.x + TREE_CARD_WIDTH && overlay.x + 96 > node.x
        const overlapY =
          overlay.y < node.y + TREE_CARD_HEIGHT && overlay.y + 30 > node.y
        expect(overlapX && overlapY, `overlay overlaps ${node.person.id}`).toBe(false)
      }
    }
  })

  it('draws connectors from visible parents to the focal person', () => {
    const layout = buildFocusTreeLayout(peopleById, ROOT, null, 1, 1)
    const craigParents = peopleById[ROOT]?.parents ?? []
    expect(craigParents.length).toBe(2)
    for (const parentId of craigParents) {
      expect(layout.nodes.some((n) => n.person.id === parentId)).toBe(true)
    }
    const toCraig = layout.connectors.filter(
      (c) => c.kind === 'parent-child' && c.id.includes(ROOT),
    )
    expect(toCraig.length).toBeGreaterThan(0)
    const covered = craigParents.every(
      (parentId) =>
        toCraig.some(
          (c) =>
            c.id === `pc-${parentId}-${ROOT}` ||
            (c.id.startsWith('pc-union-') && c.id.includes(parentId) && c.id.endsWith(`-${ROOT}`)),
        ),
    )
    expect(covered).toBe(true)
  })

  it('draws canonical connectors for every visible child', () => {
    const layout = buildFocusTreeLayout(peopleById, ROOT, null, 1, 1)
    const pc = layout.connectors.filter((c) => c.kind === 'parent-child')
    expect(pc.length).toBeGreaterThan(0)
    for (const connector of layout.connectors) {
      expect(connector.path.includes('NaN')).toBe(false)
      expect(connector.kind).not.toBe('continuation')
    }
    const mateo = layout.nodes.find((n) => n.person.id === 'I18128930147')
    expect(mateo).toBeTruthy()
    expect(pc.some((c) => c.id.includes('I18128930147'))).toBe(true)
  })

  it('is deterministic for the same focus and expand set', () => {
    const a = buildFocusTreeLayout(peopleById, ROOT, null, 1, 1)
    const b = buildFocusTreeLayout(peopleById, ROOT, null, 1, 1)
    expect(a.nodes.map((n) => [n.person.id, n.x, n.y])).toEqual(
      b.nodes.map((n) => [n.person.id, n.x, n.y]),
    )
    expect(a.connectors.map((c) => c.path)).toEqual(b.connectors.map((c) => c.path))
  })

  it('never places Craig as a sibling of a deep ancestor', () => {
    let cursor = ROOT
    for (let depth = 0; depth < 4; depth += 1) {
      const parents = peopleById[cursor]?.parents ?? []
      if (!parents.length) break
      cursor = parents[0]
      const layout = buildFocusTreeLayout(peopleById, ROOT, cursor, 1, 1)
      const byId = Object.fromEntries(layout.nodes.map((n) => [n.person.id, n]))
      const craig = byId[ROOT]
      expect(craig).toBeTruthy()
      const directKids = (peopleById[cursor]?.children ?? []).filter((id) => byId[id])
      if (!directKids.length || directKids.includes(ROOT)) continue
      const childRowY = byId[directKids[0]]!.y
      expect(Math.abs(craig!.y - childRowY)).toBeGreaterThan(2)
    }
  })

  it('drops +Parents for a person once their parents are revealed', () => {
    const base = buildFocusTreeLayout(peopleById, ROOT, null, 1, 1)
    const overlay = base.parentsOverlays[0]
    expect(overlay).toBeTruthy()
    const expanded = buildFocusTreeLayout(
      peopleById,
      ROOT,
      null,
      1,
      1,
      new Set(overlay.parentIds),
    )
    expect(expanded.parentsOverlays.some((o) => o.personId === overlay.personId)).toBe(false)
    for (const id of overlay.parentIds) {
      expect(expanded.nodes.some((n) => n.person.id === id)).toBe(true)
    }
  })

  it('supports a multi-step expand → focus → home sequence', () => {
    const home = buildFocusTreeLayout(peopleById, ROOT, null, 1, 1)
    expect(home.coupleBounds).toBeTruthy()

    const fatherId = (peopleById[ROOT]?.parents ?? [])[0]
    expect(fatherId).toBeTruthy()
    const fatherOverlay = home.parentsOverlays.find((o) => o.personId === fatherId)
    // Father may already have visible parents at depth 1; expand from whoever has an overlay.
    const firstExpand = fatherOverlay ?? home.parentsOverlays[0]
    expect(firstExpand).toBeTruthy()

    const afterExpand = buildFocusTreeLayout(
      peopleById,
      ROOT,
      null,
      1,
      1,
      new Set(firstExpand.parentIds),
    )
    expect(afterExpand.connectors.every((c) => !c.path.includes('NaN'))).toBe(true)

    const focusPerson = firstExpand.parentIds[0]
    const focused = buildFocusTreeLayout(peopleById, ROOT, focusPerson, 1, 1)
    expect(focused.focusIds).toContain(focusPerson)
    expect(focused.nodes.some((n) => n.person.id === ROOT)).toBe(true)
    expect(focused.connectors.filter((c) => c.kind === 'parent-child').length).toBeGreaterThan(0)

    const backHome = buildFocusTreeLayout(peopleById, ROOT, null, 1, 1)
    expect(backHome.isHouseholdFocus).toBe(true)
    expect(Math.abs(backHome.nodes.find((n) => n.person.id === ROOT)!.y - home.nodes.find((n) => n.person.id === ROOT)!.y)).toBeLessThan(1)
  })

  it('keeps person cards from overlapping', () => {
    const layout = buildFocusTreeLayout(peopleById, ROOT, null, 1, 1)
    const boxes = layout.nodes.map((n) => ({
      id: n.person.id,
      minX: n.x,
      maxX: n.x + TREE_CARD_WIDTH,
      minY: n.y,
      maxY: n.y + TREE_CARD_HEIGHT,
    }))
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]
        const b = boxes[j]
        const overlapX = a.minX < b.maxX - 1 && b.minX < a.maxX - 1
        const overlapY = a.minY < b.maxY - 1 && b.minY < a.maxY - 1
        expect(overlapX && overlapY, `${a.id} overlaps ${b.id}`).toBe(false)
      }
    }
  })

  it('keeps horizontal connectors clear of card bottoms', () => {
    const layout = buildFocusTreeLayout(peopleById, ROOT, null, 1, 1)
    const byId = Object.fromEntries(layout.nodes.map((n) => [n.person.id, n]))
    const craig = byId[ROOT]
    const leah = byId[LEAH]
    expect(craig && leah).toBeTruthy()

    const couple = layout.connectors.find(
      (c) => c.kind === 'couple' && c.id.includes(ROOT) && c.id.includes(LEAH),
    )
    expect(couple).toBeTruthy()
    const coupleY = Number(/M [\d.]+ ([\d.]+)/.exec(couple!.path)?.[1])
    expect(coupleY).toBeGreaterThanOrEqual(
      Math.max(craig!.y, leah!.y) + TREE_CARD_HEIGHT + CARD_CONNECTOR_GAP - 0.5,
    )

    const kids = (peopleById[ROOT]?.children ?? []).filter((id) => byId[id])
    expect(kids.length).toBeGreaterThan(0)
    for (const childId of kids) {
      const connector = layout.connectors.find(
        (c) =>
          c.kind === 'parent-child' &&
          c.id.startsWith('pc-union-') &&
          c.id.includes(ROOT) &&
          c.id.includes(LEAH) &&
          c.id.endsWith(`-${childId}`),
      )
      expect(connector, `missing union connector for ${childId}`).toBeTruthy()
      const busY = Number(/V ([\d.]+) H/.exec(connector!.path)?.[1])
      expect(busY).toBeGreaterThanOrEqual(coupleY + 2)
      expect(busY).toBeGreaterThanOrEqual(
        Math.max(craig!.y, leah!.y) + TREE_CARD_HEIGHT + CARD_CONNECTOR_GAP - 0.5,
      )
      expect(busY).toBeLessThanOrEqual(byId[childId]!.y - 2)
    }

    // Every couple rail clears its own card bottoms.
    for (const connector of layout.connectors.filter((c) => c.kind === 'couple')) {
      const match = /^couple-(.+)-(.+)$/.exec(connector.id)
      if (!match) continue
      const a = byId[match[1]]
      const b = byId[match[2]]
      if (!a || !b) continue
      const railY = Number(/M [\d.]+ ([\d.]+)/.exec(connector.path)?.[1])
      expect(railY).toBeGreaterThanOrEqual(
        Math.max(a.y, b.y) + TREE_CARD_HEIGHT + CARD_CONNECTOR_GAP - 0.5,
      )
    }
  })
})
