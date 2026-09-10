import { familyDatabase } from '../data/familyDatabase'
import type { Person } from '../types'
import { assignPersonGenerations } from '../gedcom/assignGenerations'
import { primaryRootIds } from './householdRoots'

export const TREE_CARD_WIDTH = 132
export const TREE_CARD_HEIGHT = 88
export const TREE_H_GAP = 26
/**
 * Clearance between card bounds and any horizontal connector segment.
 * Horizontal rails/buses are derived from card bottoms + this gap — never from row Y alone.
 */
export const CARD_CONNECTOR_GAP = 24
/** Vertical gap must clear couple rails + child buses drawn below cards. */
export const TREE_V_GAP = 88
export const TREE_PADDING = 48
/** @deprecated Prefer CARD_CONNECTOR_GAP — kept as alias for couple-rail callers. */
export const TREE_COUPLE_RAIL_BELOW = CARD_CONNECTOR_GAP

export type PositionedTreeNode = {
  person: Person
  generation: number
  x: number
  y: number
}

export type TreeConnector = {
  id: string
  path: string
  kind: 'parent-child' | 'couple' | 'continuation'
}

export type TreeBounds = { minX: number; minY: number; maxX: number; maxY: number }

export type TreeLayout = {
  nodes: PositionedTreeNode[]
  connectors: TreeConnector[]
  width: number
  height: number
  rootId: string
  /** Archive root + household co-root (Craig + Leah). */
  householdIds: string[]
  /** Bounding box of the married couple only — default camera hero. */
  coupleBounds: TreeBounds | null
  /** Bounding box of couple + parents + shared children — Fit family. */
  householdBounds: TreeBounds | null
}

const MAX_ANCESTOR_DEPTH = 12
const MAX_DESCENDANT_DEPTH = 4

function collectConnectedPeople(
  rootId: string,
  peopleById: Record<string, Person>,
  timelinePersonIds: Set<string>,
): Set<string> {
  const included = new Set<string>()

  const addAncestors = (id: string, depth: number) => {
    if (depth > MAX_ANCESTOR_DEPTH || included.has(id)) return
    const person = peopleById[id]
    if (!person) return
    included.add(id)
    for (const parentId of person.parents ?? []) addAncestors(parentId, depth + 1)
  }

  const addDescendants = (id: string, depth: number, visited: Set<string>) => {
    if (depth > MAX_DESCENDANT_DEPTH || visited.has(id)) return
    const person = peopleById[id]
    if (!person) return
    visited.add(id)
    included.add(id)
    for (const childId of person.children ?? []) addDescendants(childId, depth + 1, visited)
  }

  for (const id of primaryRootIds(rootId, peopleById)) {
    addAncestors(id, 0)
    addDescendants(id, 0, new Set())
  }

  // Spouses of everyone already included (root spouse, co-parents, etc.).
  for (const id of [...included]) {
    const person = peopleById[id]
    if (!person) continue
    for (const spouseId of person.spouses ?? []) {
      if (peopleById[spouseId]) included.add(spouseId)
    }
  }

  for (const id of timelinePersonIds) {
    if (!peopleById[id]) continue
    included.add(id)
    for (const parentId of peopleById[id].parents ?? []) included.add(parentId)
    for (const childId of peopleById[id].children ?? []) included.add(childId)
    for (const spouseId of peopleById[id].spouses ?? []) {
      if (peopleById[spouseId]) included.add(spouseId)
    }
  }

  return included
}

function resolveGeneration(
  person: Person,
  rootId: string,
  peopleById: Record<string, Person>,
  memo: Map<string, number>,
  visiting: Set<string>,
): number {
  if (person.generation != null) return person.generation
  if (person.id === rootId) {
    memo.set(person.id, 0)
    return 0
  }
  if (memo.has(person.id)) return memo.get(person.id)!
  if (visiting.has(person.id)) return 110

  visiting.add(person.id)

  let best = 110
  for (const parentId of person.parents ?? []) {
    const parent = peopleById[parentId]
    if (!parent) continue
    best = Math.min(best, resolveGeneration(parent, rootId, peopleById, memo, visiting) + 1)
  }

  visiting.delete(person.id)
  memo.set(person.id, best)
  return best
}

