import { describe, expect, it } from 'vitest'
import { buildFamilyEvents } from '../../data/buildFamilyEvents'
import { familyDatabase } from '../../data/familyDatabase'
import { dedupeFamilyEvents } from '../../utils/canonicalEvent'
import {
  buildMigrationSegments,
  buildPlaceIndex,
} from '../../utils/placeIndex'
import {
  buildCanonicalMigrationCorridors,
  clearGedcomRouteCache,
  resolveGedcomPlaceToCanonicalId,
} from '../core/gedcomMigrationDirector'

describe('GEDCOM segment resolution', () => {
  it('maps Pennsylvania to Camden moves into canonical endpoints', () => {
    clearGedcomRouteCache()
    const people = familyDatabase.people
    const events = dedupeFamilyEvents(buildFamilyEvents(people))
    const migrations = buildMigrationSegments(people, events)

    const paSegments = migrations.filter(
      (segment) =>
        segment.from.toLowerCase().includes('pennsylvania') ||
        segment.to.toLowerCase().includes('pennsylvania'),
    )
    expect(paSegments.length).toBeGreaterThan(0)

    const camdenSegment = migrations.find(
      (segment) =>
        segment.from.toLowerCase().includes('pennsylvania') &&
        segment.to.toLowerCase().includes('camden'),
    )
    expect(camdenSegment).toBeDefined()
    const rawDistance = Math.hypot(
      camdenSegment!.toCoord.x - camdenSegment!.fromCoord.x,
      camdenSegment!.toCoord.y - camdenSegment!.fromCoord.y,
    )
    expect(rawDistance).toBeGreaterThanOrEqual(1.5)
    expect(resolveGedcomPlaceToCanonicalId(camdenSegment!.from)).toBe('pennsylvania')
    expect(resolveGedcomPlaceToCanonicalId(camdenSegment!.to)).toBe('new-jersey')

    const corridors = buildCanonicalMigrationCorridors()
    expect(corridors.some((corridor) => corridor.id === 'pennsylvania->new-jersey')).toBe(true)
  })
})
