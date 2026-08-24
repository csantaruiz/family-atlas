import { beforeEach, describe, expect, it } from 'vitest'
import { familyDatabase } from '../../data/familyDatabase'
import { familyMarriages } from '../../data/familyMarriages'
import { buildFamilyEvents } from '../../data/buildFamilyEvents'
import { collectNameDateFindings } from '../../atlas-health/nameDateFindings'
import { dateReviewDiagnosticKey, selectCustomerReviews } from '../../atlas-review/selectCustomerReviews'
import { rebindOverride, personDateEntityKey, personDateSourceSignature } from '../identity'
import { memoryOverrideStore } from '../memoryStore'
import {
  cacheUpsert,
  hydrateOverrideCache,
  setOverrideAtlasId,
} from '../overrideCache'
import {
  applyPersonDateOverrides,
  buildPersonDatePayload,
  isSafeDateCorrection,
} from '../applyPersonDateOverrides'
import type { Person } from '../../types'

const ATLAS = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

function nellie(): Person {
  return familyDatabase.people.find((person) => /nellie b\.? whipple/i.test(person.name)) as Person
}

beforeEach(() => {
  memoryOverrideStore.clear()
  setOverrideAtlasId(ATLAS)
  hydrateOverrideCache(ATLAS, [])
})

describe('person date overrides', () => {
  it('accepts year, month/year, full date, and about/before/after without turning about into exact', () => {
    expect(isSafeDateCorrection('1875')).toBe(true)
    expect(isSafeDateCorrection('Apr 1875')).toBe(true)
    expect(isSafeDateCorrection('5 Apr 1875')).toBe(true)
    expect(isSafeDateCorrection('Abt 1875')).toBe(true)
    expect(isSafeDateCorrection('Bef 1875')).toBe(true)
    expect(isSafeDateCorrection('Aft 1875')).toBe(true)
    expect(isSafeDateCorrection('BET 1870 AND 1875')).toBe(false)
    expect(isSafeDateCorrection('not a date')).toBe(false)
  })

  it('set_date changes effective birth without mutating the stored source person', () => {
    const person = { ...nellie() }
    const sourceDate = person.birthDate
    const key = personDateEntityKey(person.id, 'birth')
    cacheUpsert({
      entityType: 'person',
      entityKey: key,
      overrideType: 'set_date',
      sourceSignature: personDateSourceSignature('birth', sourceDate ?? ''),
      payload: buildPersonDatePayload({
        field: 'birth',
        originalRaw: sourceDate ?? '',
        interpretedRaw: '5 Apr 1870',
      }),
    })
    const [effective] = applyPersonDateOverrides([person])
    expect(person.birthDate).toBe(sourceDate)
    expect(effective.birthDate).toBe('5 Apr 1870')
    expect(effective.birthYear).toBe(1870)
    expect(effective.dateSource?.birthDate).toBe(sourceDate)
  })

  it('set_date on death changes effective death year', () => {
    const person = familyDatabase.people.find((row) => row.deathDate && row.deathYear) as Person
    const sourceDate = person.deathDate
    cacheUpsert({
      entityType: 'person',
      entityKey: personDateEntityKey(person.id, 'death'),
      overrideType: 'set_date',
      sourceSignature: personDateSourceSignature('death', sourceDate ?? ''),
      payload: buildPersonDatePayload({
        field: 'death',
        originalRaw: sourceDate ?? '',
        interpretedRaw: '1901',
      }),
    })
    const [effective] = applyPersonDateOverrides([person])
    expect(person.deathDate).toBe(sourceDate)
    expect(effective.deathDate).toBe('1901')
    expect(effective.deathYear).toBe(1901)
  })

  it('confirm_date does not change effective dates', () => {
    const person = { ...nellie() }
    cacheUpsert({
      entityType: 'person',
      entityKey: personDateEntityKey(person.id, 'birth'),
      overrideType: 'confirm_date',
      sourceSignature: personDateSourceSignature('birth', person.birthDate ?? ''),
      payload: buildPersonDatePayload({
        field: 'birth',
        originalRaw: person.birthDate ?? '',
        interpretedRaw: person.birthDate ?? '',
      }),
    })
    const [effective] = applyPersonDateOverrides([person])
    expect(effective.birthDate).toBe(person.birthDate)
    expect(effective.birthYear).toBe(person.birthYear)
  })

  it('timeline events use the corrected effective birth year', () => {
    const person = { ...nellie() }
    cacheUpsert({
      entityType: 'person',
      entityKey: personDateEntityKey(person.id, 'birth'),
      overrideType: 'set_date',
      sourceSignature: personDateSourceSignature('birth', person.birthDate ?? ''),
      payload: buildPersonDatePayload({
        field: 'birth',
        originalRaw: person.birthDate ?? '',
        interpretedRaw: '5 Apr 1870',
      }),
    })
    const events = buildFamilyEvents(applyPersonDateOverrides([person]), familyMarriages)
    expect(events.some((event) => event.kind === 'birth' && event.year === 1870 && event.person.id === person.id)).toBe(
      true,
    )
    expect(events.some((event) => event.kind === 'birth' && event.year === 1877 && event.person.id === person.id)).toBe(
      false,
    )
  })

  it('same source signature after reimport stays active', () => {
    const person = nellie()
    const key = personDateEntityKey(person.id, 'birth')
    const signature = personDateSourceSignature('birth', person.birthDate ?? '')
    const result = rebindOverride(
      {
        id: 'ov-date-1',
        entityKey: key,
        sourceSignature: signature,
        status: 'active',
      },
      [{ entityKey: key, sourceSignature: signature }],
    )
    expect(result.nextStatus).toBe('active')
  })

  it('changed source signature becomes needs_review', () => {
    const person = nellie()
    const key = personDateEntityKey(person.id, 'birth')
    const result = rebindOverride(
      {
        id: 'ov-date-2',
        entityKey: key,
        sourceSignature: personDateSourceSignature('birth', 'apr 5 1877'),
        status: 'active',
      },
      [{ entityKey: key, sourceSignature: personDateSourceSignature('birth', '5 Apr 1870') }],
    )
    expect(result.nextStatus).toBe('needs_review')
  })

  it('source-removed person does not apply the override to someone else', () => {
    const person = nellie()
    const other = familyDatabase.people.find((row) => row.id !== person.id) as Person
    const key = personDateEntityKey(person.id, 'birth')
    cacheUpsert({
      entityType: 'person',
      entityKey: key,
      overrideType: 'set_date',
      sourceSignature: personDateSourceSignature('birth', person.birthDate ?? ''),
      payload: buildPersonDatePayload({
        field: 'birth',
        originalRaw: person.birthDate ?? '',
        interpretedRaw: '5 Apr 1870',
      }),
    })
    const [effectiveOther] = applyPersonDateOverrides([other])
    expect(effectiveOther.birthDate).toBe(other.birthDate)
    const rebound = rebindOverride(
      {
        id: 'ov-date-3',
        entityKey: key,
        sourceSignature: personDateSourceSignature('birth', person.birthDate ?? ''),
        status: 'active',
      },
      [{ entityKey: personDateEntityKey(other.id, 'birth'), sourceSignature: personDateSourceSignature('birth', other.birthDate ?? '') }],
    )
    expect(rebound.nextStatus).toBe('orphaned')
  })
})

