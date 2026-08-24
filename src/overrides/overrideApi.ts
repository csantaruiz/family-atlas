import { ensureEditAccess } from '../utils/mediaApi'
import type { AtlasOverrideRecord, UpsertOverrideInput } from './types'
import {
  cacheRevert,
  cacheSeedRecord,
  cacheUpsert,
  ensureOverrideCacheLoaded,
  hydrateOverrideCache,
  invalidateOverrideCache,
  listCachedOverrides,
} from './overrideCache'

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function fetchOverrides(opts?: {
  status?: string
  entityType?: string
}): Promise<{ atlasId: string; overrides: AtlasOverrideRecord[] }> {
  const params = new URLSearchParams()
  if (opts?.status) params.set('status', opts.status)
  if (opts?.entityType) params.set('entityType', opts.entityType)
  const qs = params.toString()
  const res = await fetch(`/api/overrides${qs ? `?${qs}` : ''}`, { credentials: 'include' })
  const data = await parseJson(res)
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Could not load overrides')
  }
  const atlasId = typeof data.atlasId === 'string' ? data.atlasId : 'default'
  const overrides = Array.isArray(data.overrides) ? (data.overrides as AtlasOverrideRecord[]) : []
  hydrateOverrideCache(atlasId, overrides)
  return { atlasId, overrides }
}

export async function upsertOverrideRemote(
  input: UpsertOverrideInput,
): Promise<AtlasOverrideRecord> {
  await ensureEditAccess()
  const res = await fetch('/api/overrides', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await parseJson(res)
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        'Override API not found (404). Restart npm run dev so /api/overrides is served (Vite atlas API plugin).',
      )
    }
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : `Could not save override (${res.status})`,
    )
  }
  const record = data.override as AtlasOverrideRecord | undefined
  if (!record?.id) {
    throw new Error('Save failed — server did not return an override record.')
  }
  // Authoritative refresh; also seed this row in case list lag
  try {
    await fetchOverrides({ status: 'active' })
  } catch {
    /* fall through to seed */
  }
  cacheSeedRecord(record)
  return record
}

export async function revertOverrideRemote(id: string): Promise<AtlasOverrideRecord> {
  await ensureEditAccess()
  const res = await fetch(`/api/overrides?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  const data = await parseJson(res)
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Could not revert override')
  }
  cacheRevert(id)
  await fetchOverrides({ status: 'active' })
  return data.override as AtlasOverrideRecord
}

export {
  ensureOverrideCacheLoaded,
  listCachedOverrides,
  hydrateOverrideCache,
  invalidateOverrideCache,
  cacheUpsert,
  cacheSeedRecord,
}
