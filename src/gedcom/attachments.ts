import { storySeeds } from '../data/storySeeds'
import { DOCUMENTARY_MANIFEST } from '../documentary-engine/data/documentaryManifest'
import type { FamilyGraph } from './types'

export type PersonAttachmentKind = 'media' | 'story' | 'documentary'
export type OverrideAttachmentKind = 'place_override' | 'event_override' | 'review_disposition'

export type PersonAttachment = {
  kind: PersonAttachmentKind
  id: string
  personId: string
  label: string
}

export type OverrideAttachment = {
  kind: OverrideAttachmentKind
  id: string
  entityKey: string
  sourceSignature: string
  label: string
}

/**
 * In-memory attachment inventory for the 2D.2 dry-run.
 * Media and override rows are supplied by the caller (tests or a future read-only fetch).
 * Stories and documentary references can be collected from the repo without I/O.
 */
export type AtlasAttachments = {
  current: FamilyGraph
  candidate: FamilyGraph
  media: PersonAttachment[]
  stories: PersonAttachment[]
  documentary: PersonAttachment[]
  placeOverrides: OverrideAttachment[]
  eventOverrides: OverrideAttachment[]
}

export function collectStaticAtlasAttachments(): Pick<
  AtlasAttachments,
  'stories' | 'documentary'
> {
  const stories: PersonAttachment[] = storySeeds.map((seed) => ({
    kind: 'story',
    id: `story:${seed.personId}:${seed.year}`,
    personId: seed.personId,
    label: seed.title,
  }))

  const documentary: PersonAttachment[] = []
  const seen = new Set<string>()
  for (const scene of DOCUMENTARY_MANIFEST) {
    for (const personId of scene.people ?? []) {
      const id = `documentary:${scene.id}:${personId}`
      if (seen.has(id)) continue
      seen.add(id)
      documentary.push({
        kind: 'documentary',
        id,
        personId,
        label: `${scene.title} (${personId})`,
      })
    }
    for (const person of scene.choreography?.approvedPeople ?? []) {
      if (!person.personId) continue
      const id = `documentary:${scene.id}:${person.personId}`
      if (seen.has(id)) continue
      seen.add(id)
      documentary.push({
        kind: 'documentary',
        id,
        personId: person.personId,
        label: person.displayName ?? person.personId,
      })
    }
  }

  return { stories, documentary }
}

export function allPlaceStrings(graph: FamilyGraph): string[] {
  const places: string[] = []
  for (const person of graph.people) {
    if (person.birthPlace) places.push(person.birthPlace)
    if (person.deathPlace) places.push(person.deathPlace)
    places.push(...person.places)
  }
  for (const marriage of graph.marriages) {
    if (marriage.place) places.push(marriage.place)
  }
  return places
}
