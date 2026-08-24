import type { FamilyMarriage } from '../../data/familyMarriages'
import type { FamilyDatabase, Person } from '../../types'
import type { FamilySnapshot } from '../import/snapshotFromGraph'

function remapId(id: string, gedcomToAtlas: Map<string, string>): string {
  return gedcomToAtlas.get(id) ?? id
}

function remapIds(ids: string[] | undefined, gedcomToAtlas: Map<string, string>): string[] {
  return (ids ?? []).map((id) => remapId(id, gedcomToAtlas))
}

export function rewriteSnapshotToAtlasIds(
  snapshot: FamilySnapshot,
  gedcomToAtlas: Map<string, string>,
): FamilySnapshot {
  const people: Person[] = snapshot.people.map((person) => ({
    ...person,
    sourcePersonId: person.sourcePersonId || person.id,
    id: remapId(person.id, gedcomToAtlas),
    parents: remapIds(person.parents, gedcomToAtlas),
    spouses: remapIds(person.spouses, gedcomToAtlas),
    children: remapIds(person.children, gedcomToAtlas),
  }))

  const marriages: FamilyMarriage[] = snapshot.marriages.map((marriage) => ({
    ...marriage,
    husbandId: remapId(marriage.husbandId, gedcomToAtlas),
    wifeId: remapId(marriage.wifeId, gedcomToAtlas),
  }))

  return {
    ...snapshot,
    people,
    root: remapId(snapshot.root, gedcomToAtlas),
    marriages,
    stats: {
      ...snapshot.stats,
      people: people.length,
    },
  }
}

export function familyDatabaseFromSnapshot(snapshot: FamilySnapshot): FamilyDatabase {
  return {
    people: snapshot.people,
    root: snapshot.root,
    stats: snapshot.stats,
  }
}
