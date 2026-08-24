import type { AtlasPersonAliasRow, AtlasPersonRow } from '../../atlas-identity/seedAtlasPeople'
import { candidateBlockers } from '../import/blockers'
import type { FamilySnapshot } from '../import/snapshotFromGraph'
import type { IdentityDecision } from '../classifyIdentity'
import type { ReconciliationPlan } from '../planGedcomReconciliation'
import type { FamilyGraph, GedcomPerson } from '../types'
import { rewriteSnapshotToAtlasIds } from './rewriteSnapshot'

export type ActivationPersonAction = 'reuse_exact' | 'reuse_strong' | 'create' | 'source_removed'

export type ActivationPersonOp = {
  action: ActivationPersonAction
  atlasPersonId: string
  candidateGedcomId: string | null
  currentGedcomId: string | null
  displayName: string
  birthYear: number | null
  deathYear: number | null
  matchKind: 'exact' | 'strong_match' | 'seeded'
}

export type EventOverrideRewrite = {
  id: string
  fromKey: string
  toKey: string
  keep: boolean
}

export type PersonOverrideRewrite = EventOverrideRewrite

export type ActivationPlan = {
  blocked: boolean
  blockers: Array<{ code: string; detail: string }>
  ops: ActivationPersonOp[]
  gedcomToAtlas: Record<string, string>
  rootAtlasPersonId: string | null
  eventRewrites: EventOverrideRewrite[]
  personRewrites: PersonOverrideRewrite[]
}

export type ExistingIdentity = {
  people: AtlasPersonRow[]
  aliases: AtlasPersonAliasRow[]
}

export type StoredEventOverride = {
  id: string
  entityKey: string
}

function lookupExistingPerson(
  existing: ExistingIdentity,
  atlasId: string,
  gedcomId: string,
): AtlasPersonRow | undefined {
  const byCurrent = existing.people.find(
    (row) => row.atlasId === atlasId && row.currentSourcePersonId === gedcomId,
  )
  if (byCurrent) return byCurrent
  const alias = existing.aliases.find(
    (item) => item.atlasId === atlasId && item.sourcePersonId === gedcomId,
  )
  if (!alias) return undefined
  return existing.people.find((row) => row.id === alias.atlasPersonId)
}

function personMeta(graph: FamilyGraph, id: string | null): Pick<GedcomPerson, 'name' | 'birthYear' | 'deathYear'> {
  const person = graph.people.find((item) => item.id === id)
  return {
    name: person?.name ?? '',
    birthYear: person?.birthYear ?? null,
    deathYear: person?.deathYear ?? null,
  }
}

function remapEventKey(
  entityKey: string,
  candidateToAtlas: Map<string, string>,
  currentToAtlas: Map<string, string>,
): string {
  const separator = entityKey.indexOf(':')
  if (separator <= 0) return entityKey
  const sourceId = entityKey.slice(0, separator)
  const mapped = candidateToAtlas.get(sourceId) ?? currentToAtlas.get(sourceId)
  if (!mapped) return entityKey
  return `${mapped}${entityKey.slice(separator)}`
}

function eventExistsOnSnapshot(key: string, snapshot: FamilySnapshot): boolean {
  const [personId, kind, yearRaw] = key.split(':')
  const year = Number(yearRaw)
  const person = snapshot.people.find((item) => item.id === personId)
  if (!person || Number.isNaN(year)) return false
  if (kind === 'birth') return person.birthYear === year
  if (kind === 'death') return person.deathYear === year
  if (kind === 'marriage') {
    return snapshot.marriages.some(
      (marriage) =>
        marriage.year === year && (marriage.husbandId === personId || marriage.wifeId === personId),
    )
  }
  return false
}

function pushRemoved(
  ops: ActivationPersonOp[],
  existing: ExistingIdentity,
  atlasId: string,
  gedcomId: string,
) {
  const row = lookupExistingPerson(existing, atlasId, gedcomId)
  if (!row) return
  if (ops.some((op) => op.atlasPersonId === row.id && op.action === 'source_removed')) return
  ops.push({
    action: 'source_removed',
    atlasPersonId: row.id,
    candidateGedcomId: null,
    currentGedcomId: gedcomId,
    displayName: row.displayName,
    birthYear: row.birthYear,
    deathYear: row.deathYear,
    matchKind: 'seeded',
  })
}

