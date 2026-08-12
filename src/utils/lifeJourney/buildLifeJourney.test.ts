import { describe, expect, it } from 'vitest'
import { buildFamilyEvents } from '../../data/buildFamilyEvents'
import { familyDatabase } from '../../data/familyDatabase'
import { dedupeFamilyEvents } from '../canonicalEvent'
import { journeyPlaceKey, resolveJourneyCoordinate } from './journeyPlace'
import { resolvePlaceCoordinate } from '../../data/placeCoordinates'
import { buildLifeJourney } from './buildLifeJourney'
import type { Person } from '../../types'

const VICTOR_ID = 'I18123023748'
const HENDRY_ID = 'I18123023682'
const ED_RUIZ_ID = 'I18123023669'

const peopleById = Object.fromEntries(familyDatabase.people.map((person) => [person.id, person]))
const events = dedupeFamilyEvents(buildFamilyEvents(familyDatabase.people))

describe('journeyPlaceKey', () => {
  it('does not treat California Westminster as England', () => {
    expect(journeyPlaceKey('Westminster, Orange, California, USA')).toBe('united-states:california')
    expect(journeyPlaceKey('Westminster, London, England')).toBe('england')
  })

  it('does not treat Gloucester City, New Jersey as England', () => {
    expect(journeyPlaceKey('Gloucester City, Camden, New Jersey')).toBe('united-states:new-jersey')
  })
})

describe('journey map coordinates', () => {
  it('keeps El Paso distinct from Chihuahua Mexico', () => {
    const elPaso = resolveJourneyCoordinate('El Paso, Texas, USA')
    const mexico = resolvePlaceCoordinate('Chihuahua, Chihuahua, Mexico')
    expect(elPaso.resolved).toBe(true)
    expect(elPaso.region).toBe('United States')
    expect(mexico.region).toBe('Mexico')
    expect(Math.abs(elPaso.y - mexico.y)).toBeGreaterThan(0.5)
  })

  it('frames Victor birth on El Paso, not Mexico stock', () => {
    const journey = buildLifeJourney(peopleById[VICTOR_ID], events)
    const birth = journey.beats.find((beat) => beat.type === 'birth')
    expect(birth?.locationLabel).toMatch(/El Paso/i)
    expect(birth?.map?.resolved).toBe(true)
    expect(birth?.image?.alt).toMatch(/El Paso/i)
    expect(birth?.image?.alt).not.toMatch(/Chihuahua/i)
  })
})

describe('buildLifeJourney', () => {
  it('is available for any sufficiently documented person, not only Victor', () => {
    const eligible = familyDatabase.people.filter((person) => buildLifeJourney(person, events).eligible)
    expect(eligible.length).toBeGreaterThan(5)
    expect(eligible.some((person) => person.id === VICTOR_ID)).toBe(true)
    expect(eligible.some((person) => person.id === HENDRY_ID)).toBe(true)
    expect(eligible.some((person) => person.id === ED_RUIZ_ID)).toBe(false)
  })

  it('builds a rich journey for Victor without inventing New Jersey', () => {
    const person = peopleById[VICTOR_ID]
    const journey = buildLifeJourney(person, events)
    expect(journey.eligible).toBe(true)
    expect(journey.beats.length).toBeGreaterThanOrEqual(5)
    expect(journey.beats.length).toBeLessThanOrEqual(8)
    expect(journey.beats.some((beat) => beat.type === 'service')).toBe(true)
    expect(journey.beats.some((beat) => beat.type === 'birth')).toBe(true)
    expect(journey.beats.some((beat) => beat.type === 'death')).toBe(true)

    const hay = journey.beats.map((beat) => `${beat.title} ${beat.caption} ${beat.locationLabel ?? ''}`).join(' ')
    expect(hay).not.toMatch(/New Jersey|Camden|Gloucester/i)
    expect(hay).toMatch(/El Paso/i)
    expect(hay).toMatch(/California|Monrovia/i)

    const service = journey.beats.find((beat) => beat.type === 'service')
    expect(service?.evidence).toBe('historical-context')
    expect(service?.locationLabel).toMatch(/England/i)

    const move = journey.beats.find((beat) => beat.type === 'move')
    expect(move?.evidence).toBe('inferred')
    expect(journey.beats.every((beat) => beat.image != null)).toBe(true)
    expect(journey.beats.some((beat) => beat.imageKind === 'stock')).toBe(true)
  })

  it('builds a moderate journey for James J Hendry', () => {
    const person = peopleById[HENDRY_ID]
    const journey = buildLifeJourney(person, events)
    expect(journey.eligible).toBe(true)
    expect(journey.beats.length).toBeGreaterThanOrEqual(3)
    const hay = journey.beats.map((beat) => `${beat.title} ${beat.caption} ${beat.locationLabel ?? ''}`).join(' ')
    expect(hay).toMatch(/Scotland/i)
    expect(hay).toMatch(/Jersey|Camden/i)
    expect(journey.beats.some((beat) => beat.type === 'marriage' || beat.type === 'move')).toBe(true)
  })

  it('rejects sparse Ed Ruiz', () => {
    const person = peopleById[ED_RUIZ_ID]
    const journey = buildLifeJourney(person, events)
    expect(journey.eligible).toBe(false)
    expect(journey.beats).toEqual([])
  })

  it('rejects birth-and-death only when both places are the same region', () => {
    const person: Person = {
      id: 'test-same-place',
      name: 'Test Person',
      birthYear: 1900,
      birthPlace: 'Gawsworth, Cheshire, England',
      deathYear: 1970,
      deathPlace: 'Gawsworth, Cheshire, England',
      places: ['Gawsworth, Cheshire, England'],
    }
    const journey = buildLifeJourney(person, events)
    expect(journey.eligible).toBe(false)
  })

  it('does not treat a California death as a transatlantic move', () => {
    const person: Person = {
      id: 'test-westminster-ca',
      name: 'Test Californian',
      birthYear: 1910,
      birthPlace: 'El Paso, Texas, USA',
      deathYear: 1980,
      deathPlace: 'Westminster, Orange, California, USA',
      places: ['El Paso, Texas, USA', 'Westminster, Orange, California, USA'],
      occupation: ['clerk'],
    }
    const extra = [
      {
        kind: 'birth' as const,
        year: 1910,
        title: 'Test Californian is born',
        detail: person.birthPlace ?? '',
        person,
        importance: 1,
      },
      {
        kind: 'service' as const,
        year: 1942,
        title: 'Test Californian wartime service',
        detail: 'Recorded service',
        person,
        importance: 4,
      },
      {
        kind: 'death' as const,
        year: 1980,
        title: 'The life of Test Californian closes',
        detail: person.deathPlace ?? '',
        person,
        importance: 1,
      },
    ]
    const journey = buildLifeJourney(person, extra)
    expect(journey.eligible).toBe(true)
    const hay = journey.beats.map((beat) => `${beat.title} ${beat.caption} ${beat.locationLabel ?? ''}`).join(' ')
    expect(hay).not.toMatch(/\bEngland\b/)
    expect(hay).toMatch(/California/i)
  })
})
