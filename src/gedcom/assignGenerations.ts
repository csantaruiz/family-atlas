import type { Person } from '../types'

/**
 * Same walk as scripts/import-gedcom.py:
 * root = 0, ancestors +, descendants −, root spouses share 0.
 * People not reached stay generation null.
 */
export function assignPersonGenerations(people: Person[], rootId: string): Person[] {
  const byId = new Map(people.map((person) => [person.id, person]))
  const generation = new Map<string, number>()
  if (!byId.has(rootId)) {
    return people.map((person) => ({
      ...person,
      generation: person.id === rootId ? 0 : null,
      focus: person.id === rootId,
    }))
  }

  generation.set(rootId, 0)
  const ancestors: string[] = [rootId]
  for (let i = 0; i < ancestors.length; i += 1) {
    const person = byId.get(ancestors[i]!)
    if (!person) continue
    const gen = generation.get(person.id) ?? 0
    for (const parentId of person.parents ?? []) {
      if (generation.has(parentId) || !byId.has(parentId)) continue
      generation.set(parentId, gen + 1)
      ancestors.push(parentId)
    }
  }

  const descendants: string[] = [rootId]
  for (let i = 0; i < descendants.length; i += 1) {
    const person = byId.get(descendants[i]!)
    if (!person) continue
    const gen = generation.get(person.id) ?? 0
    for (const childId of person.children ?? []) {
      if (generation.has(childId) || !byId.has(childId)) continue
      generation.set(childId, gen - 1)
      descendants.push(childId)
    }
  }

  const root = byId.get(rootId)
  for (const spouseId of root?.spouses ?? []) {
    if (!generation.has(spouseId) && byId.has(spouseId)) generation.set(spouseId, 0)
  }

  return people.map((person) => ({
    ...person,
    generation: generation.has(person.id) ? generation.get(person.id)! : null,
    focus: generation.has(person.id),
  }))
}

/** Header “generations” count: deepest numbered generation from the root, plus the present. */
export function generationCountFromPeople(people: Person[]): number {
  return (
    Math.max(
      0,
      ...people.map((person) => (person.generation != null ? Math.abs(person.generation) : 0)),
    ) + 1
  )
}
