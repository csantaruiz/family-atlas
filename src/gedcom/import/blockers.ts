import type { ReconciliationPlan } from '../planGedcomReconciliation'

export type CandidateBlocker = {
  code: string
  detail: string
}

export function candidateBlockers(plan: ReconciliationPlan): CandidateBlocker[] {
  const attached = new Set(
    plan.attachments
      .filter((row) => row.currentPersonId)
      .map((row) => row.currentPersonId as string),
  )
  const blockers: CandidateBlocker[] = []
  for (const decision of plan.identity) {
    if (decision.tier !== 'ambiguous' || !decision.currentId) continue
    if (!attached.has(decision.currentId)) continue
    blockers.push({
      code: 'ambiguous_identity_with_content',
      detail: `${decision.currentName ?? decision.currentId} needs a closer look before photos or stories can stay attached.`,
    })
  }
  return blockers
}
