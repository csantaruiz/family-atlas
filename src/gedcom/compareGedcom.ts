import { currentFamilyGraph } from './graphFromCurrent'
import { diffFamilyGraphs } from './diffFamilyGraphs'
import { parseGedcom } from './parseGedcom'
import type { FamilyDiff, FamilyGraph } from './types'

export function compareFamilyGraphs(current: FamilyGraph, candidate: FamilyGraph): FamilyDiff {
  return diffFamilyGraphs(current, candidate)
}

/** Parse a candidate GEDCOM and diff it against the live FamilyDatabase. */
export function compareGedcomToCurrent(gedcomText: string): FamilyDiff {
  return diffFamilyGraphs(currentFamilyGraph(), parseGedcom(gedcomText))
}

export function compareGedcomTexts(currentGedcomText: string, candidateGedcomText: string): FamilyDiff {
  return diffFamilyGraphs(parseGedcom(currentGedcomText), parseGedcom(candidateGedcomText))
}
