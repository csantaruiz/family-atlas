import type { AtlasOverrideRecord, UpsertOverrideInput } from './types'
import { memoryOverrideStore } from './memoryStore'

/**
 * Sync override cache for Map/Journey/resolveCanonicalPlaceSync.
 * Populated from API (or memory store in tests). No override → empty → prior behavior.
 */

let atlasIdCache: string = 'default'
let loaded = false
let loadPromise: Promise<void> | null = null

export function getOverrideAtlasId(): string {
  return atlasIdCache
}

export function setOverrideAtlasId(atlasId: string): void {
  atlasIdCache = atlasId
}

export function invalidateOverrideCache(): void {
  loaded = false
  loadPromise = null
}

export function listCachedOverrides(filter?: {
  entityType?: string
  status?: string
}): AtlasOverrideRecord[] {
  return memoryOverrideStore.list(atlasIdCache, filter)
}

export function getCachedPlaceOverride(fingerprint: string): AtlasOverrideRecord | null {
  const placeTypes = ['confirm_resolution', 'set_coordinates', 'set_label'] as const
  for (const overrideType of placeTypes) {
    const hit = memoryOverrideStore.lookup(atlasIdCache, 'place', fingerprint, overrideType)
    if (hit) return hit
  }
  return null
}

export function getCachedEventOverrides(entityKey: string): AtlasOverrideRecord[] {
  return memoryOverrideStore
    .list(atlasIdCache, { status: 'active', entityType: 'event' })
    .filter((row) => row.entityKey === entityKey)
}

export function getCachedDiagnostic(
  entityKey: string,
): AtlasOverrideRecord | null {
  return memoryOverrideStore.lookup(atlasIdCache, 'diagnostic', entityKey, 'disposition')
}

export function getCachedPersonDateOverride(
  entityKey: string,
  overrideType?: 'confirm_date' | 'set_date',
): AtlasOverrideRecord | null {
  if (overrideType) {
    return memoryOverrideStore.lookup(atlasIdCache, 'person', entityKey, overrideType)
  }
  return (
    memoryOverrideStore.lookup(atlasIdCache, 'person', entityKey, 'set_date') ??
    memoryOverrideStore.lookup(atlasIdCache, 'person', entityKey, 'confirm_date')
  )
}

export function getCachedPersonNameOverride(
  entityKey: string,
  overrideType?: 'confirm_name' | 'set_name',
): AtlasOverrideRecord | null {
  if (overrideType) {
    return memoryOverrideStore.lookup(atlasIdCache, 'person', entityKey, overrideType)
  }
  return (
    memoryOverrideStore.lookup(atlasIdCache, 'person', entityKey, 'set_name') ??
    memoryOverrideStore.lookup(atlasIdCache, 'person', entityKey, 'confirm_name')
  )
}

const cacheListeners = new Set<() => void>()

export function subscribeOverrideCache(listener: () => void): () => void {
  cacheListeners.add(listener)
  return () => cacheListeners.delete(listener)
}

function notifyOverrideCache() {
  for (const listener of cacheListeners) listener()
}

/** Seed cache from records (API response or tests). Replaces atlas rows in memory store. */
export function hydrateOverrideCache(atlasId: string, records: AtlasOverrideRecord[]): void {
  atlasIdCache = atlasId
  memoryOverrideStore.clearAtlas(atlasId)
  for (const record of records) {
    memoryOverrideStore.seed(record)
  }
  loaded = true
  notifyOverrideCache()
}

export function cacheUpsert(input: UpsertOverrideInput): AtlasOverrideRecord {
  const record = memoryOverrideStore.upsert(atlasIdCache, input)
  loaded = true
  notifyOverrideCache()
  return record
}

/** Insert/replace a full server record in the sync cache (authoritative after PUT). */
export function cacheSeedRecord(record: AtlasOverrideRecord): void {
  atlasIdCache = record.atlasId || atlasIdCache
  memoryOverrideStore.seed(record)
  loaded = true
  notifyOverrideCache()
}

export function cacheRevert(id: string): AtlasOverrideRecord | null {
  const record = memoryOverrideStore.revert(atlasIdCache, id)
  if (record) notifyOverrideCache()
  return record
}

export function isOverrideCacheLoaded(): boolean {
  return loaded
}

/**
 * Load overrides from /api/overrides when available.
 * Failures leave cache empty (automated behavior unchanged).
 */
export async function ensureOverrideCacheLoaded(): Promise<void> {
  if (loaded) return
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    try {
      const res = await fetch('/api/overrides?status=active', { credentials: 'include' })
      if (!res.ok) {
        loaded = true
        return
      }
      const data = (await res.json()) as {
        atlasId?: string
        overrides?: AtlasOverrideRecord[]
      }
      if (data.atlasId && Array.isArray(data.overrides)) {
        hydrateOverrideCache(data.atlasId, data.overrides)
      } else {
        loaded = true
      }
    } catch {
      loaded = true
    }
  })()

  return loadPromise
}
