import type { GedcomPerson } from './types'

export function normalizePersonName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizedSex(sex: string | undefined): string {
  const value = (sex ?? '').trim().toUpperCase()
  return value === 'M' || value === 'F' ? value : ''
}

/**
 * Conservative identity tuple. Birth year is required — name + sex alone is too weak.
 * Death year is included when present so twins with different death years can separate.
 */
export function identityKey(person: GedcomPerson): string | null {
  const name = normalizePersonName(person.name)
  if (!name || person.birthYear == null) return null
  const sex = normalizedSex(person.sex) || '?'
  const death = person.deathYear == null ? '' : String(person.deathYear)
  return `${name}|${sex}|${person.birthYear}|${death}`
}

/** True when two records look like the same person without using GEDCOM ids. */
export function identityTupleAgrees(a: GedcomPerson, b: GedcomPerson): boolean {
  if (normalizePersonName(a.name) !== normalizePersonName(b.name)) return false
  if (!normalizePersonName(a.name)) return false
  if (a.birthYear == null || b.birthYear == null || a.birthYear !== b.birthYear) return false
  const sexA = normalizedSex(a.sex)
  const sexB = normalizedSex(b.sex)
  if (sexA && sexB && sexA !== sexB) return false
  if (a.deathYear != null && b.deathYear != null && a.deathYear !== b.deathYear) return false
  return true
}

/**
 * Same GEDCOM id is treated as a match unless both name and birth year contradict.
 * That combination is the recycled-id case we must not silently accept.
 */
export function gedcomIdIdentityConflicts(a: GedcomPerson, b: GedcomPerson): boolean {
  const namesDiffer = normalizePersonName(a.name) !== normalizePersonName(b.name)
  const yearsDiffer =
    a.birthYear != null && b.birthYear != null && a.birthYear !== b.birthYear
  return namesDiffer && yearsDiffer
}