describe('customer date Review', () => {
  it('includes the Nellie Whipple contradiction before review', () => {
    const findings = collectNameDateFindings({
      people: familyDatabase.people,
      marriages: familyMarriages,
    })
    const nellieFinding = findings.find(
      (row) =>
        row.customerCandidate &&
        row.code === 'date_child_after_parent_death' &&
        /nellie/i.test(row.personName),
    )
    expect(nellieFinding).toBeTruthy()
    const queue = selectCustomerReviews()
    expect(queue.some((item) => item.domain === 'date' && /nellie/i.test(item.personName ?? ''))).toBe(true)
    expect(queue.some((item) => item.domain === 'date' && /lowndes/i.test(item.personName ?? ''))).toBe(false)
  })

  it('confirm_date on one side does not dismiss a two-sided date conflict', () => {
    const person = nellie()
    const sourceDate = person.birthDate
    cacheUpsert({
      entityType: 'person',
      entityKey: personDateEntityKey(person.id, 'birth'),
      overrideType: 'confirm_date',
      sourceSignature: personDateSourceSignature('birth', sourceDate ?? ''),
      payload: buildPersonDatePayload({
        field: 'birth',
        originalRaw: sourceDate ?? '',
        interpretedRaw: sourceDate ?? '',
      }),
    })
    expect(applyPersonDateOverrides([person])[0]?.birthDate).toBe(sourceDate)
    expect(selectCustomerReviews().some((item) => item.domain === 'date' && item.personId === person.id)).toBe(true)
    expect(
      collectNameDateFindings({
        people: applyPersonDateOverrides(familyDatabase.people),
        marriages: familyMarriages,
      }).some((row) => row.customerCandidate && /nellie/i.test(row.personName)),
    ).toBe(true)
  })

  it('confirming the conflict diagnostic dismisses Review without changing either date', () => {
    const person = nellie()
    const phebe = familyDatabase.people.find((row) => /phebe doll/i.test(row.name)) as Person
    const finding = collectNameDateFindings({
      people: familyDatabase.people,
      marriages: familyMarriages,
    }).find(
      (row) =>
        row.code === 'date_child_after_parent_death' && /nellie/i.test(row.personName),
    )
    expect(finding).toBeTruthy()
    cacheUpsert({
      entityType: 'diagnostic',
      entityKey: dateReviewDiagnosticKey(finding!),
      overrideType: 'disposition',
      reviewState: 'confirmed',
      payload: { category: 'atlas-review', disposition: 'confirmed', originalRef: person.birthDate },
    })
    expect(applyPersonDateOverrides([person])[0]?.birthDate).toBe(person.birthDate)
    expect(applyPersonDateOverrides([phebe])[0]?.deathDate).toBe(phebe.deathDate)
    expect(selectCustomerReviews().some((item) => item.domain === 'date' && item.personId === person.id)).toBe(false)
    expect(
      collectNameDateFindings({
        people: applyPersonDateOverrides(familyDatabase.people),
        marriages: familyMarriages,
      }).some((row) => row.customerCandidate && /nellie/i.test(row.personName)),
    ).toBe(true)
  })

  it('set_date on Nellie’s birth that resolves the contradiction removes it naturally', () => {
    const person = nellie()
    const phebe = familyDatabase.people.find((row) => /phebe doll/i.test(row.name)) as Person
    const phebeDeath = phebe.deathDate
    cacheUpsert({
      entityType: 'person',
      entityKey: personDateEntityKey(person.id, 'birth'),
      overrideType: 'set_date',
      sourceSignature: personDateSourceSignature('birth', person.birthDate ?? ''),
      payload: buildPersonDatePayload({
        field: 'birth',
        originalRaw: person.birthDate ?? '',
        interpretedRaw: '5 Apr 1870',
      }),
    })
    const people = applyPersonDateOverrides(familyDatabase.people)
    const findings = collectNameDateFindings({
      people,
      marriages: familyMarriages,
    })
    expect(findings.some((row) => row.customerCandidate && /nellie/i.test(row.personName))).toBe(false)
    expect(selectCustomerReviews().some((item) => item.domain === 'date' && item.personId === person.id)).toBe(false)
    expect(people.find((row) => row.id === phebe.id)?.deathDate).toBe(phebeDeath)
    expect(familyDatabase.people.find((row) => row.id === person.id)?.birthDate).toBe(person.birthDate)
  })

  it('set_date on Phebe’s death that resolves the contradiction does not change Nellie’s birth', () => {
    const person = nellie()
    const sourceBirth = person.birthDate
    const phebe = familyDatabase.people.find((row) => /phebe doll/i.test(row.name)) as Person
    cacheUpsert({
      entityType: 'person',
      entityKey: personDateEntityKey(phebe.id, 'death'),
      overrideType: 'set_date',
      sourceSignature: personDateSourceSignature('death', phebe.deathDate ?? ''),
      payload: buildPersonDatePayload({
        field: 'death',
        originalRaw: phebe.deathDate ?? '',
        interpretedRaw: '1880',
      }),
    })
    const people = applyPersonDateOverrides(familyDatabase.people)
    expect(people.find((row) => row.id === person.id)?.birthDate).toBe(sourceBirth)
    expect(people.find((row) => row.id === phebe.id)?.deathDate).toBe('1880')
    expect(familyDatabase.people.find((row) => row.id === phebe.id)?.deathDate).toBe(phebe.deathDate)
    const findings = collectNameDateFindings({
      people,
      marriages: familyMarriages,
    })
    expect(findings.some((row) => row.customerCandidate && /nellie/i.test(row.personName))).toBe(false)
    expect(selectCustomerReviews().some((item) => item.domain === 'date' && item.personId === person.id)).toBe(false)
  })

  it('ignore disposition does not change the person date and drops the Review item', () => {
    const person = nellie()
    const finding = collectNameDateFindings({
      people: familyDatabase.people,
      marriages: familyMarriages,
    }).find(
      (row) =>
        row.code === 'date_child_after_parent_death' && /nellie/i.test(row.personName),
    )
    expect(finding).toBeTruthy()
    cacheUpsert({
      entityType: 'diagnostic',
      entityKey: dateReviewDiagnosticKey(finding!),
      overrideType: 'disposition',
      reviewState: 'ignored',
      payload: { category: 'atlas-review', disposition: 'ignored', originalRef: person.birthDate },
    })
    expect(applyPersonDateOverrides([person])[0]?.birthDate).toBe(person.birthDate)
    expect(selectCustomerReviews().some((item) => item.domain === 'date' && item.personId === person.id)).toBe(
      false,
    )
  })

  it('I’m not sure writes nothing', () => {
    const before = memoryOverrideStore.list(ATLAS)
    expect(before).toHaveLength(0)
    expect(selectCustomerReviews().some((item) => item.domain === 'date' && /nellie/i.test(item.personName ?? ''))).toBe(
      true,
    )
    expect(memoryOverrideStore.list(ATLAS)).toHaveLength(0)
  })

  it('does not apply a person date override from another atlas', () => {
    const person = { ...nellie() }
    cacheUpsert({
      entityType: 'person',
      entityKey: personDateEntityKey(person.id, 'birth'),
      overrideType: 'set_date',
      sourceSignature: personDateSourceSignature('birth', person.birthDate ?? ''),
      payload: buildPersonDatePayload({
        field: 'birth',
        originalRaw: person.birthDate ?? '',
        interpretedRaw: '5 Apr 1870',
      }),
    })
    setOverrideAtlasId('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
    hydrateOverrideCache('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', [])
    expect(applyPersonDateOverrides([person])[0]?.birthDate).toBe(person.birthDate)
  })

  it('keeps unusual and uncertain date findings in Health only', () => {
    const findings = collectNameDateFindings({
      people: familyDatabase.people,
      marriages: familyMarriages,
    })
    const unusual = findings.filter((row) => row.domain === 'date' && row.severity !== 'impossible')
    expect(unusual.length).toBeGreaterThan(0)
    const queue = selectCustomerReviews().filter((item) => item.domain === 'date')
    for (const row of unusual) {
      expect(queue.some((item) => item.findingCode === row.code && item.personId === row.personId)).toBe(false)
    }
  })
})
