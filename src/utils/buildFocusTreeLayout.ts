import type { Person } from '../types'
import { assignPersonGenerations } from '../gedcom/assignGenerations'
import { primaryRootIds } from './householdRoots'
import {
  CARD_CONNECTOR_GAP,
  TREE_CARD_HEIGHT,
  TREE_CARD_WIDTH,
  TREE_H_GAP,
  TREE_PADDING,
  TREE_V_GAP,
  type PositionedTreeNode,
  type TreeBounds,
  type TreeConnector,
} from './buildFamilyTree'

export { CARD_CONNECTOR_GAP }
import {
  selectFocusNeighborhood,
  type ParentExpandTarget,
} from './treeNeighborhood'
import { assertFocusTreeIntegrity } from './treeIntegrity'

/** Compact +Parents control size (overlay only — not a layout node). */
export const PARENTS_CONTROL_WIDTH = 96
export const PARENTS_CONTROL_HEIGHT = 30
/** Gap between card top and +Parents control bottom. */
export const PARENTS_CONTROL_GAP = 10

/** Focus couple is always pinned here so expands don't translate existing people. */
const STABLE_FOCUS_X = 400
const STABLE_FOCUS_Y = 420

export type ParentsOverlay = ParentExpandTarget & {
  x: number
  y: number
}

export type FocusTreeLayout = {
  nodes: PositionedTreeNode[]
  connectors: TreeConnector[]
  /** UI overlays anchored to people — never genealogy layout nodes. */
  parentsOverlays: ParentsOverlay[]
  width: number
  height: number
  focusIds: string[]
  isHouseholdFocus: boolean
  householdIds: string[]
  coupleBounds: TreeBounds | null
  neighborhoodBounds: TreeBounds
  pathTowardHome: string[]
}

type Pos = { x: number; y: number }

function parentsInSet(person: Person, ids: Set<string>, peopleById: Record<string, Person>) {
  return (person.parents ?? [])
    .map((id) => peopleById[id])
    .filter((p): p is Person => Boolean(p && ids.has(p.id)))
    .sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999))
}

function childrenInSet(person: Person, ids: Set<string>, peopleById: Record<string, Person>) {
  return (person.children ?? [])
    .map((id) => peopleById[id])
    .filter((p): p is Person => Boolean(p && ids.has(p.id)))
    .sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999))
}

function canonicalChildrenOfCouple(
  parentIds: string[],
  personIds: Set<string>,
  peopleById: Record<string, Person>,
): Person[] {
  const kids = new Map<string, Person>()
  for (const parentId of parentIds) {
    const parent = peopleById[parentId]
    if (!parent) continue
    for (const child of childrenInSet(parent, personIds, peopleById)) {
      const parents = new Set(child.parents ?? [])
      if (parentIds.some((id) => parents.has(id))) kids.set(child.id, child)
    }
  }
  return [...kids.values()].sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999))
}

function centerOf(pos: Pos) {
  return { x: pos.x + TREE_CARD_WIDTH / 2, y: pos.y + TREE_CARD_HEIGHT / 2 }
}

function cardBottom(pos: Pos) {
  return pos.y + TREE_CARD_HEIGHT
}

/** Horizontal couple rail: just below the lowest card in the pair. */
function coupleRailYFromCards(cards: Pos[]) {
  return Math.max(...cards.map(cardBottom)) + CARD_CONNECTOR_GAP
}

/**
 * Push a horizontal segment Y downward until it clears every overlapping card
 * in the family unit (never draw through / against a card edge).
 */
function clearHorizontalSegmentY(
  preferredY: number,
  cards: Pos[],
  xMin: number,
  xMax: number,
): number {
  let y = preferredY
  let guard = 0
  while (guard < 12) {
    guard += 1
    let blockedBottom = -Infinity
    for (const card of cards) {
      const cLeft = card.x
      const cRight = card.x + TREE_CARD_WIDTH
      if (cRight < xMin - 1 || cLeft > xMax + 1) continue
      const top = card.y
      const bottom = cardBottom(card)
      // Segment intersects the card's vertical span (including clearance band).
      if (y >= top - 1 && y <= bottom + CARD_CONNECTOR_GAP - 1) {
        blockedBottom = Math.max(blockedBottom, bottom)
      }
    }
    if (blockedBottom === -Infinity) break
    y = blockedBottom + CARD_CONNECTOR_GAP
  }
  return y
}

