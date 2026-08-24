import { describe, expect, it } from 'vitest'
import { familyDatabase } from '../../data/familyDatabase'
import { SEED_IMPORT_ID } from '../constants'
import {
  backfillMediaAtlasPersonIds,
  emptyIdentityStore,
  familyPeopleFromDatabase,
  seedAtlasPeople,
  verifyAtlasPersonSeed,
  type MediaRow,
} from '../seedAtlasPeople'

const ATLAS_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const ATLAS_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

const samplePeople = [
  { id: 'I1', name: 'Alice Ruiz', birthYear: 1900, deathYear: null },
  { id: 'I2', name: 'Bob Ruiz', birthYear: 1898, deathYear: 1970 },
]

describe('2D.3A Atlas person seed', () => {
  it('maps one current GEDCOM person to one Atlas UUID', () => {
    const store = emptyIdentityStore()
    seedAtlasPeople(store, { atlasId: ATLAS_A, people: samplePeople })
    expect(store.people).toHaveLength(2)
    expect(new Set(store.people.map((row) => row.id)).size).toBe(2)
    expect(store.aliases).toHaveLength(2)
    expect(store.aliases.every((row) => row.importId === SEED_IMPORT_ID)).toBe(true)
    expect(store.aliases.map((row) => row.sourcePersonId).sort()).toEqual(['I1', 'I2'])
  })

  it('keeps aliases unique per atlas/import/source id', () => {
    const store = emptyIdentityStore()
    seedAtlasPeople(store, { atlasId: ATLAS_A, people: samplePeople })
    const keys = store.aliases.map((row) => `${row.atlasId}|${row.importId}|${row.sourcePersonId}`)
    expect(new Set(keys).size).toBe(store.aliases.length)
  })

  it('does not duplicate people or aliases on rerun', () => {
    const store = emptyIdentityStore()
    const first = seedAtlasPeople(store, { atlasId: ATLAS_A, people: samplePeople })
    const idsAfterFirst = store.people.map((row) => row.id).sort()
    const second = seedAtlasPeople(store, { atlasId: ATLAS_A, people: samplePeople })
    expect(first.created).toBe(2)
    expect(second.created).toBe(0)
    expect(second.reused).toBe(2)
    expect(store.people).toHaveLength(2)
    expect(store.aliases).toHaveLength(2)
    expect(store.people.map((row) => row.id).sort()).toEqual(idsAfterFirst)
  })

  it('backfills media onto the correct Atlas person and preserves unmatched rows', () => {
    const store = emptyIdentityStore()
    seedAtlasPeople(store, { atlasId: ATLAS_A, people: samplePeople })
    const aliceId = store.aliases.find((row) => row.sourcePersonId === 'I1')?.atlasPersonId
    const media: MediaRow[] = [
      { id: 'm1', atlasId: ATLAS_A, personId: 'I1', atlasPersonId: null },
      { id: 'm2', atlasId: ATLAS_A, personId: 'I-MISSING', atlasPersonId: null },
    ]
    const result = backfillMediaAtlasPersonIds(media, store, ATLAS_A)
    expect(result.backfilled).toBe(1)
    expect(result.unmatched).toHaveLength(1)
    expect(media[0]?.atlasPersonId).toBe(aliceId)
    expect(media[1]?.atlasPersonId).toBeNull()
    expect(media).toHaveLength(2)
  })

  it('resolves the root person to the correct Atlas UUID', () => {
    const store = emptyIdentityStore()
    seedAtlasPeople(store, { atlasId: ATLAS_A, people: samplePeople })
    const report = verifyAtlasPersonSeed({
      familyPeople: samplePeople,
      store,
      atlasId: ATLAS_A,
      rootGedcomId: 'I1',
      media: [],
    })
    expect(report.rootMapped).toBe(true)
    expect(report.rootAtlasPersonId).toBe(
      store.aliases.find((row) => row.sourcePersonId === 'I1')?.atlasPersonId,
    )
    expect(report.missingAliases).toEqual([])
    expect(report.duplicateAliases).toEqual([])
    expect(report.failedToSeed).toEqual([])
  })

  it('does not leak Atlas A identities into Atlas B', () => {
    const store = emptyIdentityStore()
    seedAtlasPeople(store, { atlasId: ATLAS_A, people: samplePeople })
    seedAtlasPeople(store, { atlasId: ATLAS_B, people: samplePeople })
    const idsA = new Set(
      store.people.filter((row) => row.atlasId === ATLAS_A).map((row) => row.id),
    )
    const idsB = new Set(
      store.people.filter((row) => row.atlasId === ATLAS_B).map((row) => row.id),
    )
    expect(idsA.size).toBe(2)
    expect(idsB.size).toBe(2)
    for (const id of idsA) expect(idsB.has(id)).toBe(false)
    const media: MediaRow[] = [
      { id: 'm-b', atlasId: ATLAS_B, personId: 'I1', atlasPersonId: null },
    ]
    backfillMediaAtlasPersonIds(media, store, ATLAS_B)
    const bAlice = store.aliases.find(
      (row) => row.atlasId === ATLAS_B && row.sourcePersonId === 'I1',
    )?.atlasPersonId
    expect(media[0]?.atlasPersonId).toBe(bAlice)
    expect(idsA.has(bAlice ?? '')).toBe(false)
  })

  it('seeds a clean 1:1 mapping for the current Santa Ruiz family dataset', () => {
    const store = emptyIdentityStore()
    const people = familyPeopleFromDatabase(familyDatabase.people)
    seedAtlasPeople(store, { atlasId: ATLAS_A, people })
    const report = verifyAtlasPersonSeed({
      familyPeople: people,
      store,
      atlasId: ATLAS_A,
      rootGedcomId: familyDatabase.root,
      media: [],
    })
    expect(report.familyPersonCount).toBe(familyDatabase.people.length)
    expect(report.atlasPersonCount).toBe(familyDatabase.people.length)
    expect(report.aliasCount).toBe(familyDatabase.people.length)
    expect(report.missingAliases).toEqual([])
    expect(report.duplicateAliases).toEqual([])
    expect(report.failedToSeed).toEqual([])
    expect(report.extraAtlasPeople).toEqual([])
    expect(report.rootGedcomId).toBe(familyDatabase.root)
    expect(report.rootMapped).toBe(true)
    expect(report.rootAtlasPersonId).toBeTruthy()
  })
})
