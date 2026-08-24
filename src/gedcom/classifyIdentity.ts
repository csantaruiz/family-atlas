import type { FamilyDiff, FamilyGraph, GedcomPerson, PersonMatch } from './types'

export type IdentityTier = 'exact' | 'strong_match' | 'ambiguous' | 'unmatched'

export type IdentityDecision = {
  currentId: string | null
  candidateId: string | null
  currentName: string | null
  candidateName: string | null
  tier: IdentityTier
  evidence: string[]
  /** Media/stories may auto-rebind only for exact and strong_match. */
  safeToRebindAttachments: boolean
}

function isYearOnlyDate(date: string): boolean {
  return /^\s*\d{3,4}\s*$/.test(date)
}

export function fullBirthDatesAgree(current: GedcomPerson, candidate: GedcomPerson): boolean {
  const a = current.birthDate.trim()
  const b = candidate.birthDate.trim()
  if (!a || !b) return false
  if (isYearOnlyDate(a) || isYearOnlyDate(b)) return false
  return a.toLowerCase() === b.toLowerCase()
}

function relatives(person: GedcomPerson): { parents: string[]; spouses: string[]; children: string[] } {
  return {
    parents: person.parents,
    spouses: person.spouses,
    children: person.children,
  }
}

/** Unique 1:1 identity matches can corroborate each other when the same relationship exists on both sides. */
export function familyRelationshipCorroborates(
  current: GedcomPerson,
  candidate: GedcomPerson,
  currentToCandidate: Map<string, string>,
): boolean {
  const groups: Array<keyof ReturnType<typeof relatives>> = ['parents', 'spouses', 'children']
  const currentRels = relatives(current)
  const candidateRels = relatives(candidate)
  for (const group of groups) {
    for (const relativeId of currentRels[group]) {
      const mapped = currentToCandidate.get(relativeId)
      if (mapped && candidateRels[group].includes(mapped)) return true
    }
  }
  return false
}

function peopleById(people: GedcomPerson[]): Map<string, GedcomPerson> {
  return new Map(people.map((person) => [person.id, person]))
}

/**
 * 2D.2 identity tiers on top of 2D.1 matches.
 * Unique name+year is never enough for strong_match. Family corroboration or a full
 * shared birth date (not year-only) is required before attachments may auto-rebind.
 */
export function classifyIdentityTiers(
  diff: FamilyDiff,
  current: FamilyGraph,
  candidate: FamilyGraph,
): IdentityDecision[] {
  const currentById = peopleById(current.people)
  const candidateById = peopleById(candidate.people)
  const uniqueMap = new Map<string, string>()
  for (const match of diff.matches) {
    uniqueMap.set(match.currentId, match.candidateId)
  }

  const decisions: IdentityDecision[] = []
  const seenCurrent = new Set<string>()
  const seenCandidate = new Set<string>()

  const decideMatch = (match: PersonMatch): IdentityDecision => {
    const currentPerson = currentById.get(match.currentId)
    const candidatePerson = candidateById.get(match.candidateId)
    if (match.method === 'gedcom-id' && match.safeToRebindAttachments) {
      return {
        currentId: match.currentId,
        candidateId: match.candidateId,
        currentName: match.currentName,
        candidateName: match.candidateName,
        tier: 'exact',
        evidence: ['Same GEDCOM id', 'Name and birth year are compatible'],
        safeToRebindAttachments: true,
      }
    }
    if (match.method === 'gedcom-id' && !match.safeToRebindAttachments) {
      return {
        currentId: match.currentId,
        candidateId: match.candidateId,
        currentName: match.currentName,
        candidateName: match.candidateName,
        tier: 'ambiguous',
        evidence: ['Same GEDCOM id', 'Name and birth year both changed — possible recycled id'],
        safeToRebindAttachments: false,
      }
    }
    const evidence: string[] = ['Unique name + sex + birth year']
    const datesAgree =
      currentPerson && candidatePerson ? fullBirthDatesAgree(currentPerson, candidatePerson) : false
    const familyAgrees =
      currentPerson && candidatePerson
        ? familyRelationshipCorroborates(currentPerson, candidatePerson, uniqueMap)
        : false
    if (datesAgree) evidence.push('Full birth date strings match')
    if (familyAgrees) evidence.push('A parent, spouse, or child is also uniquely matched')
    if (datesAgree || familyAgrees) {
      return {
        currentId: match.currentId,
        candidateId: match.candidateId,
        currentName: match.currentName,
        candidateName: match.candidateName,
        tier: 'strong_match',
        evidence,
        safeToRebindAttachments: true,
      }
    }
    evidence.push('No family corroboration and no full birth date — not safe to rebind')
    return {
      currentId: match.currentId,
      candidateId: match.candidateId,
      currentName: match.currentName,
      candidateName: match.candidateName,
      tier: 'ambiguous',
      evidence,
      safeToRebindAttachments: false,
    }
  }

  for (const match of diff.matches) {
    const decision = decideMatch(match)
    decisions.push(decision)
    if (decision.currentId) seenCurrent.add(decision.currentId)
    if (decision.candidateId) seenCandidate.add(decision.candidateId)
  }

  for (const group of diff.ambiguousMatches) {
    for (const current of group.current) {
      if (seenCurrent.has(current.id)) continue
      seenCurrent.add(current.id)
      const candidate = group.candidate[0] ?? null
      decisions.push({
        currentId: current.id,
        candidateId: candidate?.id ?? null,
        currentName: current.name,
        candidateName: candidate?.name ?? null,
        tier: 'ambiguous',
        evidence: [group.detail],
        safeToRebindAttachments: false,
      })
    }
    for (const candidate of group.candidate) {
      seenCandidate.add(candidate.id)
    }
  }

  for (const person of diff.removedPeople) {
    if (seenCurrent.has(person.id)) continue
    decisions.push({
      currentId: person.id,
      candidateId: null,
      currentName: person.name,
      candidateName: null,
      tier: 'unmatched',
      evidence: ['No conservative match in the candidate GEDCOM'],
      safeToRebindAttachments: false,
    })
  }

  return decisions
}

export function identityByCurrentId(decisions: IdentityDecision[]): Map<string, IdentityDecision> {
  const map = new Map<string, IdentityDecision>()
  for (const decision of decisions) {
    if (decision.currentId) map.set(decision.currentId, decision)
  }
  return map
}