/**
 * Child-family horizontal bus in the negative space between parent bottoms and child tops.
 * Starts from card bottoms (+ clearance), not a fixed generation-row Y.
 */
function childBusY(parents: Pos[], children: Pos[], fromY: number): number {
  const parentBottom = Math.max(...parents.map(cardBottom))
  const childTop = Math.min(...children.map((c) => c.y))
  const xMin = Math.min(...[...parents, ...children].map((p) => p.x))
  const xMax = Math.max(...[...parents, ...children].map((p) => p.x + TREE_CARD_WIDTH))

  // Prefer mid of the open band below the connector start (rail or parent bottom).
  const bandTop = Math.max(fromY, parentBottom + CARD_CONNECTOR_GAP)
  const bandBottom = childTop - CARD_CONNECTOR_GAP
  let preferred =
    bandBottom > bandTop + 4 ? bandTop + (bandBottom - bandTop) * 0.55 : (fromY + childTop) / 2

  // Keep a short stem under a couple rail when space allows.
  if (fromY > parentBottom + 2) {
    preferred = Math.max(preferred, fromY + Math.min(16, Math.max(4, (childTop - fromY) * 0.25)))
  }

  preferred = Math.min(Math.max(preferred, fromY + 2), childTop - 2)
  return clearHorizontalSegmentY(preferred, [...parents, ...children], xMin, xMax)
}

function elbowPath(x1: number, y1: number, x2: number, y2: number, horizontalY: number) {
  return `M ${x1} ${y1} V ${horizontalY} H ${x2} V ${y2}`
}

function unitWidth(count: number) {
  if (count <= 0) return 0
  return count * TREE_CARD_WIDTH + Math.max(0, count - 1) * TREE_H_GAP
}

function boundsFor(nodes: PositionedTreeNode[], ids: Set<string>): TreeBounds | null {
  let bounds: TreeBounds | null = null
  for (const node of nodes) {
    if (!ids.has(node.person.id)) continue
    const maxX = node.x + TREE_CARD_WIDTH
    const maxY = node.y + TREE_CARD_HEIGHT
    if (!bounds) bounds = { minX: node.x, minY: node.y, maxX, maxY }
    else {
      bounds.minX = Math.min(bounds.minX, node.x)
      bounds.minY = Math.min(bounds.minY, node.y)
      bounds.maxX = Math.max(bounds.maxX, maxX)
      bounds.maxY = Math.max(bounds.maxY, maxY)
    }
  }
  return bounds
}

function overlapsX(a: { min: number; max: number }, b: { min: number; max: number }, gap: number) {
  return !(a.max + gap <= b.min || b.max + gap <= a.min)
}

function isCanonicalParentChild(
  parentId: string,
  childId: string,
  peopleById: Record<string, Person>,
) {
  return Boolean(peopleById[childId]?.parents?.includes(parentId))
}

/**
 * Deterministic focus-neighborhood layout.
 * Same (focus, revealedIds) ⇒ same geometry. Continuations are overlays only.
 */
