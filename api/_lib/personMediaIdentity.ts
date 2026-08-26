import { getSql } from './db.js'

const ATLAS_PERSON_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type PersonMediaKeys = {
  requestedId: string
  storedPersonId: string
  atlasPersonId: string | null
  sourcePersonId: string | null
}

export function isAtlasPersonUuid(id: string): boolean {
  return ATLAS_PERSON_UUID_RE.test(id)
}

/**
 * Prefer a GEDCOM/source person_id for the unique portrait key, and the Atlas
 * UUID when identity tables can resolve it. That keeps replacements attached to
 * the stable Atlas person across GEDCOM reimports.
 */
export function chooseStoredPersonKeys(input: {
  requestedId: string
  atlasPersonId?: string | null
  currentSourcePersonId?: string | null
}): PersonMediaKeys {
  const requestedId = input.requestedId.trim()
  const atlasPersonId = input.atlasPersonId ?? null
  const currentSourcePersonId = input.currentSourcePersonId?.trim() || null
  const sourcePersonId =
    currentSourcePersonId || (isAtlasPersonUuid(requestedId) ? null : requestedId)
  const storedPersonId = sourcePersonId || requestedId
  return {
    requestedId,
    storedPersonId,
    atlasPersonId,
    sourcePersonId,
  }
}

export async function resolvePersonMediaIdentity(
  atlasId: string,
  requestedId: string,
): Promise<PersonMediaKeys> {
  const fallback = chooseStoredPersonKeys({ requestedId })
  if (!requestedId) return fallback

  try {
    const sql = getSql()
    const rows = await sql`
      SELECT p.id, p.current_source_person_id
      FROM atlas_people p
      WHERE p.atlas_id = ${atlasId}
        AND (
          p.id::text = ${requestedId}
          OR p.current_source_person_id = ${requestedId}
          OR EXISTS (
            SELECT 1
            FROM atlas_person_aliases a
            WHERE a.atlas_person_id = p.id
              AND a.atlas_id = ${atlasId}
              AND a.source_person_id = ${requestedId}
          )
        )
      LIMIT 1
    `
    const row = rows[0] as { id: string; current_source_person_id: string | null } | undefined
    if (!row) return fallback
    return chooseStoredPersonKeys({
      requestedId,
      atlasPersonId: row.id,
      currentSourcePersonId: row.current_source_person_id,
    })
  } catch {
    return fallback
  }
}