function parentsInSet(person: Person, ids: Set<string>, peopleById: Record<string, Person>): Person[] {
  return (person.parents ?? [])
    .map((id) => peopleById[id])
    .filter((p): p is Person => Boolean(p && ids.has(p.id)))
    .sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999))
}

function childrenInSet(person: Person, ids: Set<string>, peopleById: Record<string, Person>): Person[] {
  return (person.children ?? [])
    .map((id) => peopleById[id])
    .filter((p): p is Person => Boolean(p && ids.has(p.id)))
    .sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999))
}

function nodeCenter(pos: { x: number; y: number }) {
  return {
    x: pos.x + TREE_CARD_WIDTH / 2,
    y: pos.y + TREE_CARD_HEIGHT / 2,
  }
}

function elbowPath(x1: number, y1: number, x2: number, y2: number): string {
  const midY = y1 + (y2 - y1) / 2
  return `M ${x1} ${y1} V ${midY} H ${x2} V ${y2}`
}

/** Push same-generation cards apart so fixed-width nodes never collide. */
function resolveGenerationOverlaps(
  nodes: PositionedTreeNode[],
  positions: Map<string, { x: number; y: number }>,
) {
  const byGen = new Map<number, PositionedTreeNode[]>()
  for (const node of nodes) {
    if (node.generation >= 110) continue
    const row = byGen.get(node.generation) ?? []
    row.push(node)
    byGen.set(node.generation, row)
  }

  const generations = [...byGen.keys()].sort((a, b) => b - a)
  for (const generation of generations) {
    const row = byGen.get(generation)!
    row.sort((a, b) => a.x - b.x || a.person.id.localeCompare(b.person.id))
    for (let i = 1; i < row.length; i++) {
      const prev = row[i - 1]
      const curr = row[i]
      const minX = prev.x + TREE_CARD_WIDTH + TREE_H_GAP
      if (curr.x < minX) {
        curr.x = minX
        positions.set(curr.person.id, { x: curr.x, y: curr.y })
      }
    }
  }
}

function rebuildTreeConnectors(
  nodes: PositionedTreeNode[],
  positions: Map<string, { x: number; y: number }>,
  ids: Set<string>,
  peopleById: Record<string, Person>,
  rootId: string,
  coRootId: string | null,
): TreeConnector[] {
  const connectors: TreeConnector[] = []
  const seen = new Set<string>()
  const push = (connector: TreeConnector) => {
    if (seen.has(connector.id)) return
    seen.add(connector.id)
    connectors.push(connector)
  }

  for (const node of nodes) {
    const parents = parentsInSet(node.person, ids, peopleById)
      .map((parent) => {
        const pos = positions.get(parent.id)
        return pos ? { parent, pos } : null
      })
      .filter((entry): entry is { parent: Person; pos: { x: number; y: number } } => entry != null)

    if (!parents.length) continue
    const childPos = positions.get(node.person.id)
    if (!childPos) continue
    const childCenter = nodeCenter(childPos)

    if (parents.length === 1) {
      const parentCenter = nodeCenter(parents[0].pos)
      push({
        id: `${parents[0].parent.id}-${node.person.id}`,
        kind: 'parent-child',
        path: elbowPath(
          parentCenter.x,
          parents[0].pos.y + TREE_CARD_HEIGHT,
          childCenter.x,
          childPos.y,
        ),
      })
      continue
    }

    const left = parents[0]
    const right = parents[parents.length - 1]
    const leftCenter = nodeCenter(left.pos)
    const rightCenter = nodeCenter(right.pos)
    const railY = coupleRailY(left.pos.y)
    push({
      id: `couple-${left.parent.id}-${right.parent.id}`,
      kind: 'couple',
      path: `M ${leftCenter.x} ${railY} H ${rightCenter.x}`,
    })
    push({
      id: `union-${node.person.id}`,
      kind: 'parent-child',
      path: elbowPath((leftCenter.x + rightCenter.x) / 2, railY, childCenter.x, childPos.y),
    })
  }

  const rootPos = positions.get(rootId)
  const rootPerson = peopleById[rootId]
  if (rootPos && rootPerson) {
    const rootCenter = nodeCenter(rootPos)
    const spouses = (rootPerson.spouses ?? [])
      .map((id) => peopleById[id])
      .filter((p): p is Person => Boolean(p && ids.has(p.id) && positions.has(p.id)))
    for (const spouse of spouses) {
      const spousePos = positions.get(spouse.id)!
      const spouseCenter = nodeCenter(spousePos)
      const railY = coupleRailY(rootPos.y)
      push({
        id: `couple-${rootId}-${spouse.id}`,
        kind: 'couple',
        path: `M ${rootCenter.x} ${railY} H ${spouseCenter.x}`,
      })
    }

    const children = childrenInSet(rootPerson, ids, peopleById)
    const partnerPos = coRootId ? positions.get(coRootId) : null
    const partnerCenter = partnerPos ? nodeCenter(partnerPos) : null
    const descentFromX =
      partnerCenter != null ? (rootCenter.x + partnerCenter.x) / 2 : rootCenter.x
    const descentFromY =
      partnerCenter != null ? coupleRailY(rootPos.y) : rootPos.y + TREE_CARD_HEIGHT

    for (const child of children) {
      const childPos = positions.get(child.id)
      if (!childPos) continue
      const childCenter = nodeCenter(childPos)
      push({
        id: `${rootId}-${child.id}`,
        kind: 'parent-child',
        path: elbowPath(descentFromX, descentFromY, childCenter.x, childPos.y),
      })
    }
  }

  return connectors
}

