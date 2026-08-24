/**
 * Phase 2D.2 — in-memory GEDCOM reconciliation planner.
 * Pure: no writes, no active GEDCOM switch, no deletion.
 *
 * 2D.3 requirement: before any GEDCOM activation, Atlas must own a stable person
 * identity that is not `media_assets.person_id = current GEDCOM id`. This dry-run
 * still keys attachments by the current GEDCOM id because that is how they are
 * stored today. Activation must not treat that as the permanent architecture.
 */
import { placeEntityKey, placeSourceSignature, rebindOverride } from '../overrides/identity'
import type { AtlasAttachments, OverrideAttachment, PersonAttachment } from './attachments'
import { allPlaceStrings } from './attachments'
import { classifyIdentityTiers, identityByCurrentId, type IdentityDecision } from './classifyIdentity'
import type { FamilyDiff, FamilyGraph } from './types'

export type ReconciliationAction = 'preserve' | 'rebind' | 'needs_review' | 'orphan'

export type AttachmentDecision = {
  kind: PersonAttachment['kind'] | OverrideAttachment['kind']
  id: string
  label: string
  currentPersonId: string | null
  candidatePersonId: string | null
  action: ReconciliationAction
  reason: string
}

export type ReconciliationCounts = {
  rebound: number
  preserved: number
  needsReview: number
  orphaned: number
}

export type ReconciliationPlan = {
  identity: IdentityDecision[]
  attachments: AttachmentDecision[]
  summary: {
    identity: Record<IdentityDecision['tier'], number>
    media: ReconciliationCounts
    stories: ReconciliationCounts
    documentary: ReconciliationCounts
    placeOverrides: ReconciliationCounts
    eventOverrides: ReconciliationCounts
  }
  activationBlocker: string
}

function emptyCounts(): ReconciliationCounts {
  return { rebound: 0, preserved: 0, needsReview: 0, orphaned: 0 }
}

function tally(decisions: AttachmentDecision[]): ReconciliationCounts {
  const counts = emptyCounts()
  for (const decision of decisions) {
    if (decision.action === 'rebind') counts.rebound += 1
    else if (decision.action === 'preserve') counts.preserved += 1
    else if (decision.action === 'needs_review') counts.needsReview += 1
    else counts.orphaned += 1
  }
  return counts
}

function remapEventEntityKey(entityKey: string, currentToCandidate: Map<string, string>): string {
  const separator = entityKey.indexOf(':')
  if (separator <= 0) return entityKey
  const personId = entityKey.slice(0, separator)
  const mapped = currentToCandidate.get(personId)
  if (!mapped) return entityKey
  return `${mapped}${entityKey.slice(separator)}`
}

function candidateEventKeys(graph: FamilyGraph): Set<string> {
  const keys = new Set<string>()
  for (const person of graph.people) {
    if (person.birthYear != null) {
      keys.add(`${person.id}:birth:${person.birthYear}:${(person.birthPlace || 'unknown').toLowerCase()}`)
    }
    if (person.deathYear != null) {
      keys.add(`${person.id}:death:${person.deathYear}:${(person.deathPlace || 'unknown').toLowerCase()}`)
    }
  }
  return keys
}

function candidatePlaceKeys(graph: FamilyGraph): Array<{ entityKey: string; sourceSignature: string }> {
  const seen = new Set<string>()
  const keys: Array<{ entityKey: string; sourceSignature: string }> = []
  for (const place of allPlaceStrings(graph)) {
    const entityKey = placeEntityKey(place)
    const sourceSignature = placeSourceSignature(place)
    const id = `${entityKey}|${sourceSignature}`
    if (seen.has(id)) continue
    seen.add(id)
    keys.push({ entityKey, sourceSignature })
  }
  return keys
}

function decidePersonAttachment(
  attachment: PersonAttachment,
  byCurrentId: Map<string, IdentityDecision>,
): AttachmentDecision {
  const decision = byCurrentId.get(attachment.personId)
  if (!decision || decision.tier === 'unmatched') {
    return {
      kind: attachment.kind,
      id: attachment.id,
      label: attachment.label,
      currentPersonId: attachment.personId,
      candidatePersonId: null,
      action: 'orphan',
      reason: 'Person is unmatched or removed. Preserve the attachment; do not delete.',
    }
  }
  if (decision.tier === 'exact' || decision.tier === 'strong_match') {
    const rebound = Boolean(decision.candidateId && decision.currentId !== decision.candidateId)
    return {
      kind: attachment.kind,
      id: attachment.id,
      label: attachment.label,
      currentPersonId: attachment.personId,
      candidatePersonId: decision.candidateId,
      action: rebound ? 'rebind' : 'preserve',
      reason:
        decision.tier === 'exact'
          ? 'Exact GEDCOM id match.'
          : `Strong match: ${decision.evidence.join('; ')}`,
    }
  }
  return {
    kind: attachment.kind,
    id: attachment.id,
    label: attachment.label,
    currentPersonId: attachment.personId,
    candidatePersonId: decision.candidateId,
    action: 'needs_review',
    reason: decision.evidence.join('; '),
  }
}

