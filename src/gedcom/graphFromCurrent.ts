import { type FamilyMarriage } from '../data/familyMarriages'
import type { FamilyDatabase } from '../types'
import { getSourceFamilyDatabase, getFamilyMarriages } from '../family-data/activeFamily'
import { personFromFamilyRecord, type FamilyGraph } from './types'

export function familyGraphFromDatabase(
  database: FamilyDatabase,
  marriages: FamilyMarriage[] = [],
): FamilyGraph {
  return {
    people: database.people.map((person) => personFromFamilyRecord(person, database.people)),
    families: marriages.map((marriage) => ({
      id: marriage.id,
      husbandId: marriage.husbandId,
      wifeId: marriage.wifeId,
      children: [],
      marriageDate: marriage.date,
      marriagePlace: marriage.place,
      marriageYear: marriage.year,
    })),
    marriages: marriages.map((marriage) => ({ ...marriage })),
  }
}

/** Live Atlas graph. After activation this reads the active snapshot, otherwise the seed database. */
export function currentFamilyGraph(): FamilyGraph {
  return familyGraphFromDatabase(getSourceFamilyDatabase(), getFamilyMarriages())
}
