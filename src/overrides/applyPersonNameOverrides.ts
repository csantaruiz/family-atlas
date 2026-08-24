import type { Person } from '../types'
import { sourcePersonIdOf } from '../family-data/resolvePerson'
import { applyPersonDateOverrides } from './applyPersonDateOverrides'
import { isRuntimeApplicable, personNameEntityKey, personNameSourceSignature } from './identity'
import { getCachedPersonNameOverride } from './overrideCache'
import type { PersonNamePayload } from './types'

const GARBAGE = /[*#<>]|[?]{2,}|[\u0000-\u0008]/

export function suggestCleanedName(raw: string): string {
  return raw.replace(/[*#<>]+/g, '').replace(/\s+/g, ' ').trim()
}

export function isSafeNameCorrection(raw: string): boolean {
  const trimmed = raw.trim().replace(/\s+/g, ' ')
  if (trimmed.length < 2) return false
  if (GARBAGE.test(trimmed)) return false
  if (!/[a-zA-Z]/.test(trimmed)) return false
  return true
}

export function buildPersonNamePayload(input: {
  originalRaw: string
  interpretedRaw: string
}): PersonNamePayload {
  return {
    originalRaw: input.originalRaw,
    interpretedRaw: input.interpretedRaw.trim().replace(/\s+/g, ' '),
  }
}

function payloadOf(record: ReturnType<typeof getCachedPersonNameOverride>): PersonNamePayload | null {
  if (!record) return null
  const payload = record.payload as PersonNamePayload
  if (typeof payload?.originalRaw !== 'string' || typeof payload?.interpretedRaw !== 'string') return null
  return payload
}

export function resolvePersonNameOverride(person: Person) {
  const keys = [personNameEntityKey(person.id)]
  const sourceId = sourcePersonIdOf(person)
  if (sourceId !== person.id) keys.push(personNameEntityKey(sourceId))

  for (const key of keys) {
    const setName = getCachedPersonNameOverride(key, 'set_name')
    if (setName && isRuntimeApplicable(setName) && setName.status === 'active') {
      return { record: setName, payload: payloadOf(setName), kind: 'set_name' as const }
    }
  }
  for (const key of keys) {
    const confirm = getCachedPersonNameOverride(key, 'confirm_name')
    if (confirm && isRuntimeApplicable(confirm) && confirm.status === 'active') {
      return { record: confirm, payload: payloadOf(confirm), kind: 'confirm_name' as const }
    }
  }
  return null
}

export function applyPersonNameOverrides(people: Person[]): Person[] {
  let changed = false
  const next = people.map((person) => {
    const resolved = resolvePersonNameOverride(person)
    if (resolved?.kind !== 'set_name' || !resolved.payload) return person
    changed = true
    return {
      ...person,
      name: resolved.payload.interpretedRaw,
      nameOverrideSource: person.nameOverrideSource ?? { originalDisplay: person.name },
    }
  })
  return changed ? next : people
}

export function applyPersonOverrides(people: Person[]): Person[] {
  return applyPersonNameOverrides(applyPersonDateOverrides(people))
}

export function personNameSignatureFor(person: Person): string {
  const raw = person.nameOverrideSource?.originalDisplay ?? person.nameSource?.rawPrimary ?? person.name
  return personNameSourceSignature(raw)
}
