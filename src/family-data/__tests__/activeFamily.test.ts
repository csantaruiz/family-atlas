import { describe, expect, it } from 'vitest'
import { familyDatabase } from '../../data/familyDatabase'
import {
  getFamilyDatabase,
  resetActiveFamilyData,
  setActiveFamilyData,
} from '../activeFamily'
import type { FamilyDatabase } from '../../types'

describe('active family snapshot switch', () => {
  it('keeps the seed database until an activated snapshot is committed', () => {
    resetActiveFamilyData()
    expect(getFamilyDatabase()).toBe(familyDatabase)
    const next: FamilyDatabase = {
      ...familyDatabase,
      root: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      people: familyDatabase.people.slice(0, 3).map((person) => ({
        ...person,
        sourcePersonId: person.id,
        id: `atlas-${person.id}`,
      })),
    }
    next.root = next.people[0]?.id ?? next.root
    setActiveFamilyData({ database: next, marriages: [], importId: 'imp-1' })
    expect(getFamilyDatabase()).not.toBe(familyDatabase)
    expect(getFamilyDatabase().people.every((person) => person.sourcePersonId)).toBe(true)
    resetActiveFamilyData()
    expect(getFamilyDatabase()).toBe(familyDatabase)
  })
})
