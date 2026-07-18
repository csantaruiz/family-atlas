import { familyDatabase } from '../data/familyDatabase'
import type { Person } from '../types'

export const TREE_CARD_WIDTH = 132
export const TREE_CARD_HEIGHT = 88
export const TREE_H_GAP = 26
export const TREE_V_GAP = 64
export const TREE_PADDING = 48

export type PositionedTreeNode = {
  person: Person
  generation: number
  x: number
  y: number
}

export type TreeConnector = {
  id: string
  path: string
  kind: 'parent-child' | 'couple'
}

export type TreeLayout = {
  nodes: PositionedTreeNode[]
  connectors: TreeConnector[]
  width: number
  height: number
  rootId: string
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

  const addDescendants = (id: string, depth: number) => {
    if (depth > MAX_DESCENDANT_DEPTH || included.has(id)) return
    const person = peopleById[id]
    if (!person) return
    included.add(id)
    for (const childId of person.children ?? []) addDescendants(childId, depth + 1)
  }

  addAncestors(rootId, 0)
  addDescendants(rootId, 0)

  for (const id of timelinePersonIds) {
    if (!peopleById[id]) continue
    included.add(id)
    for (const parentId of peopleById[id].parents ?? []) included.add(parentId)
    for (const childId of peopleById[id].children ?? []) included.add(childId)
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
  const bounds = parents.map((p) => upMemo.get(p.id) ?? { width: TREE_CARD_WIDTH, center: TREE_CARD_WIDTH / 2 })
  const totalWidth =
    bounds.reduce((sum, b) => sum + b.width, 0) + Math.max(0, parents.length - 1) * TREE_H_GAP
  let cursor = centerX - totalWidth / 2
  const parentCenters: { id: string; x: number; y: number }[] = []

  for (let i = 0; i < parents.length; i++) {
    const b = bounds[i]
    const parentCenterX = cursor + b.center
    layoutUp(parents[i].id, parentCenterX, parentY, ids, peopleById, positions, connectors, upMemo, visiting)
    const parentPos = positions.get(parents[i].id)!
    parentCenters.push({ id: parents[i].id, x: parentPos.x + TREE_CARD_WIDTH / 2, y: parentPos.y })
    cursor += b.width + TREE_H_GAP
  }

  if (parentCenters.length === 1) {
    connectors.push({
      id: `${parentCenters[0].id}-${id}`,
      kind: 'parent-child',
      path: elbowPath(parentCenters[0].x, parentCenters[0].y + TREE_CARD_HEIGHT, childCenter.x, childPos.y),
    })
  } else if (parentCenters.length >= 2) {
    const left = parentCenters[0]
    const right = parentCenters[parentCenters.length - 1]
    const railY = left.y + TREE_CARD_HEIGHT * 0.38
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

  for (let i = 0; i < children.length; i++) {
    const b = bounds[i]
    const childCenterX = cursor + b.center
    layoutDown(children[i].id, childCenterX, childY, ids, peopleById, positions, connectors, downMemo, visiting)
    const childPos = positions.get(children[i].id)!
    const childCenter = nodeCenter(childPos)
    connectors.push({
      id: `${id}-${children[i].id}`,
      kind: 'parent-child',
      path: elbowPath(parentCenter.x, parentPos.y + TREE_CARD_HEIGHT, childCenter.x, childPos.y),
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
  layoutDown(rootId, rootCenterX, rootY, ids, peopleById, positions, connectors, downMemo, new Set())

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

  let maxY = 0
  let maxX = canvasWidth
  for (const node of nodes) {
    maxY = Math.max(maxY, node.y + TREE_CARD_HEIGHT)
    maxX = Math.max(maxX, node.x + TREE_CARD_WIDTH)
  }

  return {
    nodes,
    connectors,
    width: maxX + TREE_PADDING,
    height: maxY + TREE_PADDING,
    rootId,
  }
}

export function generationLabel(generation: number, rootName: string): string {
  if (generation === 0) return `Present · ${rootName.split(' ')[0]}'s generation`
  if (generation === 110) return 'Extended family'
  if (generation === 1) return 'Parents'
  if (generation === 2) return 'Grandparents'
  return `${generation} generations before present`
}
