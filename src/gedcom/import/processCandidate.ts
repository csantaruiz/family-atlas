import { collectStaticAtlasAttachments } from '../attachments'
import { planGedcomReconciliation } from '../planGedcomReconciliation'
import { parseGedcom } from '../parseGedcom'
import { diffFamilyGraphs } from '../diffFamilyGraphs'
import type { FamilyGraph } from '../types'
import { candidateBlockers, type CandidateBlocker } from './blockers'
import { familySnapshotFromGraph, type FamilySnapshot } from './snapshotFromGraph'
import { validateGedcomBytes } from './validateGedcom'
import type { FamilyDiff } from '../types'

export type CandidateProcessFailure = {
  status: 'failed'
  errorCode: 'empty' | 'malformed' | 'parse_failed'
  errorMessage: string
}

export type CandidateProcessSuccess = {
  status: 'ready'
  snapshot: FamilySnapshot
  graph: FamilyGraph
  diff: FamilyDiff
  blockers: CandidateBlocker[]
  personCount: number
  familyCount: number
  reconciliationSummary: ReconciliationPlan['summary']
  compactDiff: {
    addedPeople: FamilyDiff['addedPeople']
    removedPeople: FamilyDiff['removedPeople']
    idChangedMatches: FamilyDiff['idChangedMatches']
    nameChanges: FamilyDiff['nameChanges']
    dateChanges: FamilyDiff['dateChanges']
    placeChanges: FamilyDiff['placeChanges']
    relationshipChanges: FamilyDiff['relationshipChanges']
    marriageChanges: FamilyDiff['marriageChanges']
    ambiguousMatches: FamilyDiff['ambiguousMatches']
  }
  compactReconciliation: {
    identity: ReconciliationPlan['identity']
    attachments: ReconciliationPlan['attachments']
  }
}

export type CandidateProcessResult = CandidateProcessFailure | CandidateProcessSuccess

type ReconciliationPlan = import('../planGedcomReconciliation').ReconciliationPlan

export function processCandidateGedcom(input: {
  bytes: Uint8Array
  current: FamilyGraph
  currentRootId: string
  media?: import('../attachments').PersonAttachment[]
  placeOverrides?: import('../attachments').OverrideAttachment[]
  eventOverrides?: import('../attachments').OverrideAttachment[]
}): CandidateProcessResult {
  const validated = validateGedcomBytes(input.bytes)
  if (!validated.ok) {
    return {
      status: 'failed',
      errorCode: validated.code === 'too_large' ? 'malformed' : validated.code,
      errorMessage: validated.message,
    }
  }

  let graph: FamilyGraph
  try {
    graph = parseGedcom(validated.text)
  } catch {
    return {
      status: 'failed',
      errorCode: 'parse_failed',
      errorMessage: 'The GEDCOM file could not be read.',
    }
  }
  if (graph.people.length === 0) {
    return {
      status: 'failed',
      errorCode: 'parse_failed',
      errorMessage: 'No people were found in this GEDCOM file.',
    }
  }

  const snapshot = familySnapshotFromGraph(graph, input.currentRootId)
  const diff = diffFamilyGraphs(input.current, graph)
  const staticAttachments = collectStaticAtlasAttachments()
  const plan = planGedcomReconciliation(diff, {
    current: input.current,
    candidate: graph,
    media: input.media ?? [],
    stories: staticAttachments.stories,
    documentary: staticAttachments.documentary,
    placeOverrides: input.placeOverrides ?? [],
    eventOverrides: input.eventOverrides ?? [],
  })

  return {
    status: 'ready',
    snapshot,
    graph,
    diff,
    blockers: candidateBlockers(plan),
    personCount: graph.people.length,
    familyCount: graph.families.length,
    reconciliationSummary: plan.summary,
    compactDiff: {
      addedPeople: diff.addedPeople,
      removedPeople: diff.removedPeople,
      idChangedMatches: diff.idChangedMatches,
      nameChanges: diff.nameChanges,
      dateChanges: diff.dateChanges,
      placeChanges: diff.placeChanges,
      relationshipChanges: diff.relationshipChanges,
      marriageChanges: diff.marriageChanges,
      ambiguousMatches: diff.ambiguousMatches,
    },
    compactReconciliation: {
      identity: plan.identity.filter((row: { tier: string }) => row.tier !== 'exact'),
      attachments: plan.attachments,
    },
  }
}
