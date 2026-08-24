import { SEED_IMPORT_ID } from './constants'
import type { Person } from '../types'

export type SeedPersonInput = {
  id: string
  name: string
  birthYear?: number | null
  deathYear?: number | null
}

export type AtlasPersonRow = {
  id: string
  atlasId: string
  status: 'active' | 'source_removed' | 'needs_review'
  displayName: string
  birthYear: number | null
  deathYear: number | null
  currentSourcePersonId: string
}

export type AtlasPersonAliasRow = {
  id: string
  atlasPersonId: string
  atlasId: string
  importId: string
  sourceType: 'gedcom'
  sourcePersonId: string
  matchKind: 'exact' | 'strong_match' | 'seeded' | 'manual'
}

export type MediaRow = {
  id: string
  atlasId: string
  personId: string
  atlasPersonId: string | null
}

export type IdentityStore = {
  people: AtlasPersonRow[]
  aliases: AtlasPersonAliasRow[]
}

export type SeedReport = {
  familyPersonCount: number
  atlasPersonCount: number
  aliasCount: number
  createdPeople: number
  reusedPeople: number
  missingAliases: string[]
  duplicateAliases: string[]
  failedToSeed: string[]
  extraAtlasPeople: string[]
  mediaTotal: number
  mediaBackfilled: number
  mediaAlreadyMapped: number
  mediaUnmatched: Array<{ id: string; personId: string; atlasPersonId: string | null }>
  rootGedcomId: string
  rootAtlasPersonId: string | null
  rootMapped: boolean
}

function yearOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' ? value : null
}

export function emptyIdentityStore(): IdentityStore {
  return { people: [], aliases: [] }
}

function findAlias(
  store: IdentityStore,
  atlasId: string,
  importId: string,
  sourcePersonId: string,
): AtlasPersonAliasRow | undefined {
  return store.aliases.find(
    (row) =>
      row.atlasId === atlasId && row.importId === importId && row.sourcePersonId === sourcePersonId,
  )
}

function findPersonByCurrentSource(
  store: IdentityStore,
  atlasId: string,
  sourcePersonId: string,
): AtlasPersonRow | undefined {
  return store.people.find(
    (row) => row.atlasId === atlasId && row.currentSourcePersonId === sourcePersonId,
  )
}

/** Idempotent seed: one Atlas person + one seed alias per GEDCOM person, scoped to atlasId. */
export function seedAtlasPeople(
  store: IdentityStore,
  input: {
    atlasId: string
    people: SeedPersonInput[]
    importId?: string
  },
): { created: number; reused: number } {
  const importId = input.importId ?? SEED_IMPORT_ID
  let created = 0
  let reused = 0

  for (const person of input.people) {
    const existingAlias = findAlias(store, input.atlasId, importId, person.id)
    if (existingAlias) {
      reused += 1
      continue
    }
    const existingPerson = findPersonByCurrentSource(store, input.atlasId, person.id)
    const atlasPersonId = existingPerson?.id ?? crypto.randomUUID()
    if (!existingPerson) {
      store.people.push({
        id: atlasPersonId,
        atlasId: input.atlasId,
        status: 'active',
        displayName: person.name,
        birthYear: yearOrNull(person.birthYear),
        deathYear: yearOrNull(person.deathYear),
        currentSourcePersonId: person.id,
      })
      created += 1
    } else {
      reused += 1
    }
    store.aliases.push({
      id: crypto.randomUUID(),
      atlasPersonId,
      atlasId: input.atlasId,
      importId,
      sourceType: 'gedcom',
      sourcePersonId: person.id,
      matchKind: 'seeded',
    })
  }

  return { created, reused }
}

export function backfillMediaAtlasPersonIds(
  media: MediaRow[],
  store: IdentityStore,
  atlasId: string,
  importId: string = SEED_IMPORT_ID,
): { backfilled: number; alreadyMapped: number; unmatched: MediaRow[] } {
  let backfilled = 0
  let alreadyMapped = 0
  const unmatched: MediaRow[] = []

  for (const row of media) {
    if (row.atlasId !== atlasId) continue
    if (row.atlasPersonId) {
      alreadyMapped += 1
      continue
    }
    const alias = findAlias(store, atlasId, importId, row.personId)
    if (!alias) {
      unmatched.push(row)
      continue
    }
    row.atlasPersonId = alias.atlasPersonId
    backfilled += 1
  }

  return { backfilled, alreadyMapped, unmatched }
}

export function verifyAtlasPersonSeed(input: {
  familyPeople: SeedPersonInput[]
  store: IdentityStore
  atlasId: string
  rootGedcomId: string
  media: MediaRow[]
  importId?: string
}): SeedReport {
  const importId = input.importId ?? SEED_IMPORT_ID
  const atlasPeople = input.store.people.filter((row) => row.atlasId === input.atlasId)
  const atlasAliases = input.store.aliases.filter(
    (row) => row.atlasId === input.atlasId && row.importId === importId,
  )

  const aliasBySource = new Map<string, number>()
  for (const alias of atlasAliases) {
    aliasBySource.set(alias.sourcePersonId, (aliasBySource.get(alias.sourcePersonId) ?? 0) + 1)
  }

  const familyIds = input.familyPeople.map((person) => person.id)
  const missingAliases = familyIds.filter((id) => !aliasBySource.has(id))
  const duplicateAliases = [...aliasBySource.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
  const failedToSeed = missingAliases
  const extraAtlasPeople = atlasPeople
    .map((row) => row.currentSourcePersonId)
    .filter((id) => !familyIds.includes(id))

  const atlasMedia = input.media.filter((row) => row.atlasId === input.atlasId)
  const unmatched = atlasMedia.filter((row) => !row.atlasPersonId)
  const backfilled = atlasMedia.filter((row) => row.atlasPersonId).length

  const rootAlias = findAlias(input.store, input.atlasId, importId, input.rootGedcomId)

  return {
    familyPersonCount: input.familyPeople.length,
    atlasPersonCount: atlasPeople.length,
    aliasCount: atlasAliases.length,
    createdPeople: atlasPeople.length,
    reusedPeople: 0,
    missingAliases,
    duplicateAliases,
    failedToSeed,
    extraAtlasPeople,
    mediaTotal: atlasMedia.length,
    mediaBackfilled: backfilled,
    mediaAlreadyMapped: atlasMedia.filter((row) => row.atlasPersonId).length,
    mediaUnmatched: unmatched.map((row) => ({
      id: row.id,
      personId: row.personId,
      atlasPersonId: row.atlasPersonId,
    })),
    rootGedcomId: input.rootGedcomId,
    rootAtlasPersonId: rootAlias?.atlasPersonId ?? null,
    rootMapped: Boolean(rootAlias),
  }
}

export function familyPeopleFromDatabase(people: Person[]): SeedPersonInput[] {
  return people.map((person) => ({
    id: person.id,
    name: person.name,
    birthYear: person.birthYear ?? null,
    deathYear: person.deathYear ?? null,
  }))
}
