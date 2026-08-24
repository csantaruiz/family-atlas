import { beforeEach, describe, expect, it } from 'vitest'
import { familyDatabase } from '../../data/familyDatabase'
import { familyMarriages } from '../../data/familyMarriages'
import { collectNameDateFindings } from '../../atlas-health/nameDateFindings'
import { selectCustomerReviews } from '../../atlas-review/selectCustomerReviews'
import { rebindOverride, personNameEntityKey, personNameSourceSignature } from '../identity'
import { memoryOverrideStore } from '../memoryStore'
import { cacheUpsert, hydrateOverrideCache, setOverrideAtlasId } from '../overrideCache'
import {
  applyPersonNameOverrides,
  applyPersonOverrides,
  buildPersonNamePayload,
  isSafeNameCorrection,
  suggestCleanedName,
} from '../applyPersonNameOverrides'
import type { Person } from '../../types'

const ATLAS = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

function salvador(): Person {
  return familyDatabase.people.find((person) => /salvador/i.test(person.name)) as Person
}

beforeEach(() => {
  memoryOverrideStore.clear()
  setOverrideAtlasId(ATLAS)
  hydrateOverrideCache(ATLAS, [])
})

describe('person name overrides', () => {
  it('suggests a cleaned name without turning other punctuation into a new identity', () => {
    expect(suggestCleanedName('Salvador* Pinon Vernal')).toBe('Salvador Pinon Vernal')
    expect(isSafeNameCorrection('Salvador Pinon Vernal')).toBe(true)
    expect(isSafeNameCorrection('Salvador* Pinon Vernal')).toBe(false)
    expect(isSafeNameCorrection('')).toBe(false)
  })

  it('set_name changes effective display name without mutating the stored source person', () => {
    const person = { ...salvador() }
    const sourceName = person.name
    cacheUpsert({
      entityType: 'person',
      entityKey: personNameEntityKey(person.id),
      overrideType: 'set_name',
      sourceSignature: personNameSourceSignature(sourceName),
      payload: buildPersonNamePayload({
        originalRaw: sourceName,
        interpretedRaw: 'Salvador Pinon Vernal',
      }),
    })
    const [effective] = applyPersonNameOverrides([person])
    expect(person.name).toBe(sourceName)
    expect(effective.name).toBe('Salvador Pinon Vernal')
    expect(effective.nameOverrideSource?.originalDisplay).toBe(sourceName)
  })

  it('confirm_name does not change the displayed name', () => {
    const person = { ...salvador() }
    cacheUpsert({
      entityType: 'person',
      entityKey: personNameEntityKey(person.id),
      overrideType: 'confirm_name',
      sourceSignature: personNameSourceSignature(person.name),
      payload: buildPersonNamePayload({
        originalRaw: person.name,
        interpretedRaw: person.name,
      }),
    })
    const [effective] = applyPersonNameOverrides([person])
    expect(effective.name).toBe(person.name)
    expect(effective.nameOverrideSource).toBeUndefined()
  })

  it('same source signature after reimport stays active', () => {
    const person = salvador()
    const key = personNameEntityKey(person.id)
    const signature = personNameSourceSignature(person.name)
    const result = rebindOverride(
      {
        id: 'ov-name-1',
        entityKey: key,
        sourceSignature: signature,
        status: 'active',
      },
      [{ entityKey: key, sourceSignature: signature }],
    )
    expect(result.nextStatus).toBe('active')
  })

  it('changed source signature becomes needs_review', () => {
    const person = salvador()
    const key = personNameEntityKey(person.id)
    const result = rebindOverride(
      {
        id: 'ov-name-2',
        entityKey: key,
        sourceSignature: personNameSourceSignature('Salvador* Pinon Vernal'),
        status: 'active',
      },
      [{ entityKey: key, sourceSignature: personNameSourceSignature('Salvador Pinon Vernal') }],
    )
    expect(result.nextStatus).toBe('needs_review')
  })

  it('source-removed person does not apply the override to someone else', () => {
    const person = salvador()
    const other = familyDatabase.people.find((row) => row.id !== person.id) as Person
    const key = personNameEntityKey(person.id)
    cacheUpsert({
      entityType: 'person',
      entityKey: key,
      overrideType: 'set_name',
      sourceSignature: personNameSourceSignature(person.name),
      payload: buildPersonNamePayload({
        originalRaw: person.name,
        interpretedRaw: 'Salvador Pinon Vernal',
      }),
    })
    const [effectiveOther] = applyPersonNameOverrides([other])
    expect(effectiveOther.name).toBe(other.name)
    const rebound = rebindOverride(
      {
        id: 'ov-name-3',
        entityKey: key,
        sourceSignature: personNameSourceSignature(person.name),
        status: 'active',
      },
      [{ entityKey: personNameEntityKey(other.id), sourceSignature: personNameSourceSignature(other.name) }],
    )
    expect(rebound.nextStatus).toBe('orphaned')
  })
})

