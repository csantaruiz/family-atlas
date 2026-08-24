import type { AtlasPersonAliasRow, AtlasPersonRow, MediaRow } from '../../atlas-identity/seedAtlasPeople'
import type { ActivationPlan } from './planActivation'

export type ImportRowState = {
  id: string
  atlasId: string
  status: string
}

export type ActivationStore = {
  atlasId: string
  activeImportId: string | null
  people: AtlasPersonRow[]
  aliases: AtlasPersonAliasRow[]
  imports: ImportRowState[]
  media: MediaRow[]
  eventOverrides: Array<{ id: string; entityKey: string; status: string }>
  personOverrides?: Array<{ id: string; entityKey: string; status: string }>
}

export function applyActivationPlan(
  store: ActivationStore,
  plan: ActivationPlan,
  importId: string,
): ActivationStore {
  if (plan.blocked) {
    throw new Error('Activation blocked')
  }
  const incoming = store.imports.find((row) => row.id === importId)
  if (!incoming || incoming.atlasId !== store.atlasId) {
    throw new Error('Import does not belong to this Atlas')
  }
  if (incoming.status !== 'ready' && incoming.status !== 'uploaded' && incoming.status !== 'processing') {
    throw new Error('Import is not ready to activate')
  }

  const previousImportId = store.activeImportId
  const people = store.people.map((row) => ({ ...row }))
  const aliases = store.aliases.map((row) => ({ ...row }))
  const imports = store.imports.map((row) => ({ ...row }))
  const eventOverrides = store.eventOverrides.map((row) => ({ ...row }))
  const personOverrides = (store.personOverrides ?? []).map((row) => ({ ...row }))

  for (const op of plan.ops) {
    if (op.action === 'create') {
      people.push({
        id: op.atlasPersonId,
        atlasId: store.atlasId,
        status: 'active',
        displayName: op.displayName,
        birthYear: op.birthYear,
        deathYear: op.deathYear,
        currentSourcePersonId: op.candidateGedcomId ?? '',
      })
    } else {
      const row = people.find((item) => item.id === op.atlasPersonId)
      if (!row) continue
      if (op.action === 'source_removed') {
        row.status = 'source_removed'
      } else {
        row.status = 'active'
        row.displayName = op.displayName
        row.birthYear = op.birthYear
        row.deathYear = op.deathYear
        if (op.candidateGedcomId) row.currentSourcePersonId = op.candidateGedcomId
      }
    }
    if (op.candidateGedcomId) {
      aliases.push({
        id: `${importId}:${op.candidateGedcomId}`,
        atlasPersonId: op.atlasPersonId,
        atlasId: store.atlasId,
        importId,
        sourceType: 'gedcom',
        sourcePersonId: op.candidateGedcomId,
        matchKind: op.matchKind === 'seeded' ? 'seeded' : op.matchKind,
      })
    }
  }

  for (const rewrite of plan.eventRewrites) {
    const row = eventOverrides.find((item) => item.id === rewrite.id)
    if (!row) continue
    if (rewrite.keep) row.entityKey = rewrite.toKey
    else row.status = 'orphaned'
  }

  for (const rewrite of plan.personRewrites ?? []) {
    const row = personOverrides.find((item) => item.id === rewrite.id)
    if (!row) continue
    if (rewrite.keep) row.entityKey = rewrite.toKey
    else row.status = 'orphaned'
  }

  for (const row of imports) {
    if (row.id === previousImportId) row.status = 'superseded'
    if (row.id === importId) row.status = 'active'
  }

  return {
    ...store,
    people,
    aliases,
    imports,
    eventOverrides,
    personOverrides,
    media: store.media.map((row) => ({ ...row })),
    activeImportId: importId,
  }
}

/** Apply in memory, then persist. If persist throws, the original store is unchanged. */
export function commitActivationPlan(
  store: ActivationStore,
  plan: ActivationPlan,
  importId: string,
  persist: (next: ActivationStore) => void,
): ActivationStore {
  const next = applyActivationPlan(store, plan, importId)
  persist(next)
  return next
}
