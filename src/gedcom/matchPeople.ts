import { gedcomIdIdentityConflicts, identityKey, identityTupleAgrees } from './identity'
import { personRef, type AmbiguousMatch, type GedcomPerson, type PersonMatch } from './types'

export type PersonMatchResult = {
  matches: PersonMatch[]
  ambiguous: AmbiguousMatch[]
  unmatchedCurrent: GedcomPerson[]
  unmatchedCandidate: GedcomPerson[]
}

function identityKeyOrFallback(person: GedcomPerson): string {
  return identityKey(person) ?? `incomplete|${person.id}`
}

export function matchPeople(
  currentPeople: GedcomPerson[],
  candidatePeople: GedcomPerson[],
): PersonMatchResult {
  const candidateById = new Map(candidatePeople.map((person) => [person.id, person]))
  const matchedCurrent = new Set<string>()
  const matchedCandidate = new Set<string>()
  const matches: PersonMatch[] = []
  const ambiguous: AmbiguousMatch[] = []

  for (const current of currentPeople) {
    const candidate = candidateById.get(current.id)
    if (!candidate) continue
    const identityConflict = gedcomIdIdentityConflicts(current, candidate)
    if (identityConflict) {
      ambiguous.push({
        reason: 'gedcom-id-conflict',
        identityKey: current.id,
        current: [personRef(current)],
        candidate: [personRef(candidate)],
        detail:
          'Same GEDCOM id has both a different name and a different birth year. Photos/stories must not auto-rebind.',
      })
    }
    matches.push({
      currentId: current.id,
      candidateId: candidate.id,
      currentName: current.name,
      candidateName: candidate.name,
      confidence: identityConflict ? 'probable' : 'exact',
      method: 'gedcom-id',
      safeToRebindAttachments: !identityConflict,
      identityKey: identityKeyOrFallback(current),
    })
    matchedCurrent.add(current.id)
    matchedCandidate.add(candidate.id)
  }

  const leftoverCurrent = currentPeople.filter((person) => !matchedCurrent.has(person.id))
  const leftoverCandidate = candidatePeople.filter((person) => !matchedCandidate.has(person.id))

  type Edge = { current: GedcomPerson; candidate: GedcomPerson }
  const edges: Edge[] = []
  for (const current of leftoverCurrent) {
    for (const candidate of leftoverCandidate) {
      if (identityTupleAgrees(current, candidate)) {
        edges.push({ current, candidate })
      }
    }
  }

  const currentDegree = new Map<string, number>()
  const candidateDegree = new Map<string, number>()
  for (const edge of edges) {
    currentDegree.set(edge.current.id, (currentDegree.get(edge.current.id) ?? 0) + 1)
    candidateDegree.set(edge.candidate.id, (candidateDegree.get(edge.candidate.id) ?? 0) + 1)
  }

  const usedCurrent = new Set<string>()
  const usedCandidate = new Set<string>()
  const ambiguousCurrent = new Set<string>()
  const ambiguousCandidate = new Set<string>()

  for (const edge of edges) {
    const currentCount = currentDegree.get(edge.current.id) ?? 0
    const candidateCount = candidateDegree.get(edge.candidate.id) ?? 0
    if (currentCount === 1 && candidateCount === 1) {
      if (usedCurrent.has(edge.current.id) || usedCandidate.has(edge.candidate.id)) continue
      matches.push({
        currentId: edge.current.id,
        candidateId: edge.candidate.id,
        currentName: edge.current.name,
        candidateName: edge.candidate.name,
        confidence: 'probable',
        method: 'unique-identity-tuple',
        safeToRebindAttachments: false,
        identityKey: identityKey(edge.current) ?? identityKey(edge.candidate) ?? `${edge.current.id}->${edge.candidate.id}`,
      })
      usedCurrent.add(edge.current.id)
      usedCandidate.add(edge.candidate.id)
      matchedCurrent.add(edge.current.id)
      matchedCandidate.add(edge.candidate.id)
    } else {
      ambiguousCurrent.add(edge.current.id)
      ambiguousCandidate.add(edge.candidate.id)
    }
  }

  const tupleKeys = new Set<string>()
  for (const person of leftoverCurrent) {
    if (ambiguousCurrent.has(person.id)) {
      const key = identityKey(person)
      if (key) tupleKeys.add(key)
    }
  }
  for (const person of leftoverCandidate) {
    if (ambiguousCandidate.has(person.id)) {
      const key = identityKey(person)
      if (key) tupleKeys.add(key)
    }
  }
  for (const key of tupleKeys) {
    const currentGroup = leftoverCurrent.filter((person) => identityKey(person) === key)
    const candidateGroup = leftoverCandidate.filter((person) => identityKey(person) === key)
    if (currentGroup.length === 1 && candidateGroup.length === 1) continue
    ambiguous.push({
      reason: 'non-unique-identity-tuple',
      identityKey: key,
      current: currentGroup.map(personRef),
      candidate: candidateGroup.map(personRef),
      detail: 'More than one person shares this name, sex, and birth year. Not matched automatically.',
    })
    for (const person of currentGroup) matchedCurrent.add(person.id)
    for (const person of candidateGroup) matchedCandidate.add(person.id)
  }

  return {
    matches,
    ambiguous,
    unmatchedCurrent: currentPeople.filter((person) => !matchedCurrent.has(person.id)),
    unmatchedCandidate: candidatePeople.filter((person) => !matchedCandidate.has(person.id)),
  }
}

export function peopleById(people: GedcomPerson[]): Map<string, GedcomPerson> {
  return new Map(people.map((person) => [person.id, person]))
}
