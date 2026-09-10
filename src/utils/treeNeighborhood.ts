import type { Person } from '../types'
import { primaryRootIds, householdCoRootId } from './householdRoots'

/** Base visible generations around focus before any +Parents expand. */
export const BASE_UP_DEPTH = 1
export const BASE_DOWN_DEPTH = 1

export type ParentExpandTarget = {
  /** Person whose parents are hidden. */
  personId: string
  /** Canonical parent ids to reveal on expand. */
  parentIds: string[]
  /** Remaining ancestor count beyond those parents (informational). */
  deeperCount: number
}

export type TreeNeighborhood = {
  focusIds: string[]
  isHouseholdFocus: boolean
  personIds: Set<string>
  /** Overlay targets only — never layout nodes. */
  parentExpands: ParentExpandTarget[]
  pathTowardHome: string[]
}

function collectAncestors(
  startId: string,
  peopleById: Record<string, Person>,
  maxDepth: number,
  into: Set<string>,
) {
  const walk = (id: string, depth: number) => {
    if (depth > maxDepth) return
    const person = peopleById[id]
    if (!person) return
    into.add(id)
    if (depth === maxDepth) return
    for (const parentId of person.parents ?? []) walk(parentId, depth + 1)
  }
  walk(startId, 0)
}

function collectDescendants(
  startId: string,
  peopleById: Record<string, Person>,
  maxDepth: number,
  into: Set<string>,
) {
  const walk = (id: string, depth: number, visited: Set<string>) => {
    if (depth > maxDepth || visited.has(id)) return
    const person = peopleById[id]
    if (!person) return
    visited.add(id)
    into.add(id)
    if (depth === maxDepth) return
    for (const childId of person.children ?? []) walk(childId, depth + 1, visited)
  }
  walk(startId, 0, new Set())
}

export function pathTowardHousehold(
  startId: string,
  householdIds: string[],
  peopleById: Record<string, Person>,
): string[] {
  const goals = new Set(householdIds)
  if (goals.has(startId)) return [startId]

  const cameFrom = new Map<string, string | null>()
  const queue = [startId]
  cameFrom.set(startId, null)

  while (queue.length) {
    const id = queue.shift()!
    const person = peopleById[id]
    if (!person) continue
    for (const childId of person.children ?? []) {
      if (cameFrom.has(childId) || !peopleById[childId]) continue
      cameFrom.set(childId, id)
      if (goals.has(childId)) {
        const path = [childId]
        let cursor: string | null = id
        while (cursor) {
          path.push(cursor)
          cursor = cameFrom.get(cursor) ?? null
        }
        return path.reverse()
      }
      queue.push(childId)
    }
  }
  return [startId]
}

function countDeeperAncestors(
  parentIds: string[],
  peopleById: Record<string, Person>,
  visible: Set<string>,
): number {
  let count = 0
  const queue = [...parentIds]
  const seen = new Set<string>(visible)
  for (const id of parentIds) seen.add(id)

  while (queue.length) {
    const id = queue.shift()!
    const person = peopleById[id]
    if (!person) continue
    for (const parentId of person.parents ?? []) {
      if (seen.has(parentId) || !peopleById[parentId]) continue
      seen.add(parentId)
      count += 1
      queue.push(parentId)
    }
  }
  return count
}

/**
 * Pure selection of visible people + overlay expand targets.
 * `revealedIds` = person ids revealed via +Parents (keyed by person, not row).
 */
export function selectFocusNeighborhood(
  peopleById: Record<string, Person>,
  archiveRootId: string,
  focusPersonId: string | null,
  maxUp: number,
  maxDown: number,
  revealedIds: ReadonlySet<string> = new Set(),
): TreeNeighborhood {
  const household = primaryRootIds(archiveRootId, peopleById)
  const coRoot = householdCoRootId(archiveRootId, peopleById)
  const requested = focusPersonId && peopleById[focusPersonId] ? focusPersonId : null
  const isHouseholdFocus =
    !requested || household.includes(requested) || requested === archiveRootId || requested === coRoot

  const focusIds = isHouseholdFocus ? household : [requested!]
  const personIds = new Set<string>()

  for (const id of focusIds) {
    collectAncestors(id, peopleById, maxUp, personIds)
    collectDescendants(id, peopleById, maxDown, personIds)
  }

  for (const id of revealedIds) {
    if (peopleById[id]) personIds.add(id)
  }

  let pathTowardHome: string[] = []
  if (!isHouseholdFocus && requested) {
    pathTowardHome = pathTowardHousehold(requested, household, peopleById)
    for (const id of pathTowardHome) personIds.add(id)
  } else {
    pathTowardHome = [...household]
  }

  // Focal spouses.
  for (const id of [...personIds]) {
    if (!focusIds.includes(id)) continue
    const person = peopleById[id]
    for (const spouseId of person?.spouses ?? []) {
      if (peopleById[spouseId]) personIds.add(spouseId)
    }
  }

  // Co-parents of visible children (union rails).
  for (const id of [...personIds]) {
    const person = peopleById[id]
    if (!person) continue
    for (const childId of person.children ?? []) {
      if (!personIds.has(childId)) continue
      for (const parentId of peopleById[childId]?.parents ?? []) {
        if (peopleById[parentId]) personIds.add(parentId)
      }
    }
  }

  // Spouses along the homeward path when they share a visible child.
  for (const id of pathTowardHome) {
    const person = peopleById[id]
    if (!person) continue
    for (const spouseId of person.spouses ?? []) {
      if (!peopleById[spouseId]) continue
      const shares = (peopleById[spouseId].children ?? []).some((cid) => personIds.has(cid))
      if (shares || focusIds.includes(id)) personIds.add(spouseId)
    }
  }

  const parentExpands: ParentExpandTarget[] = []
  for (const id of personIds) {
    const person = peopleById[id]
    if (!person) continue
    const hiddenParents = (person.parents ?? []).filter(
      (pid) => peopleById[pid] && !personIds.has(pid),
    )
    if (!hiddenParents.length) continue
    // Only offer expand when no parent is already visible.
    const anyVisible = (person.parents ?? []).some((pid) => personIds.has(pid))
    if (anyVisible) continue

    parentExpands.push({
      personId: id,
      parentIds: hiddenParents,
      deeperCount: countDeeperAncestors(hiddenParents, peopleById, personIds),
    })
  }

  return { focusIds, isHouseholdFocus, personIds, parentExpands, pathTowardHome }
}