export function buildFocusTreeLayout(
  peopleById: Record<string, Person>,
  archiveRootId: string,
  focusPersonId: string | null,
  maxUp: number,
  maxDown: number,
  revealedIds: ReadonlySet<string> = new Set(),
): FocusTreeLayout {
  const numbered = assignPersonGenerations(Object.values(peopleById), archiveRootId)
  peopleById = Object.fromEntries(numbered.map((person) => [person.id, person]))

  const neighborhood = selectFocusNeighborhood(
    peopleById,
    archiveRootId,
    focusPersonId,
    maxUp,
    maxDown,
    revealedIds,
  )
  const { focusIds, isHouseholdFocus, personIds, parentExpands, pathTowardHome } = neighborhood
  const householdIds = primaryRootIds(archiveRootId, peopleById)
  const positions = new Map<string, Pos>()

  const emptyBounds = {
    minX: 0,
    minY: 0,
    maxX: 400,
    maxY: 300,
  } satisfies TreeBounds

  const primaryId = focusIds[0]
  const primary = peopleById[primaryId]
  if (!primary) {
    return {
      nodes: [],
      connectors: [],
      parentsOverlays: [],
      width: 400,
      height: 300,
      focusIds,
      isHouseholdFocus,
      householdIds,
      coupleBounds: null,
      neighborhoodBounds: emptyBounds,
      pathTowardHome,
    }
  }

  const partnerId =
    focusIds[1] ??
    (primary.spouses ?? []).find((id) => personIds.has(id) && peopleById[id]) ??
    null

  const coupleGap = TREE_CARD_WIDTH + TREE_H_GAP
  const focalPair = [primaryId, partnerId].filter(Boolean) as string[]

  // Pin focal couple at a stable origin first (family unit).
  if (partnerId) {
    positions.set(primaryId, { x: 0, y: 0 })
    positions.set(partnerId, { x: coupleGap, y: 0 })
  } else {
    positions.set(primaryId, { x: 0, y: 0 })
  }

  const midX = partnerId ? coupleGap / 2 + TREE_CARD_WIDTH / 2 : TREE_CARD_WIDTH / 2

  const placeParentsAbove = (
    childId: string,
    prefer: 'center' | 'left' | 'right',
  ): { min: number; max: number } | null => {
    const childPos = positions.get(childId)
    const child = peopleById[childId]
    if (!childPos || !child) return null
    const parents = parentsInSet(child, personIds, peopleById).filter((p) => !positions.has(p.id))
    if (!parents.length) return null

    const parentY = childPos.y - TREE_V_GAP - TREE_CARD_HEIGHT
    const childCx = centerOf(childPos).x
    const width = unitWidth(parents.length)
    let left = childCx - width / 2
    if (prefer === 'left') left = childCx - width + TREE_CARD_WIDTH / 2
    if (prefer === 'right') left = childCx - TREE_CARD_WIDTH / 2

    let cursor = left
    for (const parent of parents) {
      positions.set(parent.id, { x: cursor, y: parentY })
      cursor += TREE_CARD_WIDTH + TREE_H_GAP
    }
    return { min: left, max: left + width }
  }

  const resolveParentBands = (bands: { childId: string; band: { min: number; max: number } }[]) => {
    for (let pass = 0; pass < 8; pass += 1) {
      let moved = false
      for (let i = 0; i < bands.length; i += 1) {
        for (let j = i + 1; j < bands.length; j += 1) {
          const a = bands[i]
          const b = bands[j]
          if (!overlapsX(a.band, b.band, TREE_H_GAP)) continue
          const overlap = a.band.max + TREE_H_GAP - b.band.min
          const shift = Math.ceil(overlap / 2) + 4
          const leftBand = a.band.min <= b.band.min ? a : b
          const rightBand = leftBand === a ? b : a
          for (const parent of parentsInSet(peopleById[leftBand.childId], personIds, peopleById)) {
            const pos = positions.get(parent.id)
            if (pos) pos.x -= shift
          }
          for (const parent of parentsInSet(peopleById[rightBand.childId], personIds, peopleById)) {
            const pos = positions.get(parent.id)
            if (pos) pos.x += shift
          }
          leftBand.band = { min: leftBand.band.min - shift, max: leftBand.band.max - shift }
          rightBand.band = { min: rightBand.band.min + shift, max: rightBand.band.max + shift }
          moved = true
        }
      }
      if (!moved) break
    }
  }

  // Ancestors upward from placed people.
  for (let generation = 0; generation < 12; generation += 1) {
    const needing = [...positions.keys()].filter((id) => {
      const person = peopleById[id]
      return person && parentsInSet(person, personIds, peopleById).some((p) => !positions.has(p.id))
    })
    if (!needing.length) break
    const bands: { childId: string; band: { min: number; max: number } }[] = []
    for (const childId of needing) {
      const childPos = positions.get(childId)!
      const prefer: 'left' | 'right' | 'center' =
        centerOf(childPos).x < midX - 10
          ? 'left'
          : centerOf(childPos).x > midX + 10
            ? 'right'
            : 'center'
      const firstPrefer =
        generation === 0 && focalPair.length === 2
          ? childId === focalPair[0]
            ? 'left'
            : childId === focalPair[1]
              ? 'right'
              : prefer
          : prefer
      const band = placeParentsAbove(childId, firstPrefer)
      if (band) bands.push({ childId, band })
    }
    resolveParentBands(bands)
  }

  const placeChildRow = (parentIds: string[], kids: Person[], y: number) => {
    if (!kids.length) return
    const totalW = unitWidth(kids.length)
    const parentCenters = parentIds
      .map((id) => positions.get(id))
      .filter(Boolean)
      .map((pos) => centerOf(pos!).x)
    const mid =
      parentCenters.length > 0
        ? parentCenters.reduce((a, b) => a + b, 0) / parentCenters.length
        : midX
    let cursor = mid - totalW / 2
    for (const child of kids) {
      if (positions.has(child.id)) continue
      positions.set(child.id, { x: cursor, y })
      cursor += TREE_CARD_WIDTH + TREE_H_GAP
    }
  }

  const placeBeside = (personId: string, anchorId: string) => {
    if (positions.has(personId) || !peopleById[personId]) return
    const anchor = positions.get(anchorId)
    if (!anchor) return
    positions.set(personId, { x: anchor.x + TREE_CARD_WIDTH + TREE_H_GAP, y: anchor.y })
  }

  // Canonical children of the focal couple only.
  const directChildren = canonicalChildrenOfCouple(focalPair, personIds, peopleById)
  const directChildIds = new Set(directChildren.map((c) => c.id))
  placeChildRow(focalPair, directChildren, TREE_CARD_HEIGHT + TREE_V_GAP)

  for (const child of directChildren) {
    for (const spouseId of child.spouses ?? []) {
      if (!personIds.has(spouseId) || positions.has(spouseId)) continue
      const shares = (peopleById[spouseId]?.children ?? []).some((cid) => personIds.has(cid))
      if (shares || pathTowardHome.includes(spouseId)) placeBeside(spouseId, child.id)
    }
  }

  // Path toward home as a vertical chain of canonical hops.
  for (let i = 0; i < pathTowardHome.length - 1; i += 1) {
    const ancestorId = pathTowardHome[i]
    const descendantId = pathTowardHome[i + 1]
    if (!personIds.has(descendantId) || !peopleById[descendantId]) continue
    if (!isCanonicalParentChild(ancestorId, descendantId, peopleById)) continue
    if (!positions.has(descendantId)) {
      const ancestorPos = positions.get(ancestorId)
      if (!ancestorPos) continue
      const spouseBeside = (peopleById[ancestorId]?.spouses ?? []).find(
        (sid) => positions.has(sid) && Math.abs(positions.get(sid)!.y - ancestorPos.y) < 2,
      )
      placeChildRow(
        spouseBeside ? [ancestorId, spouseBeside] : [ancestorId],
        [peopleById[descendantId]],
        ancestorPos.y + TREE_CARD_HEIGHT + TREE_V_GAP,
      )
    }
    const descendant = peopleById[descendantId]
    for (const spouseId of descendant?.spouses ?? []) {
      if (!personIds.has(spouseId) || positions.has(spouseId)) continue
      if (
        householdIds.includes(spouseId) ||
        pathTowardHome.includes(spouseId) ||
        (peopleById[spouseId]?.children ?? []).some((cid) => personIds.has(cid))
      ) {
        placeBeside(spouseId, descendantId)
      }
    }
  }

  // Remaining canonical children of already-placed parents.
  for (let pass = 0; pass < 6; pass += 1) {
    let placedAny = false
    for (const id of personIds) {
      if (positions.has(id) || !peopleById[id]) continue
      const placedParents = parentsInSet(peopleById[id], new Set(positions.keys()), peopleById)
      if (!placedParents.length) continue
      if (!placedParents.some((p) => isCanonicalParentChild(p.id, id, peopleById))) continue
      let maxParentY = -Infinity
      for (const p of placedParents) maxParentY = Math.max(maxParentY, positions.get(p.id)!.y)
      placeChildRow(
        placedParents.map((p) => p.id),
        [peopleById[id]],
        maxParentY + TREE_CARD_HEIGHT + TREE_V_GAP,
      )
      placedAny = true
    }
    if (!placedAny) break
  }

  // Pin focus couple to a stable content origin so the same focus ⇒ same geometry.
  const focusLeft = positions.get(primaryId)!.x
  const focusRight = partnerId
    ? positions.get(partnerId)!.x + TREE_CARD_WIDTH
    : focusLeft + TREE_CARD_WIDTH
  const focusMidX = (focusLeft + focusRight) / 2
  const focusY = positions.get(primaryId)!.y
  const pinX = STABLE_FOCUS_X - focusMidX
  const pinY = STABLE_FOCUS_Y - focusY
  for (const pos of positions.values()) {
    pos.x += pinX
    pos.y += pinY
  }

  // Ensure non-negative coordinates with fixed top room for overlays (does not use
  // continuation slots — only people drive geometry).
  let minX = Infinity
  let minY = Infinity
  let maxX = 0
  let maxY = 0
  for (const pos of positions.values()) {
    minX = Math.min(minX, pos.x)
    minY = Math.min(minY, pos.y)
    maxX = Math.max(maxX, pos.x + TREE_CARD_WIDTH)
    maxY = Math.max(maxY, pos.y + TREE_CARD_HEIGHT)
  }
  const padTop = TREE_PADDING + PARENTS_CONTROL_HEIGHT + PARENTS_CONTROL_GAP
  const fixX = minX < TREE_PADDING ? TREE_PADDING - minX : 0
  const fixY = minY < padTop ? padTop - minY : 0
  if (fixX || fixY) {
    for (const pos of positions.values()) {
      pos.x += fixX
      pos.y += fixY
    }
    maxX += fixX
    maxY += fixY
  }

  // --- Connectors ONLY after final coordinates ---
  // Expected edges are derived from canonical parents among placed people.
  const connectors: TreeConnector[] = []
  const pushConnector = (connector: TreeConnector) => {
    if (connectors.some((c) => c.id === connector.id)) return
    if (!connector.path || /NaN|undefined|Infinity/.test(connector.path)) return
    connectors.push(connector)
  }

  const placedIds = new Set(positions.keys())
  const coupleDrawn = new Set<string>()

  const coupleKey = (a: string, b: string) => [a, b].sort().join('|')

  const drawCoupleRail = (idA: string, idB: string) => {
    const posA = positions.get(idA)
    const posB = positions.get(idB)
    if (!posA || !posB) return
    const key = coupleKey(idA, idB)
    if (coupleDrawn.has(key)) return
    const spousesA = new Set(peopleById[idA]?.spouses ?? [])
    const spousesB = new Set(peopleById[idB]?.spouses ?? [])
    if (!spousesA.has(idB) && !spousesB.has(idA)) return
    coupleDrawn.add(key)
    const left = posA.x <= posB.x ? posA : posB
    const right = posA.x <= posB.x ? posB : posA
    const leftId = posA.x <= posB.x ? idA : idB
    const rightId = posA.x <= posB.x ? idB : idA
    const leftCx = centerOf(left).x
    const rightCx = centerOf(right).x
    const railY = clearHorizontalSegmentY(
      coupleRailYFromCards([left, right]),
      [left, right],
      Math.min(left.x, right.x),
      Math.max(left.x, right.x) + TREE_CARD_WIDTH,
    )
    pushConnector({
      id: `couple-${leftId}-${rightId}`,
      kind: 'couple',
      path: `M ${leftCx} ${railY} H ${rightCx}`,
    })
  }

  // Focal / any visible spouse pair at the same generation.
  if (partnerId && positions.has(partnerId)) {
    drawCoupleRail(primaryId, partnerId)
  }

  // Every placed person → visible canonical parents (including the focal person).
  for (const childId of placedIds) {
    const child = peopleById[childId]
    const childPos = positions.get(childId)
    if (!child || !childPos) continue

    const parents = (child.parents ?? [])
      .filter((pid) => placedIds.has(pid) && isCanonicalParentChild(pid, childId, peopleById))
      .map((pid) => ({ id: pid, pos: positions.get(pid)! }))
      .sort((a, b) => a.pos.x - b.pos.x)

    if (!parents.length) continue

    const childCx = centerOf(childPos).x
    const parentCards = parents.map((p) => p.pos)

    if (parents.length === 1) {
      const parent = parents[0]
      const fromX = centerOf(parent.pos).x
      const fromY = cardBottom(parent.pos)
      const busY = childBusY(parentCards, [childPos], fromY)
      pushConnector({
        id: `pc-${parent.id}-${childId}`,
        kind: 'parent-child',
        path: elbowPath(fromX, fromY, childCx, childPos.y, busY),
      })
      continue
    }

    // Two+ parents: couple rail + drop from union midpoint onto a cleared child bus.
    const left = parents[0]
    const right = parents[parents.length - 1]
    drawCoupleRail(left.id, right.id)
    const leftCx = centerOf(left.pos).x
    const rightCx = centerOf(right.pos).x
    const railY = clearHorizontalSegmentY(
      coupleRailYFromCards(parentCards),
      parentCards,
      Math.min(...parentCards.map((p) => p.x)),
      Math.max(...parentCards.map((p) => p.x + TREE_CARD_WIDTH)),
    )
    const busY = childBusY(parentCards, [childPos], railY)
    pushConnector({
      id: `pc-union-${parents.map((p) => p.id).join('_')}-${childId}`,
      kind: 'parent-child',
      path: elbowPath((leftCx + rightCx) / 2, railY, childCx, childPos.y, busY),
    })
  }

  // Spouse rails for other visible couples that share a visible child (if not already drawn).
  for (const id of placedIds) {
    const person = peopleById[id]
    if (!person) continue
    for (const spouseId of person.spouses ?? []) {
      if (!placedIds.has(spouseId)) continue
      const shareChild = (person.children ?? []).some(
        (cid) =>
          placedIds.has(cid) && (peopleById[cid]?.parents ?? []).includes(spouseId),
      )
      if (shareChild) drawCoupleRail(id, spouseId)
    }
  }

  // Overlays: anchored to person card centers, then de-collide horizontally.
  const parentsOverlays: ParentsOverlay[] = []
  for (const target of parentExpands) {
    const anchor = positions.get(target.personId)
    if (!anchor) continue
    const stillHidden = target.parentIds.filter((id) => peopleById[id] && !placedIds.has(id))
    if (!stillHidden.length) continue
    parentsOverlays.push({
      ...target,
      parentIds: stillHidden,
      x: anchor.x + (TREE_CARD_WIDTH - PARENTS_CONTROL_WIDTH) / 2,
      y: anchor.y - PARENTS_CONTROL_GAP - PARENTS_CONTROL_HEIGHT,
    })
  }

  // Nudge overlapping +Parents pills apart (never into person cards).
  parentsOverlays.sort((a, b) => a.x - b.x || a.y - b.y)
  for (let pass = 0; pass < 4; pass += 1) {
    let moved = false
    for (let i = 0; i < parentsOverlays.length; i += 1) {
      for (let j = i + 1; j < parentsOverlays.length; j += 1) {
        const a = parentsOverlays[i]
        const b = parentsOverlays[j]
        if (Math.abs(a.y - b.y) > PARENTS_CONTROL_HEIGHT) continue
        const gap = 6
        if (a.x + PARENTS_CONTROL_WIDTH + gap <= b.x) continue
        const overlap = a.x + PARENTS_CONTROL_WIDTH + gap - b.x
        const shift = Math.ceil(overlap / 2)
        a.x -= shift
        b.x += shift
        moved = true
      }
    }
    if (!moved) break
  }

  // Keep overlays within their person card's horizontal neighborhood when possible.
  for (const overlay of parentsOverlays) {
    const anchor = positions.get(overlay.personId)
    if (!anchor) continue
    const minX = anchor.x - TREE_CARD_WIDTH * 0.35
    const maxX = anchor.x + TREE_CARD_WIDTH - PARENTS_CONTROL_WIDTH + TREE_CARD_WIDTH * 0.35
    overlay.x = Math.min(maxX, Math.max(minX, overlay.x))
  }

  const focusGeneration = (person: Person) => {
    if (focusIds.includes(person.id)) return 0
    const base = peopleById[focusIds[0]]?.generation
    if (base == null || person.generation == null) return 0
    return person.generation - base
  }

  const nodes: PositionedTreeNode[] = [...positions.entries()]
    .map(([id, pos]) => {
      const person = peopleById[id]
      if (!person) return null
      return { person, generation: focusGeneration(person), x: pos.x, y: pos.y }
    })
    .filter((n): n is PositionedTreeNode => Boolean(n))

  const focusIdSet = new Set(focusIds)
  if (partnerId) focusIdSet.add(partnerId)
  const coupleBounds = boundsFor(nodes, focusIdSet)
  const neighborhoodBounds =
    boundsFor(nodes, new Set(nodes.map((n) => n.person.id))) ?? emptyBounds

  const layout: FocusTreeLayout = {
    nodes,
    connectors,
    parentsOverlays,
    width: Math.max(maxX + TREE_PADDING, 480),
    height: Math.max(maxY + TREE_PADDING + 48, 360),
    focusIds,
    isHouseholdFocus,
    householdIds,
    coupleBounds,
    neighborhoodBounds,
    pathTowardHome,
  }

  assertFocusTreeIntegrity(layout, peopleById, { directChildIds, focalPair })
  return layout
}
