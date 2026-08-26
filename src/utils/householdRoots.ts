import type { Person } from '../types'

function peopleMap(people: Person[] | Record<string, Person>): Map<string, Person> {
  if (Array.isArray(people)) return new Map(people.map((person) => [person.id, person]))
  return new Map(Object.entries(people))
}

/** Spouse of the archive root who shares children, otherwise the first spouse. */
export function householdCoRootId(
  rootId: string,
  people: Person[] | Record<string, Person>,
): string | null {
  const byId = peopleMap(people)
  const root = byId.get(rootId)
  if (!root) return null
  const spouseIds = root.spouses ?? []
  if (!spouseIds.length) return null

  const rootChildren = new Set(root.children ?? [])
  const shared = spouseIds.find((spouseId) => {
    const spouse = byId.get(spouseId)
    if (!spouse) return false
    return (spouse.children ?? []).some((childId) => rootChildren.has(childId))
  })
  if (shared && byId.has(shared)) return shared

  const first = spouseIds.find((id) => byId.has(id))
  return first ?? null
}

/** Archive root plus household co-root. Graph-driven; not name-specific. */
export function primaryRootIds(
  rootId: string,
  people: Person[] | Record<string, Person>,
): string[] {
  const ids = [rootId]
  const coRoot = householdCoRootId(rootId, people)
  if (coRoot && coRoot !== rootId) ids.push(coRoot)
  return ids
}