function decideOverride(
  attachment: OverrideAttachment,
  candidates: Array<{ entityKey: string; sourceSignature: string }>,
): AttachmentDecision {
  const result = rebindOverride(
    {
      id: attachment.id,
      entityKey: attachment.entityKey,
      sourceSignature: attachment.sourceSignature,
      status: 'active',
    },
    candidates,
  )
  if (result.nextStatus === 'active') {
    return {
      kind: attachment.kind,
      id: attachment.id,
      label: attachment.label,
      currentPersonId: null,
      candidatePersonId: null,
      action: 'preserve',
      reason: result.reason,
    }
  }
  if (result.nextStatus === 'needs_review') {
    return {
      kind: attachment.kind,
      id: attachment.id,
      label: attachment.label,
      currentPersonId: null,
      candidatePersonId: null,
      action: 'needs_review',
      reason: result.reason,
    }
  }
  return {
    kind: attachment.kind,
    id: attachment.id,
    label: attachment.label,
    currentPersonId: null,
    candidatePersonId: null,
    action: 'orphan',
    reason: result.reason,
  }
}

export function planGedcomReconciliation(
  diff: FamilyDiff,
  attachments: AtlasAttachments,
): ReconciliationPlan {
  const identity = classifyIdentityTiers(diff, attachments.current, attachments.candidate)
  const byCurrentId = identityByCurrentId(identity)
  const currentToCandidate = new Map<string, string>()
  for (const decision of identity) {
    if (
      decision.currentId &&
      decision.candidateId &&
      (decision.tier === 'exact' || decision.tier === 'strong_match')
    ) {
      currentToCandidate.set(decision.currentId, decision.candidateId)
    }
  }

  const media = attachments.media.map((row) => decidePersonAttachment(row, byCurrentId))
  const stories = attachments.stories.map((row) => decidePersonAttachment(row, byCurrentId))
  const documentary = attachments.documentary.map((row) => decidePersonAttachment(row, byCurrentId))
  const placeOverrideDecisions = attachments.placeOverrides.map((row) =>
    decideOverride(row, candidatePlaceKeys(attachments.candidate)),
  )

  const eventKeys = candidateEventKeys(attachments.candidate)
  const eventOverrideDecisions = attachments.eventOverrides.map((row) => {
    const remappedKey = remapEventEntityKey(row.entityKey, currentToCandidate)
    if (!eventKeys.has(remappedKey)) {
      return {
        kind: row.kind,
        id: row.id,
        label: row.label,
        currentPersonId: row.entityKey.split(':')[0] ?? null,
        candidatePersonId: remappedKey.split(':')[0] ?? null,
        action: 'orphan' as const,
        reason: 'Remapped event key does not exist in the candidate tree. Nearby years are not used.',
      }
    }
    return decideOverride(row, [{ entityKey: remappedKey, sourceSignature: row.sourceSignature }])
  })

  const identityCounts: Record<IdentityDecision['tier'], number> = {
    exact: 0,
    strong_match: 0,
    ambiguous: 0,
    unmatched: 0,
  }
  for (const decision of identity) identityCounts[decision.tier] += 1

  return {
    identity,
    attachments: [
      ...media,
      ...stories,
      ...documentary,
      ...placeOverrideDecisions,
      ...eventOverrideDecisions,
    ],
    summary: {
      identity: identityCounts,
      media: tally(media),
      stories: tally(stories),
      documentary: tally(documentary),
      placeOverrides: tally(placeOverrideDecisions),
      eventOverrides: tally(eventOverrideDecisions),
    },
    activationBlocker:
      'Phase 2D.3 must introduce Atlas-owned person identity before activating a GEDCOM. Do not treat media_assets.person_id = current GEDCOM id as the permanent key.',
  }
}
