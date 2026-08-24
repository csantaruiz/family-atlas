import type { Person } from '../types'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isAtlasPersonId(id: string): boolean {
  return UUID_RE.test(id)
}

/** Match a person by Atlas id or GEDCOM source alias. */
export function personMatchesRef(person: Person, ref: string): boolean {
  return person.id === ref || person.sourcePersonId === ref
}

export function findPersonByRef(people: Person[], ref: string): Person | undefined {
  return people.find((person) => personMatchesRef(person, ref))
}

export function sourcePersonIdOf(person: Person): string {
  return person.sourcePersonId || person.id
}