function coupleRailY(cardY: number): number {
  return cardY + TREE_CARD_HEIGHT + TREE_COUPLE_RAIL_BELOW
}

/** Horizontal span of a person's immediate parent cards when packed adjacent. */
function immediateParentBandWidth(
  person: Person,
  ids: Set<string>,
  peopleById: Record<string, Person>,
): number {
  const parents = parentsInSet(person, ids, peopleById)
  if (!parents.length) return TREE_CARD_WIDTH
  return parents.length * TREE_CARD_WIDTH + Math.max(0, parents.length - 1) * TREE_H_GAP
}

type SubtreeBounds = { width: number; center: number }

function measureUpSubtree(
  id: string,
  ids: Set<string>,
  peopleById: Record<string, Person>,
  memo: Map<string, SubtreeBounds>,
  visiting: Set<string>,
): SubtreeBounds {
  if (memo.has(id)) return memo.get(id)!
  if (visiting.has(id)) return { width: TREE_CARD_WIDTH, center: TREE_CARD_WIDTH / 2 }
  visiting.add(id)

  const person = peopleById[id]
  if (!person) {
    visiting.delete(id)
    const fallback = { width: TREE_CARD_WIDTH, center: TREE_CARD_WIDTH / 2 }
    memo.set(id, fallback)
    return fallback
  }

  const parents = parentsInSet(person, ids, peopleById)
  if (!parents.length) {
    visiting.delete(id)
    const leaf = { width: TREE_CARD_WIDTH, center: TREE_CARD_WIDTH / 2 }
    memo.set(id, leaf)
    return leaf
  }

  const parentBounds = parents.map((p) => measureUpSubtree(p.id, ids, peopleById, memo, visiting))
  const width =
    parentBounds.reduce((sum, b) => sum + b.width, 0) +
    Math.max(0, parents.length - 1) * TREE_H_GAP
  const center = width / 2
  visiting.delete(id)
  const result = { width: Math.max(TREE_CARD_WIDTH, width), center }
  memo.set(id, result)
  return result
}

function measureDownSubtree(
  id: string,
  ids: Set<string>,
  peopleById: Record<string, Person>,
  memo: Map<string, SubtreeBounds>,
  visiting: Set<string>,
): SubtreeBounds {
  if (memo.has(id)) return memo.get(id)!
  if (visiting.has(id)) return { width: TREE_CARD_WIDTH, center: TREE_CARD_WIDTH / 2 }
  visiting.add(id)

  const person = peopleById[id]
  if (!person) {
    visiting.delete(id)
    const fallback = { width: TREE_CARD_WIDTH, center: TREE_CARD_WIDTH / 2 }
    memo.set(id, fallback)
    return fallback
  }

  const children = childrenInSet(person, ids, peopleById)
  if (!children.length) {
    visiting.delete(id)
    const leaf = { width: TREE_CARD_WIDTH, center: TREE_CARD_WIDTH / 2 }
    memo.set(id, leaf)
    return leaf
  }

  const childBounds = children.map((c) => measureDownSubtree(c.id, ids, peopleById, memo, visiting))
  const width =
    childBounds.reduce((sum, b) => sum + b.width, 0) +
    Math.max(0, children.length - 1) * TREE_H_GAP
  visiting.delete(id)
  const result = { width: Math.max(TREE_CARD_WIDTH, width), center: width / 2 }
  memo.set(id, result)
  return result
}

