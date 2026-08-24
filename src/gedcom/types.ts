import type { Person, PersonNameSource } from '../types'
import type { FamilyMarriage } from '../data/familyMarriages'
import type { ParsedGedcomDate } from './parseGedcomDate'

/** Person snapshot produced by the GEDCOM parser (same facts as FamilyDatabase people). */
export type GedcomPerson = {
  id: string
  name: string
  sex: string
  birthDate: string
  birthYear: number | null
  birthPlace: string
  deathDate: string
  deathYear: number | null
  deathPlace: string
  places: string[]
  parents: string[]
  spouses: string[]
  children: string[]
  nameSource?: PersonNameSource
  birthDateParsed?: ParsedGedcomDate
  deathDateParsed?: ParsedGedcomDate
}

export type GedcomFamily = {
  id: string
  husbandId: string | null
  wifeId: string | null
  children: string[]
  marriageDate: string
  marriagePlace: string
  marriageYear: number | null
}

export type FamilyGraph = {
  people: GedcomPerson[]
  families: GedcomFamily[]
  /** FAM records that have a marriage year — same rule as familyMarriages.ts. */
  marriages: FamilyMarriage[]
}

export type PersonRef = {
  id: string
  name: string
  birthYear: number | null
  deathYear: number | null
}

export type MatchMethod = 'gedcom-id' | 'unique-identity-tuple'
export type MatchConfidence = 'exact' | 'probable'

export type PersonMatch = {
  currentId: string
  candidateId: string
  currentName: string
  candidateName: string
  confidence: MatchConfidence
  method: MatchMethod
  /**
   * Later phases may auto-rebind photos/stories only when this is true.
   * Exact GEDCOM-id matches only. Probable ID-renumber matches stay review-only.
   */
  safeToRebindAttachments: boolean
  identityKey: string
}

export type AmbiguousMatch = {
  reason: 'gedcom-id-conflict' | 'non-unique-identity-tuple'
  identityKey: string
  current: PersonRef[]
  candidate: PersonRef[]
  detail: string
}

export type FieldChange = {
  currentId: string
  candidateId: string
  name: string
  field: string
  from: string
  to: string
}

export type RelationshipKind = 'parents' | 'spouses' | 'children'

export type RelationshipChange = {
  currentId: string
  candidateId: string
  name: string
  kind: RelationshipKind
  added: PersonRef[]
  removed: PersonRef[]
}

export type PlaceChange = {
  currentId: string
  candidateId: string
  name: string
  field: 'birthPlace' | 'deathPlace' | 'places'
  from: string[]
  to: string[]
}

export type MarriageChange = {
  familyId: { current: string | null; candidate: string | null }
  husband: PersonRef | null
  wife: PersonRef | null
  changes: FieldChange[]
  status: 'added' | 'removed' | 'changed'
}

export type FamilyDiffSummary = {
  currentPeople: number
  candidatePeople: number
  unchangedPeople: number
  idChangedMatches: number
  addedPeople: number
  removedPeople: number
  nameChanges: number
  dateChanges: number
  relationshipChanges: number
  placeChanges: number
  marriageChanges: number
  ambiguousMatches: number
}

export type FamilyDiff = {
  summary: FamilyDiffSummary
  /** Full match table for later rebind (photos, overrides, stories). */
  matches: PersonMatch[]
  unchangedPeople: PersonRef[]
  idChangedMatches: PersonMatch[]
  addedPeople: PersonRef[]
  removedPeople: PersonRef[]
  nameChanges: FieldChange[]
  dateChanges: FieldChange[]
  relationshipChanges: RelationshipChange[]
  placeChanges: PlaceChange[]
  marriageChanges: MarriageChange[]
  ambiguousMatches: AmbiguousMatch[]
}

export function personRef(person: Pick<GedcomPerson, 'id' | 'name' | 'birthYear' | 'deathYear'>): PersonRef {
  return {
    id: person.id,
    name: person.name,
    birthYear: person.birthYear,
    deathYear: person.deathYear,
  }
}

export function personFromFamilyRecord(person: Person, people: Person[] = []): GedcomPerson {
  const sourceId = (ref: string) => {
    const found = people.find((row) => row.id === ref || row.sourcePersonId === ref)
    return found?.sourcePersonId || found?.id || ref
  }
  return {
    id: person.sourcePersonId || person.id,
    name: person.name,
    sex: person.sex ?? '',
    birthDate: person.birthDate ?? '',
    birthYear: person.birthYear ?? null,
    birthPlace: person.birthPlace ?? '',
    deathDate: person.deathDate ?? '',
    deathYear: person.deathYear ?? null,
    deathPlace: person.deathPlace ?? '',
    places: [...(person.places ?? [])],
    parents: [...(person.parents ?? [])].map(sourceId),
    spouses: [...(person.spouses ?? [])].map(sourceId),
    children: [...(person.children ?? [])].map(sourceId),
    nameSource: person.nameSource,
  }
}
