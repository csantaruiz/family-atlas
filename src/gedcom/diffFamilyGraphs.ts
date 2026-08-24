import { matchPeople, peopleById } from './matchPeople'
import {
  personRef,
  type FamilyDiff,
  type FamilyGraph,
  type FieldChange,
  type GedcomPerson,
  type MarriageChange,
  type PersonMatch,
  type PersonRef,
  type PlaceChange,
  type RelationshipChange,
} from './types'

function canonicalPersonKey(
  id: string,
  side: 'current' | 'candidate',
  currentToCandidate: Map<string, string>,
  candidateToCurrent: Map<string, string>,
): string {
  if (side === 'current') {
    return currentToCandidate.has(id) ? `pair:${id}` : `current:${id}`
  }
  const currentId = candidateToCurrent.get(id)
  return currentId ? `pair:${currentId}` : `candidate:${id}`
}

function asText(value: string | number | null | undefined): string {
  if (value == null || value === '') return ''
  return String(value)
}

function sameStringSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const other = new Set(b)
  return a.every((item) => other.has(item))
}

function refsForKeys(
  keys: string[],
  currentByIdMap: Map<string, GedcomPerson>,
  candidateByIdMap: Map<string, GedcomPerson>,
): PersonRef[] {
  const refs: PersonRef[] = []
  for (const key of keys) {
    if (key.startsWith('pair:')) {
      const currentId = key.slice('pair:'.length)
      const current = currentByIdMap.get(currentId)
      if (current) refs.push(personRef(current))
      continue
    }
    if (key.startsWith('current:')) {
      const person = currentByIdMap.get(key.slice('current:'.length))
      if (person) refs.push(personRef(person))
      continue
    }
    const person = candidateByIdMap.get(key.slice('candidate:'.length))
    if (person) refs.push(personRef(person))
  }
  return refs
}

function coupleKey(
  husbandId: string | null,
  wifeId: string | null,
  side: 'current' | 'candidate',
  currentToCandidate: Map<string, string>,
  candidateToCurrent: Map<string, string>,
): string | null {
  if (!husbandId || !wifeId) return null
  const left = canonicalPersonKey(husbandId, side, currentToCandidate, candidateToCurrent)
  const right = canonicalPersonKey(wifeId, side, currentToCandidate, candidateToCurrent)
  return [left, right].sort().join('::')
}

export function diffFamilyGraphs(current: FamilyGraph, candidate: FamilyGraph): FamilyDiff {
  const matched = matchPeople(current.people, candidate.people)
  const currentByIdMap = peopleById(current.people)
  const candidateByIdMap = peopleById(candidate.people)
  const currentToCandidate = new Map(matched.matches.map((row) => [row.currentId, row.candidateId]))
  const candidateToCurrent = new Map(matched.matches.map((row) => [row.candidateId, row.currentId]))

  const nameChanges: FieldChange[] = []
  const dateChanges: FieldChange[] = []
  const placeChanges: PlaceChange[] = []
  const relationshipChanges: RelationshipChange[] = []
  const unchangedPeople: PersonRef[] = []
  const idChangedMatches: PersonMatch[] = []

  for (const match of matched.matches) {
    const currentPerson = currentByIdMap.get(match.currentId)
    const candidatePerson = candidateByIdMap.get(match.candidateId)
    if (!currentPerson || !candidatePerson) continue
    if (match.currentId !== match.candidateId) idChangedMatches.push(match)

    let factChanged = false
    if (currentPerson.name !== candidatePerson.name) {
      nameChanges.push({
        currentId: match.currentId,
        candidateId: match.candidateId,
        name: currentPerson.name,
        field: 'name',
        from: currentPerson.name,
        to: candidatePerson.name,
      })
      factChanged = true
    }
    if ((currentPerson.sex || '') !== (candidatePerson.sex || '')) {
      nameChanges.push({
        currentId: match.currentId,
        candidateId: match.candidateId,
        name: currentPerson.name,
        field: 'sex',
        from: currentPerson.sex || '',
        to: candidatePerson.sex || '',
      })
      factChanged = true
    }

    const dateFields: Array<keyof GedcomPerson> = ['birthDate', 'birthYear', 'deathDate', 'deathYear']
    for (const field of dateFields) {
      const from = asText(currentPerson[field] as string | number | null)
      const to = asText(candidatePerson[field] as string | number | null)
      if (from !== to) {
        dateChanges.push({
          currentId: match.currentId,
          candidateId: match.candidateId,
          name: currentPerson.name,
          field,
          from,
          to,
        })
        factChanged = true
      }
    }

    for (const field of ['birthPlace', 'deathPlace'] as const) {
      const from = currentPerson[field] || ''
      const to = candidatePerson[field] || ''
      if (from !== to) {
        placeChanges.push({
          currentId: match.currentId,
          candidateId: match.candidateId,
          name: currentPerson.name,
          field,
          from: from ? [from] : [],
          to: to ? [to] : [],
        })
        factChanged = true
      }
    }
    if (!sameStringSet(currentPerson.places, candidatePerson.places)) {
      placeChanges.push({
        currentId: match.currentId,
        candidateId: match.candidateId,
        name: currentPerson.name,
        field: 'places',
        from: [...currentPerson.places],
        to: [...candidatePerson.places],
      })
      factChanged = true
    }

    for (const kind of ['parents', 'spouses', 'children'] as const) {
      const currentKeys = new Set(
        currentPerson[kind].map((id) =>
          canonicalPersonKey(id, 'current', currentToCandidate, candidateToCurrent),
        ),
      )
      const candidateKeys = new Set(
        candidatePerson[kind].map((id) =>
          canonicalPersonKey(id, 'candidate', currentToCandidate, candidateToCurrent),
        ),
      )
      const addedKeys = [...candidateKeys].filter((key) => !currentKeys.has(key))
      const removedKeys = [...currentKeys].filter((key) => !candidateKeys.has(key))
      if (addedKeys.length || removedKeys.length) {
        relationshipChanges.push({
          currentId: match.currentId,
          candidateId: match.candidateId,
          name: currentPerson.name,
          kind,
          added: refsForKeys(addedKeys, currentByIdMap, candidateByIdMap),
          removed: refsForKeys(removedKeys, currentByIdMap, candidateByIdMap),
        })
        factChanged = true
      }
    }

    if (!factChanged) unchangedPeople.push(personRef(currentPerson))
  }

  const marriageChanges = diffMarriages(
    current,
    candidate,
    currentToCandidate,
    candidateToCurrent,
    currentByIdMap,
    candidateByIdMap,
  )

  return {
    summary: {
      currentPeople: current.people.length,
      candidatePeople: candidate.people.length,
      unchangedPeople: unchangedPeople.length,
      idChangedMatches: idChangedMatches.length,
      addedPeople: matched.unmatchedCandidate.length,
      removedPeople: matched.unmatchedCurrent.length,
      nameChanges: nameChanges.length,
      dateChanges: dateChanges.length,
      relationshipChanges: relationshipChanges.length,
      placeChanges: placeChanges.length,
      marriageChanges: marriageChanges.length,
      ambiguousMatches: matched.ambiguous.length,
    },
    matches: matched.matches,
    unchangedPeople,
    idChangedMatches,
    addedPeople: matched.unmatchedCandidate.map(personRef),
    removedPeople: matched.unmatchedCurrent.map(personRef),
    nameChanges,
    dateChanges,
    relationshipChanges,
    placeChanges,
    marriageChanges,
    ambiguousMatches: matched.ambiguous,
  }
}

