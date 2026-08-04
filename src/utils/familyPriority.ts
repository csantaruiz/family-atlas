import type { Person } from '../types'

/**
 * Generations closest to the atlas root (present).
 * Ancestors use positive gen (1 = parents); descendants use negative (−1 = children).
 * Root spouses are stored as generation 0.
 */
export function isNearGeneration(person: Person, maxGen = 2): boolean {
  return person.generation != null && Math.abs(person.generation) <= maxGen
}

/** Absolute distance from root for ranking (0 = closest). Null → far. */
export function generationDistance(person: Person): number {
  if (person.generation == null) return 99
  return Math.abs(person.generation)
}

/**
 * Prefer people closer to the present/root over distant relatives.
 * |gen| 0 → 240 … |gen| 6 → 0.
 */
export function generationProximityScore(person: Person): number {
  if (person.generation == null) return 0
  return Math.max(0, 240 - Math.abs(person.generation) * 40)
}