describe('customer name Review', () => {
  it('includes Salvador* before review', () => {
    const findings = collectNameDateFindings({
      people: familyDatabase.people,
      marriages: familyMarriages,
    })
    expect(
      findings.some(
        (row) =>
          row.customerCandidate &&
          row.code === 'name_import_garbage' &&
          /salvador/i.test(row.personName),
      ),
    ).toBe(true)
    const queue = selectCustomerReviews()
    expect(queue.some((item) => item.domain === 'name' && /salvador/i.test(item.personName ?? ''))).toBe(true)
    expect(queue.some((item) => item.domain === 'name' && /unknown/i.test(item.personName ?? ''))).toBe(false)
  })

  it('set_name removes the name card and the Health garbage finding', () => {
    const person = salvador()
    const sourceName = person.name
    cacheUpsert({
      entityType: 'person',
      entityKey: personNameEntityKey(person.id),
      overrideType: 'set_name',
      sourceSignature: personNameSourceSignature(sourceName),
      payload: buildPersonNamePayload({
        originalRaw: sourceName,
        interpretedRaw: 'Salvador Pinon Vernal',
      }),
    })
    const people = applyPersonOverrides(familyDatabase.people)
    expect(people.find((row) => row.id === person.id)?.name).toBe('Salvador Pinon Vernal')
    expect(familyDatabase.people.find((row) => row.id === person.id)?.name).toBe(sourceName)
    expect(
      collectNameDateFindings({ people, marriages: familyMarriages }).some(
        (row) => row.code === 'name_import_garbage' && row.personId === person.id,
      ),
    ).toBe(false)
    expect(selectCustomerReviews().some((item) => item.domain === 'name' && item.personId === person.id)).toBe(false)
  })

  it('confirm_name leaves the GEDCOM name and Health finding, and drops Review', () => {
    const person = salvador()
    cacheUpsert({
      entityType: 'person',
      entityKey: personNameEntityKey(person.id),
      overrideType: 'confirm_name',
      sourceSignature: personNameSourceSignature(person.name),
      payload: buildPersonNamePayload({
        originalRaw: person.name,
        interpretedRaw: person.name,
      }),
    })
    expect(applyPersonNameOverrides([person])[0]?.name).toBe(person.name)
    expect(
      collectNameDateFindings({
        people: applyPersonOverrides(familyDatabase.people),
        marriages: familyMarriages,
      }).some((row) => row.code === 'name_import_garbage' && row.personId === person.id),
    ).toBe(true)
    expect(selectCustomerReviews().some((item) => item.domain === 'name' && item.personId === person.id)).toBe(false)
  })

  it('I’m not sure writes nothing', () => {
    expect(memoryOverrideStore.list(ATLAS)).toHaveLength(0)
    expect(selectCustomerReviews().some((item) => item.domain === 'name' && /salvador/i.test(item.personName ?? ''))).toBe(
      true,
    )
    expect(memoryOverrideStore.list(ATLAS)).toHaveLength(0)
  })
})