function diffMarriages(
  current: FamilyGraph,
  candidate: FamilyGraph,
  currentToCandidate: Map<string, string>,
  candidateToCurrent: Map<string, string>,
  currentByIdMap: Map<string, GedcomPerson>,
  candidateByIdMap: Map<string, GedcomPerson>,
): MarriageChange[] {
  type Row = {
    familyId: string
    husbandId: string
    wifeId: string
    date: string
    place: string
    year: number
  }
  const index = (
    marriages: FamilyGraph['marriages'],
    side: 'current' | 'candidate',
  ) => {
    const map = new Map<string, Row>()
    for (const marriage of marriages) {
      const key = coupleKey(
        marriage.husbandId,
        marriage.wifeId,
        side,
        currentToCandidate,
        candidateToCurrent,
      )
      if (!key) continue
      map.set(key, {
        familyId: marriage.id,
        husbandId: marriage.husbandId,
        wifeId: marriage.wifeId,
        date: marriage.date,
        place: marriage.place,
        year: marriage.year,
      })
    }
    return map
  }
  const currentIndex = index(current.marriages, 'current')
  const candidateIndex = index(candidate.marriages, 'candidate')
  const changes: MarriageChange[] = []
  const spouseRef = (id: string, side: 'current' | 'candidate'): PersonRef | null => {
    if (side === 'current') {
      const person = currentByIdMap.get(id)
      if (person) return personRef(person)
      const mapped = currentToCandidate.get(id)
      const candidatePerson = mapped ? candidateByIdMap.get(mapped) : undefined
      return candidatePerson ? personRef(candidatePerson) : null
    }
    const person = candidateByIdMap.get(id)
    return person ? personRef(person) : null
  }

  for (const [key, currentRow] of currentIndex) {
    const candidateRow = candidateIndex.get(key)
    if (!candidateRow) {
      changes.push({
        familyId: { current: currentRow.familyId, candidate: null },
        husband: spouseRef(currentRow.husbandId, 'current'),
        wife: spouseRef(currentRow.wifeId, 'current'),
        changes: [],
        status: 'removed',
      })
      continue
    }
    const fieldChanges: FieldChange[] = []
    if (currentRow.date !== candidateRow.date) {
      fieldChanges.push({
        currentId: currentRow.familyId,
        candidateId: candidateRow.familyId,
        name: 'marriage',
        field: 'date',
        from: currentRow.date,
        to: candidateRow.date,
      })
    }
    if (String(currentRow.year) !== String(candidateRow.year)) {
      fieldChanges.push({
        currentId: currentRow.familyId,
        candidateId: candidateRow.familyId,
        name: 'marriage',
        field: 'year',
        from: String(currentRow.year),
        to: String(candidateRow.year),
      })
    }
    if (currentRow.place !== candidateRow.place) {
      fieldChanges.push({
        currentId: currentRow.familyId,
        candidateId: candidateRow.familyId,
        name: 'marriage',
        field: 'place',
        from: currentRow.place,
        to: candidateRow.place,
      })
    }
    if (fieldChanges.length) {
      changes.push({
        familyId: { current: currentRow.familyId, candidate: candidateRow.familyId },
        husband: spouseRef(currentRow.husbandId, 'current'),
        wife: spouseRef(currentRow.wifeId, 'current'),
        changes: fieldChanges,
        status: 'changed',
      })
    }
  }
  for (const [key, candidateRow] of candidateIndex) {
    if (currentIndex.has(key)) continue
    changes.push({
      familyId: { current: null, candidate: candidateRow.familyId },
      husband: spouseRef(candidateRow.husbandId, 'candidate'),
      wife: spouseRef(candidateRow.wifeId, 'candidate'),
      changes: [],
      status: 'added',
    })
  }
  return changes
}
