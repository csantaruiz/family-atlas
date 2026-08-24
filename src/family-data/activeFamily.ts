import { familyDatabase } from '../data/familyDatabase'
import { familyMarriages, type FamilyMarriage } from '../data/familyMarriages'
import { applyPersonOverrides } from '../overrides/applyPersonNameOverrides'
import type { FamilyDatabase } from '../types'

export type ActiveFamilyData = {
  database: FamilyDatabase
  marriages: FamilyMarriage[]
  importId: string | null
}

const fallback: ActiveFamilyData = {
  database: familyDatabase,
  marriages: familyMarriages,
  importId: null,
}

let active: ActiveFamilyData = fallback

export function getActiveFamilyData(): ActiveFamilyData {
  return active
}

export function getSourceFamilyDatabase(): FamilyDatabase {
  return active.database
}

export function getFamilyDatabase(): FamilyDatabase {
  const raw = active.database
  const people = applyPersonOverrides(raw.people)
  if (people === raw.people) return raw
  return { ...raw, people }
}

export function getFamilyMarriages(): FamilyMarriage[] {
  return active.marriages
}

export function setActiveFamilyData(next: ActiveFamilyData | null): void {
  active = next ?? fallback
}

export function resetActiveFamilyData(): void {
  active = fallback
}
