import type { FamilyDiff } from './types'

export function formatFamilyDiffSummary(diff: FamilyDiff): string {
  const s = diff.summary
  return [
    `People: ${s.currentPeople} current → ${s.candidatePeople} candidate`,
    `Unchanged: ${s.unchangedPeople}`,
    `Same person, GEDCOM id changed: ${s.idChangedMatches}`,
    `Added: ${s.addedPeople}`,
    `Removed: ${s.removedPeople}`,
    `Name changes: ${s.nameChanges}`,
    `Date/event changes: ${s.dateChanges}`,
    `Relationship changes: ${s.relationshipChanges}`,
    `Place string changes: ${s.placeChanges}`,
    `Marriage changes: ${s.marriageChanges}`,
    `Ambiguous identity (review): ${s.ambiguousMatches}`,
  ].join('\n')
}
