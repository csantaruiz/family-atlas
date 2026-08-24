import type { AtlasOverrideRecord, UpsertOverrideInput } from './types'
import { randomUUID } from './uuid'

/**
 * In-memory atlas override store — used by tests and as the sync cache backing.
 * Production persistence is Neon via /api/overrides.
 */
export class InMemoryAtlasOverrideStore {
  private rows = new Map<string, AtlasOverrideRecord>()

  clear(): void {
    this.rows.clear()
  }

  clearAtlas(atlasId: string): void {
    for (const [id, row] of this.rows) {
      if (row.atlasId === atlasId) this.rows.delete(id)
    }
  }

  list(atlasId: string, opts?: { status?: string; entityType?: string }): AtlasOverrideRecord[] {
    return [...this.rows.values()].filter((row) => {
      if (row.atlasId !== atlasId) return false
      if (opts?.status && row.status !== opts.status) return false
      if (opts?.entityType && row.entityType !== opts.entityType) return false
      return true
    })
  }

  get(id: string): AtlasOverrideRecord | null {
    return this.rows.get(id) ?? null
  }

  lookup(
    atlasId: string,
    entityType: string,
    entityKey: string,
    overrideType?: string,
  ): AtlasOverrideRecord | null {
    const active = this.list(atlasId, { status: 'active' }).filter(
      (row) =>
        row.entityType === entityType &&
        row.entityKey === entityKey &&
        (!overrideType || row.overrideType === overrideType),
    )
    return active[0] ?? null
  }

  upsert(atlasId: string, input: UpsertOverrideInput): AtlasOverrideRecord {
    const existing = this.lookup(atlasId, input.entityType, input.entityKey, input.overrideType)
    if (existing && input.replaceActive !== false) {
      this.rows.set(existing.id, {
        ...existing,
        status: 'reverted',
        updatedAt: new Date().toISOString(),
      })
    }

    const now = new Date().toISOString()
    const record: AtlasOverrideRecord = {
      id: randomUUID(),
      atlasId,
      entityType: input.entityType,
      entityKey: input.entityKey,
      overrideType: input.overrideType,
      payload: input.payload,
      status: 'active',
      reviewState: input.reviewState ?? null,
      source: input.source ?? 'api',
      matchConfidence: input.matchConfidence ?? 'exact',
      sourceSignature: input.sourceSignature ?? null,
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    }
    this.rows.set(record.id, record)
    return record
  }

  revert(atlasId: string, id: string): AtlasOverrideRecord | null {
    const row = this.rows.get(id)
    if (!row || row.atlasId !== atlasId) return null
    const next = { ...row, status: 'reverted' as const, updatedAt: new Date().toISOString() }
    this.rows.set(id, next)
    return next
  }

  updateStatus(
    atlasId: string,
    id: string,
    patch: Partial<Pick<AtlasOverrideRecord, 'status' | 'matchConfidence' | 'notes'>>,
  ): AtlasOverrideRecord | null {
    const row = this.rows.get(id)
    if (!row || row.atlasId !== atlasId) return null
    const next = { ...row, ...patch, updatedAt: new Date().toISOString() }
    this.rows.set(id, next)
    return next
  }

  /** Test helper: seed a full record (including non-active). */
  seed(record: AtlasOverrideRecord): void {
    this.rows.set(record.id, record)
  }
}

export const memoryOverrideStore = new InMemoryAtlasOverrideStore()