type UpExpand = 'center' | 'left' | 'right'

function layoutUp(
  id: string,
  centerX: number,
  y: number,
  ids: Set<string>,
  peopleById: Record<string, Person>,
  positions: Map<string, { x: number; y: number }>,
  connectors: TreeConnector[],
  upMemo: Map<string, SubtreeBounds>,
  visiting: Set<string>,
  expand: UpExpand = 'center',
) {
  if (visiting.has(id)) return
  visiting.add(id)

  const person = peopleById[id]
  if (!person) {
    visiting.delete(id)
    return
  }

  if (!positions.has(id)) {
    positions.set(id, { x: centerX - TREE_CARD_WIDTH / 2, y })
  }

  const parents = parentsInSet(person, ids, peopleById)
  if (!parents.length) {
    visiting.delete(id)
    return
  }

  const childPos = positions.get(id)!
  const childCenter = nodeCenter(childPos)
  const parentY = y - TREE_V_GAP - TREE_CARD_HEIGHT
  const parentCenters: { id: string; x: number; y: number }[] = []

  const placeParent = (parent: Person, parentCenterX: number, parentExpand: UpExpand) => {
    if (!positions.has(parent.id)) {
      positions.set(parent.id, {
        x: parentCenterX - TREE_CARD_WIDTH / 2,
        y: parentY,
      })
    }
    layoutUp(
      parent.id,
      parentCenterX,
      parentY,
      ids,
      peopleById,
      positions,
      connectors,
      upMemo,
      visiting,
      parentExpand,
    )
    const parentPos = positions.get(parent.id)!
    parentCenters.push({
      id: parent.id,
      x: parentPos.x + TREE_CARD_WIDTH / 2,
      y: parentPos.y,
    })
  }

  if (parents.length === 1) {
    placeParent(parents[0], childCenter.x, expand)
  } else if (expand === 'center') {
    // Keep the couple compact; push each parent's deeper ancestors outward.
    const band =
      parents.length * TREE_CARD_WIDTH + Math.max(0, parents.length - 1) * TREE_H_GAP
    let cursor = childCenter.x - band / 2
    for (let i = 0; i < parents.length; i++) {
      const parentCenterX = cursor + TREE_CARD_WIDTH / 2
      const side: UpExpand =
        parents.length === 2 ? (i === 0 ? 'left' : 'right') : i < parents.length / 2 ? 'left' : 'right'
      placeParent(parents[i], parentCenterX, side)
      cursor += TREE_CARD_WIDTH + TREE_H_GAP
    }
  } else {
    // Pack parent forests without overlap, flush to this person on the inward side.
    const bounds = parents.map(
      (p) => upMemo.get(p.id) ?? { width: TREE_CARD_WIDTH, center: TREE_CARD_WIDTH / 2 },
    )
    const totalWidth =
      bounds.reduce((sum, b) => sum + b.width, 0) + Math.max(0, parents.length - 1) * TREE_H_GAP
    let cursor =
      expand === 'left'
        ? childCenter.x + TREE_CARD_WIDTH / 2 - totalWidth
        : childCenter.x - TREE_CARD_WIDTH / 2
    for (let i = 0; i < parents.length; i++) {
      const parentCenterX = cursor + bounds[i].center
      placeParent(parents[i], parentCenterX, expand)
      cursor += bounds[i].width + TREE_H_GAP
    }
  }

  if (parentCenters.length === 1) {
    connectors.push({
      id: `${parentCenters[0].id}-${id}`,
      kind: 'parent-child',
      path: elbowPath(
        parentCenters[0].x,
        parentCenters[0].y + TREE_CARD_HEIGHT,
        childCenter.x,
        childPos.y,
      ),
    })
  } else if (parentCenters.length >= 2) {
    const left = parentCenters[0]
    const right = parentCenters[parentCenters.length - 1]
    const railY = coupleRailY(left.y)
    connectors.push({
      id: `couple-${left.id}-${right.id}`,
      kind: 'couple',
      path: `M ${left.x} ${railY} H ${right.x}`,
    })
    const midX = (left.x + right.x) / 2
    connectors.push({
      id: `union-${id}`,
      kind: 'parent-child',
      path: elbowPath(midX, railY, childCenter.x, childPos.y),
    })
  }

  visiting.delete(id)
}