export function planGedcomActivation(input: {
  atlasId: string
  currentRootGedcomId: string
  identity: IdentityDecision[]
  plan: ReconciliationPlan
  existing: ExistingIdentity
  candidate: FamilyGraph
  snapshot: FamilySnapshot
  eventOverrides: StoredEventOverride[]
  personOverrides?: StoredEventOverride[]
  createId: () => string
}): ActivationPlan {
  const blockers = candidateBlockers(input.plan)
  if (blockers.length) {
    return {
      blocked: true,
      blockers,
      ops: [],
      gedcomToAtlas: {},
      rootAtlasPersonId: null,
      eventRewrites: [],
      personRewrites: [],
    }
  }

  const ops: ActivationPersonOp[] = []
  const gedcomToAtlas = new Map<string, string>()
  const currentToAtlas = new Map<string, string>()
  const seenCandidate = new Set<string>()

  for (const decision of input.identity) {
    if (
      (decision.tier === 'exact' || decision.tier === 'strong_match') &&
      decision.currentId &&
      decision.candidateId
    ) {
      const existing = lookupExistingPerson(input.existing, input.atlasId, decision.currentId)
      const atlasPersonId = existing?.id ?? input.createId()
      const meta = personMeta(input.candidate, decision.candidateId)
      ops.push({
        action: decision.tier === 'exact' ? 'reuse_exact' : 'reuse_strong',
        atlasPersonId,
        candidateGedcomId: decision.candidateId,
        currentGedcomId: decision.currentId,
        displayName: meta.name || decision.candidateName || decision.currentName || '',
        birthYear: meta.birthYear,
        deathYear: meta.deathYear,
        matchKind: decision.tier === 'exact' ? 'exact' : 'strong_match',
      })
      gedcomToAtlas.set(decision.candidateId, atlasPersonId)
      currentToAtlas.set(decision.currentId, atlasPersonId)
      seenCandidate.add(decision.candidateId)
      continue
    }

    if (decision.tier === 'ambiguous' || decision.tier === 'unmatched') {
      if (decision.currentId) pushRemoved(ops, input.existing, input.atlasId, decision.currentId)
      if (decision.candidateId && !seenCandidate.has(decision.candidateId)) {
        const meta = personMeta(input.candidate, decision.candidateId)
        const atlasPersonId = input.createId()
        ops.push({
          action: 'create',
          atlasPersonId,
          candidateGedcomId: decision.candidateId,
          currentGedcomId: null,
          displayName: meta.name || decision.candidateName || '',
          birthYear: meta.birthYear,
          deathYear: meta.deathYear,
          matchKind: 'seeded',
        })
        gedcomToAtlas.set(decision.candidateId, atlasPersonId)
        seenCandidate.add(decision.candidateId)
      }
    }
  }

  for (const person of input.candidate.people) {
    if (seenCandidate.has(person.id)) continue
    const atlasPersonId = input.createId()
    ops.push({
      action: 'create',
      atlasPersonId,
      candidateGedcomId: person.id,
      currentGedcomId: null,
      displayName: person.name,
      birthYear: person.birthYear,
      deathYear: person.deathYear,
      matchKind: 'seeded',
    })
    gedcomToAtlas.set(person.id, atlasPersonId)
  }

  const rewritten = rewriteSnapshotToAtlasIds(input.snapshot, gedcomToAtlas)
  const eventRewrites: EventOverrideRewrite[] = input.eventOverrides.map((row) => {
    const toKey = remapEventKey(row.entityKey, gedcomToAtlas, currentToAtlas)
    return {
      id: row.id,
      fromKey: row.entityKey,
      toKey,
      keep: eventExistsOnSnapshot(toKey, rewritten),
    }
  })

  const rootGedcom = input.candidate.people.some((person) => person.id === input.currentRootGedcomId)
    ? input.currentRootGedcomId
    : input.snapshot.root

  const personRewrites: PersonOverrideRewrite[] = (input.personOverrides ?? []).map((row) => {
    const toKey = remapEventKey(row.entityKey, gedcomToAtlas, currentToAtlas)
    const parsed = toKey.split(':')
    const personId = parsed[0]
    const keep = rewritten.people.some((person) => person.id === personId)
    return {
      id: row.id,
      fromKey: row.entityKey,
      toKey,
      keep,
    }
  })

  return {
    blocked: false,
    blockers: [],
    ops,
    gedcomToAtlas: Object.fromEntries(gedcomToAtlas),
    rootAtlasPersonId: gedcomToAtlas.get(rootGedcom) ?? null,
    eventRewrites,
    personRewrites,
  }
}
