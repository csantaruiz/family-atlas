import { randomUUID } from 'node:crypto'
import { getSql, requireAtlasId } from './db.js'

export type DbOverrideRow = {
  id: string
  atlas_id: string
  entity_type: string
  entity_key: string
  override_type: string
  payload: unknown
  status: string
  review_state: string | null
  source: string
  match_confidence: string
  source_signature: string | null
  notes: string | null
  created_by: string | null
  created_at: string | Date
  updated_at: string | Date
}

export function rowToRecord(row: DbOverrideRow) {
  return {
    id: row.id,
    atlasId: row.atlas_id,
    entityType: row.entity_type,
    entityKey: row.entity_key,
    overrideType: row.override_type,
    payload: (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload) as Record<
      string,
      unknown
    >,
    status: row.status,
    reviewState: row.review_state,
    source: row.source,
    matchConfidence: row.match_confidence,
    sourceSignature: row.source_signature,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt:
      typeof row.created_at === 'string' ? row.created_at : new Date(row.created_at).toISOString(),
    updatedAt:
      typeof row.updated_at === 'string' ? row.updated_at : new Date(row.updated_at).toISOString(),
  }
}

export async function listOverrides(opts?: {
  status?: string
  entityType?: string
}): Promise<{ atlasId: string; overrides: ReturnType<typeof rowToRecord>[] }> {
  const sql = getSql()
  const atlasId = requireAtlasId()
  const status = opts?.status ?? null
  const entityType = opts?.entityType ?? null

  const rows = (await sql`
    SELECT *
    FROM atlas_overrides
    WHERE atlas_id = ${atlasId}
      AND (${status}::text IS NULL OR status = ${status})
      AND (${entityType}::text IS NULL OR entity_type = ${entityType})
    ORDER BY updated_at DESC
  `) as DbOverrideRow[]

  return { atlasId, overrides: rows.map(rowToRecord) }
}

export async function getOverride(id: string) {
  const sql = getSql()
  const atlasId = requireAtlasId()
  const rows = (await sql`
    SELECT * FROM atlas_overrides
    WHERE atlas_id = ${atlasId} AND id = ${id}
    LIMIT 1
  `) as DbOverrideRow[]
  return rows[0] ? rowToRecord(rows[0]) : null
}

export async function lookupOverride(input: {
  entityType: string
  entityKey: string
  overrideType?: string
}) {
  const sql = getSql()
  const atlasId = requireAtlasId()
  const overrideType = input.overrideType ?? null
  const rows = (await sql`
    SELECT * FROM atlas_overrides
    WHERE atlas_id = ${atlasId}
      AND entity_type = ${input.entityType}
      AND entity_key = ${input.entityKey}
      AND status = 'active'
      AND (${overrideType}::text IS NULL OR override_type = ${overrideType})
    ORDER BY updated_at DESC
    LIMIT 1
  `) as DbOverrideRow[]
  return rows[0] ? rowToRecord(rows[0]) : null
}

export async function upsertOverride(input: {
  entityType: string
  entityKey: string
  overrideType: string
  payload: Record<string, unknown>
  source?: string
  matchConfidence?: string
  sourceSignature?: string | null
  notes?: string | null
  createdBy?: string | null
  reviewState?: string | null
}) {
  const sql = getSql()
  const atlasId = requireAtlasId()

  // Soft-revert prior active row for same unique key
  await sql`
    UPDATE atlas_overrides
    SET status = 'reverted', updated_at = now()
    WHERE atlas_id = ${atlasId}
      AND entity_type = ${input.entityType}
      AND entity_key = ${input.entityKey}
      AND override_type = ${input.overrideType}
      AND status = 'active'
  `

  const id = randomUUID()
  const payloadJson = JSON.stringify(input.payload)
  const rows = (await sql`
    INSERT INTO atlas_overrides (
      id, atlas_id, entity_type, entity_key, override_type, payload,
      status, review_state, source, match_confidence, source_signature,
      notes, created_by
    ) VALUES (
      ${id},
      ${atlasId},
      ${input.entityType},
      ${input.entityKey},
      ${input.overrideType},
      ${payloadJson}::jsonb,
      'active',
      ${input.reviewState ?? null},
      ${input.source ?? 'api'},
      ${input.matchConfidence ?? 'exact'},
      ${input.sourceSignature ?? null},
      ${input.notes ?? null},
      ${input.createdBy ?? null}
    )
    RETURNING *
  `) as DbOverrideRow[]

  return rowToRecord(rows[0])
}

export async function revertOverride(id: string) {
  const sql = getSql()
  const atlasId = requireAtlasId()
  const rows = (await sql`
    UPDATE atlas_overrides
    SET status = 'reverted', updated_at = now()
    WHERE atlas_id = ${atlasId} AND id = ${id} AND status = 'active'
    RETURNING *
  `) as DbOverrideRow[]
  return rows[0] ? rowToRecord(rows[0]) : null
}

export async function updateOverrideStatus(
  id: string,
  patch: { status?: string; matchConfidence?: string; notes?: string | null },
) {
  const sql = getSql()
  const atlasId = requireAtlasId()
  const rows = (await sql`
    UPDATE atlas_overrides
    SET
      status = COALESCE(${patch.status ?? null}, status),
      match_confidence = COALESCE(${patch.matchConfidence ?? null}, match_confidence),
      notes = COALESCE(${patch.notes ?? null}, notes),
      updated_at = now()
    WHERE atlas_id = ${atlasId} AND id = ${id}
    RETURNING *
  `) as DbOverrideRow[]
  return rows[0] ? rowToRecord(rows[0]) : null
}