/** How far a person's up-tree extends past their center on one side. */
function upTreeOutwardExtent(
  person: Person,
  side: 'left' | 'right',
  ids: Set<string>,
  peopleById: Record<string, Person>,
  upMemo: Map<string, SubtreeBounds>,
): number {
  const parents = parentsInSet(person, ids, peopleById)
  if (!parents.length) return TREE_CARD_WIDTH / 2
  const bandHalf = immediateParentBandWidth(person, ids, peopleById) / 2
  if (parents.length === 1) {
    return bandHalf + (upMemo.get(parents[0].id)?.width ?? TREE_CARD_WIDTH)
  }
  const outward = side === 'left' ? parents[0] : parents[parents.length - 1]
  return bandHalf + (upMemo.get(outward.id)?.width ?? TREE_CARD_WIDTH)
}

function layoutDown(
  id: string,
  centerX: number,
  y: number,
  ids: Set<string>,
  peopleById: Record<string, Person>,
  positions: Map<string, { x: number; y: number }>,
  connectors: TreeConnector[],
  downMemo: Map<string, SubtreeBounds>,
  visiting: Set<string>,
  unionPartnerId?: string | null,
) {
  if (visiting.has(id)) return
  visiting.add(id)

  const person = peopleById[id]
  if (!person) {
    visiting.delete(id)
    return
  }

  if (!positions.has(id)) {
    positions.set(id, { x: centerX - TREE_CARD_WIDTH / 2, y })
  }

  const children = childrenInSet(person, ids, peopleById)
  if (!children.length) {
    visiting.delete(id)
    return
  }

  const parentPos = positions.get(id)!
  const parentCenter = nodeCenter(parentPos)
  const childY = y + TREE_CARD_HEIGHT + TREE_V_GAP
  const bounds = children.map((c) => downMemo.get(c.id) ?? { width: TREE_CARD_WIDTH, center: TREE_CARD_WIDTH / 2 })
  const totalWidth =
    bounds.reduce((sum, b) => sum + b.width, 0) + Math.max(0, children.length - 1) * TREE_H_GAP
  let cursor = centerX - totalWidth / 2

  const partnerPos = unionPartnerId ? positions.get(unionPartnerId) : null
  const partnerCenter = partnerPos ? nodeCenter(partnerPos) : null
  const descentFromX =
    partnerCenter != null ? (parentCenter.x + partnerCenter.x) / 2 : parentCenter.x
  const descentFromY =
    partnerCenter != null
      ? coupleRailY(parentPos.y)
      : parentPos.y + TREE_CARD_HEIGHT

  for (let i = 0; i < children.length; i++) {
    const b = bounds[i]
    const childCenterX = cursor + b.center
    layoutDown(
      children[i].id,
      childCenterX,
      childY,
      ids,
      peopleById,
      positions,
      connectors,
      downMemo,
      visiting,
      null,
    )
    const childPos = positions.get(children[i].id)!
    const childCenter = nodeCenter(childPos)
    connectors.push({
      id: `${id}-${children[i].id}`,
      kind: 'parent-child',
      path: elbowPath(descentFromX, descentFromY, childCenter.x, childPos.y),
    })
    cursor += b.width + TREE_H_GAP
  }

  visiting.delete(id)
}

function placeExtendedRow(
  people: Person[],
  y: number,
  startX: number,
  positions: Map<string, { x: number; y: number }>,
) {
  let x = startX
  for (const person of people) {
    if (positions.has(person.id)) continue
    positions.set(person.id, { x, y })
    x += TREE_CARD_WIDTH + TREE_H_GAP
  }
}

