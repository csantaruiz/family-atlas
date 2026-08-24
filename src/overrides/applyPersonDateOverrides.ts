import { extractGedcomYear } from '../gedcom/parseGedcom'
import { parseGedcomDate, type ParsedGedcomDate } from '../gedcom/parseGedcomDate'
import type { Person } from '../types'
import { sourcePersonIdOf } from '../family-data/resolvePerson'
import { isRuntimeApplicable } from './identity'
import { personDateEntityKey, personDateSourceSignature } from './identity'
import { getCachedPersonDateOverride } from './overrideCache'
import type { PersonDateField, PersonDatePayload } from './types'

export function serializeParsedDate(parsed: ParsedGedcomDate): PersonDatePayload['parsedOriginal'] {
  return {
    raw: parsed.raw,
    qualifier: parsed.qualifier,
    precision: parsed.precision,
    year: parsed.year,
    earliestYear: parsed.earliestYear,
    latestYear: parsed.latestYear,
  }
}

export function buildPersonDatePayload(input: {
  field: PersonDateField
  originalRaw: string
  interpretedRaw: string
}): PersonDatePayload {
  const original = parseGedcomDate(input.originalRaw)
  const interpreted = parseGedcomDate(input.interpretedRaw)
  return {
    field: input.field,
    originalRaw: input.originalRaw,
    interpretedRaw: input.interpretedRaw,
    interpretedYear: interpreted.year ?? extractGedcomYear(input.interpretedRaw),
    parsedOriginal: serializeParsedDate(original),
    parsedInterpreted: serializeParsedDate(interpreted),
  }
}

export function isSafeDateCorrection(raw: string): boolean {
  const parsed = parseGedcomDate(raw)
  if (parsed.malformed || !parsed.calendarValid) return false
  if (parsed.year == null) return false
  if (parsed.qualifier === 'range' || parsed.qualifier === 'from-to') return false
  return parsed.qualifier === 'exact' || parsed.qualifier === 'about' || parsed.qualifier === 'before' || parsed.qualifier === 'after'
}

function payloadOf(record: ReturnType<typeof getCachedPersonDateOverride>): PersonDatePayload | null {
  if (!record) return null
  const payload = record.payload as PersonDatePayload
  if (payload?.field !== 'birth' && payload?.field !== 'death') return null
  return payload
}

export function resolvePersonDateOverride(person: Person, field: PersonDateField) {
  const keys = [personDateEntityKey(person.id, field)]
  const sourceId = sourcePersonIdOf(person)
  if (sourceId !== person.id) keys.push(personDateEntityKey(sourceId, field))

  for (const key of keys) {
    const setDate = getCachedPersonDateOverride(key, 'set_date')
    if (setDate && isRuntimeApplicable(setDate) && setDate.status === 'active') {
      return { record: setDate, payload: payloadOf(setDate), kind: 'set_date' as const }
    }
  }
  for (const key of keys) {
    const confirm = getCachedPersonDateOverride(key, 'confirm_date')
    if (confirm && isRuntimeApplicable(confirm) && confirm.status === 'active') {
      return { record: confirm, payload: payloadOf(confirm), kind: 'confirm_date' as const }
    }
  }
  return null
}

export function applyPersonDateOverrides(people: Person[]): Person[] {
  let changed = false
  const next = people.map((person) => {
    const birth = resolvePersonDateOverride(person, 'birth')
    const death = resolvePersonDateOverride(person, 'death')
    if (birth?.kind !== 'set_date' && death?.kind !== 'set_date') return person

    let revised: Person = person
    const dateSource = { ...(person.dateSource ?? {}) }

    if (birth?.kind === 'set_date' && birth.payload) {
      dateSource.birthDate = person.dateSource?.birthDate ?? person.birthDate
      revised = {
        ...revised,
        birthDate: birth.payload.interpretedRaw,
        birthYear: birth.payload.interpretedYear,
        dateSource,
      }
      changed = true
    }
    if (death?.kind === 'set_date' && death.payload) {
      dateSource.deathDate = person.dateSource?.deathDate ?? person.deathDate
      revised = {
        ...revised,
        deathDate: death.payload.interpretedRaw,
        deathYear: death.payload.interpretedYear,
        dateSource,
      }
      changed = true
    }
    return revised
  })
  return changed ? next : people
}

export function personDateSignatureFor(person: Person, field: PersonDateField): string {
  const raw = field === 'birth' ? (person.dateSource?.birthDate ?? person.birthDate ?? '') : (person.dateSource?.deathDate ?? person.deathDate ?? '')
  return personDateSourceSignature(field, raw)
}
