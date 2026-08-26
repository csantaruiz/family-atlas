import type { Person } from '../types'
import { primaryRootIds } from '../utils/householdRoots'

/**
 * Generations relative to the household (archive root + household co-root):
 * household = 0, ancestors +, descendants −.
 * Other spouses stay unnumbered so their ancestry is not pulled in.
 */
export function assignPersonGenerations(people: Person[], rootId: string): Person[] {
  const byId = new Map(people.map((person) => [person.id, person]))
  const generation = new Map<string, number>()
  const roots = primaryRootIds(rootId, people).filter((id) => byId.has(id))
  if (!roots.length) {
    return people.map((person) => ({
      ...person,
      generation: person.id === rootId ? 0 : null,
      focus: person.id === rootId,
    }))
  }

  for (const id of roots) generation.set(id, 0)

  for (const root of roots) {
    const ancestors: string[] = [root]
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
  }

  for (const root of roots) {
    const descendants: string[] = [root]
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
  }

  return people.map((person) => {
    const nextGeneration = generation.has(person.id) ? generation.get(person.id)! : null
    const nextFocus = generation.has(person.id)
    if (person.generation === nextGeneration && person.focus === nextFocus) return person
    return { ...person, generation: nextGeneration, focus: nextFocus }
  })
}

/** Header “generations” count: deepest numbered generation from the household, plus the present. */
export function generationCountFromPeople(people: Person[]): number {
  return (
    Math.max(
      0,
      ...people.map((person) => (person.generation != null ? Math.abs(person.generation) : 0)),
    ) + 1
  )
}
