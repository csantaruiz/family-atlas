import type { Person } from '../types'

/** Generations closest to the atlas root (present) — self, parents, grandparents. */
export function isNearGeneration(person: Person, maxGen = 2): boolean {
  return person.generation != null && person.generation <= maxGen
}

/**
 * Prefer people closer to the present/root over distant relatives.
 * gen 0 → 240 … gen 6 → 0.
 */
export function generationProximityScore(person: Person): number {
  if (person.generation == null) return 0
  return Math.max(0, 240 - person.generation * 40)
}