export function buildFamilyTreeLayout(
  peopleById: Record<string, Person>,
  timelinePersonIds: Iterable<string>,
  rootId: string = familyDatabase.root,
): TreeLayout {
  const numbered = assignPersonGenerations(Object.values(peopleById), rootId)
  peopleById = Object.fromEntries(numbered.map((person) => [person.id, person]))
  const timelineSet = new Set(timelinePersonIds)
  const ids = collectConnectedPeople(rootId, peopleById, timelineSet)
  const genMemo = new Map<string, number>()
  const genVisiting = new Set<string>()

  const people = [...ids]
    .map((id) => peopleById[id])
    .filter((p): p is Person => Boolean(p))

  const generationOf = (person: Person) =>
    resolveGeneration(person, rootId, peopleById, genMemo, genVisiting)

  const upMemo = new Map<string, SubtreeBounds>()
  const upVisiting = new Set<string>()
  measureUpSubtree(rootId, ids, peopleById, upMemo, upVisiting)
  for (const id of primaryRootIds(rootId, peopleById)) {
    if (id === rootId) continue
    measureUpSubtree(id, ids, peopleById, upMemo, new Set())
  }

  const downMemo = new Map<string, SubtreeBounds>()
  const downVisiting = new Set<string>()
  measureDownSubtree(rootId, ids, peopleById, downMemo, downVisiting)

  const upWidth = upMemo.get(rootId)?.width ?? TREE_CARD_WIDTH
  const downWidth = downMemo.get(rootId)?.width ?? TREE_CARD_WIDTH
  const canvasWidth = Math.max(upWidth, downWidth) + TREE_PADDING * 2

  const positions = new Map<string, { x: number; y: number }>()
  const connectors: TreeConnector[] = []

  const maxAncestorGen = people
    .filter((p) => generationOf(p) > 0 && generationOf(p) < 110)
    .reduce((max, p) => Math.max(max, generationOf(p)), 0)

  const rootY = TREE_PADDING + maxAncestorGen * (TREE_CARD_HEIGHT + TREE_V_GAP)
  const rootCenterX = canvasWidth / 2

  layoutUp(rootId, rootCenterX, rootY, ids, peopleById, positions, connectors, upMemo, new Set())

  // Place root spouses beside the root before descending, so children can leave the couple union.
  const rootPerson = peopleById[rootId]
  const rootPos = positions.get(rootId)
  let coRootId: string | null = null
  if (rootPerson && rootPos) {
    const spouses = (rootPerson.spouses ?? [])
      .map((id) => peopleById[id])
      .filter((p): p is Person => Boolean(p && ids.has(p.id)))
      .sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999))

    const rootChildren = new Set(rootPerson.children ?? [])
    coRootId =
      spouses.find((spouse) =>
        (spouse.children ?? []).some((childId) => rootChildren.has(childId)),
      )?.id ??
      spouses[0]?.id ??
      null

    let spouseOffsetX = 0
    for (const spouse of spouses) {
      if (!positions.has(spouse.id)) {
        // Leave room for each spouse's outward-expanding ancestor forests
        // so Ruiz/Hendry and Haro/Santa don't collide in the middle.
        const rootRight = upTreeOutwardExtent(rootPerson, 'right', ids, peopleById, upMemo)
        const spouseLeft = upTreeOutwardExtent(spouse, 'left', ids, peopleById, upMemo)
        const minCenterGap = rootRight + spouseLeft + TREE_H_GAP
        spouseOffsetX = Math.max(spouseOffsetX + TREE_CARD_WIDTH + TREE_H_GAP, minCenterGap)
        const x = rootPos.x + spouseOffsetX
        positions.set(spouse.id, { x, y: rootPos.y })
      }
      const spousePos = positions.get(spouse.id)!
      const rootCenter = nodeCenter(rootPos)
      const spouseCenter = nodeCenter(spousePos)
      const railY = coupleRailY(rootPos.y)
      const coupleId = `couple-${rootId}-${spouse.id}`
      if (!connectors.some((c) => c.id === coupleId)) {
        connectors.push({
          id: coupleId,
          kind: 'couple',
          path: `M ${rootCenter.x} ${railY} H ${spouseCenter.x}`,
        })
      }
    }

    for (const spouse of spouses) {
      const pos = positions.get(spouse.id)
      if (!pos) continue
      layoutUp(
        spouse.id,
        pos.x + TREE_CARD_WIDTH / 2,
        rootY,
        ids,
        peopleById,
        positions,
        connectors,
        upMemo,
        new Set(),
      )
    }
  }

  layoutDown(
    rootId,
    rootCenterX,
    rootY,
    ids,
    peopleById,
    positions,
    connectors,
    downMemo,
    new Set(),
    coRootId,
  )

  const extended = people
    .filter((p) => generationOf(p) >= 110 && !positions.has(p.id))
    .sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999))

  if (extended.length) {
    const downDepth = MAX_DESCENDANT_DEPTH
    const extendedY = rootY + (downDepth + 1) * (TREE_CARD_HEIGHT + TREE_V_GAP)
    placeExtendedRow(extended, extendedY, TREE_PADDING, positions)
  }

  const nodes: PositionedTreeNode[] = people
    .filter((p) => positions.has(p.id))
    .map((person) => {
      const pos = positions.get(person.id)!
      return {
        person,
        generation: generationOf(person),
        x: pos.x,
        y: pos.y,
      }
    })

  resolveGenerationOverlaps(nodes, positions)

  // Keep the board in positive space after outward-expanding up-trees.
  let minX = Infinity
  let minY = Infinity
  for (const node of nodes) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
  }
  const shiftX = Number.isFinite(minX) ? TREE_PADDING - minX : 0
  const shiftY = Number.isFinite(minY) ? TREE_PADDING - minY : 0
  if (shiftX !== 0 || shiftY !== 0) {
    for (const node of nodes) {
      node.x += shiftX
      node.y += shiftY
      positions.set(node.person.id, { x: node.x, y: node.y })
    }
  }

  const finalConnectors = rebuildTreeConnectors(
    nodes,
    positions,
    ids,
    peopleById,
    rootId,
    coRootId,
  )

  let maxY = 0
  let maxX = canvasWidth
  for (const node of nodes) {
    maxY = Math.max(maxY, node.y + TREE_CARD_HEIGHT)
    maxX = Math.max(maxX, node.x + TREE_CARD_WIDTH)
  }

  const householdIds = primaryRootIds(rootId, peopleById)
  const householdFocusIds = new Set<string>(householdIds)
  for (const id of householdIds) {
    const person = peopleById[id]
    if (!person) continue
    for (const parentId of person.parents ?? []) {
      if (positions.has(parentId)) householdFocusIds.add(parentId)
    }
    for (const childId of person.children ?? []) {
      if (positions.has(childId)) householdFocusIds.add(childId)
    }
  }

  const boundsFor = (ids: Set<string>): TreeBounds | null => {
    let bounds: TreeBounds | null = null
    for (const node of nodes) {
      if (!ids.has(node.person.id)) continue
      const maxNodeX = node.x + TREE_CARD_WIDTH
      const maxNodeY = node.y + TREE_CARD_HEIGHT
      if (!bounds) {
        bounds = { minX: node.x, minY: node.y, maxX: maxNodeX, maxY: maxNodeY }
      } else {
        bounds.minX = Math.min(bounds.minX, node.x)
        bounds.minY = Math.min(bounds.minY, node.y)
        bounds.maxX = Math.max(bounds.maxX, maxNodeX)
        bounds.maxY = Math.max(bounds.maxY, maxNodeY)
      }
    }
    return bounds
  }

  const coupleBounds = boundsFor(new Set(householdIds))
  const householdBounds = boundsFor(householdFocusIds)

  return {
    nodes,
    connectors: finalConnectors,
    width: maxX + TREE_PADDING,
    height: maxY + TREE_PADDING,
    rootId,
    householdIds,
    coupleBounds,
    householdBounds,
  }
}

export function generationLabel(generation: number, rootName: string): string {
  if (generation === 0) return `Present · ${rootName.split(' ')[0]}'s generation`
  if (generation === 110) return 'Extended family'
  if (generation === 1) return 'Parents'
  if (generation === 2) return 'Grandparents'
  if (generation === -1) return 'Children'
  if (generation === -2) return 'Grandchildren'
  if (generation < 0) return `${-generation} generations after present`
  return `${generation} generations before present`
}
