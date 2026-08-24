#!/usr/bin/env node
/**
 * Phase 2D.3A: seed Atlas-owned people from the live familyDatabase
 * and backfill media_assets.atlas_person_id. Idempotent. Never deletes.
 *
 *   npm run db:seed-people
 */
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '../..')
const SEED_IMPORT_ID = 'seed'
const ATLAS_ID = '8f3a2c1e-9b4d-4e6f-a1c2-d3e4f5a6b7c8'

function loadEnvLocal() {
  const path = join(root, '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function loadFamilyDatabase() {
  const text = readFileSync(join(root, 'src/data/familyDatabase.ts'), 'utf8')
  const marker = text.indexOf('export const familyDatabase')
  const start = text.indexOf('{', marker)
  const end = text.lastIndexOf('}')
  if (marker < 0 || start < 0 || end <= start) throw new Error('Could not parse familyDatabase.ts')
  return JSON.parse(text.slice(start, end + 1))
}

loadEnvLocal()
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is missing.')
  process.exit(1)
}

const sql = neon(databaseUrl)
const atlasId = process.env.ATLAS_ID?.trim() || ATLAS_ID
const family = loadFamilyDatabase()
const people = family.people
const rootGedcomId = family.root

await sql.query(
  `INSERT INTO atlases (id, slug, name)
   VALUES ($1, 'santa-ruiz', 'Santa Ruiz Family Atlas')
   ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name`,
  [atlasId],
)

let createdPeople = 0
let reusedPeople = 0

for (const person of people) {
  const existing = await sql.query(
    `SELECT atlas_person_id
     FROM atlas_person_aliases
     WHERE atlas_id = $1 AND import_id = $2 AND source_person_id = $3
     LIMIT 1`,
    [atlasId, SEED_IMPORT_ID, person.id],
  )
  if (existing.length) {
    reusedPeople += 1
    await sql.query(
      `UPDATE atlas_people
       SET display_name = $2, birth_year = $3, death_year = $4, updated_at = now()
       WHERE id = $1`,
      [existing[0].atlas_person_id, person.name, person.birthYear ?? null, person.deathYear ?? null],
    )
    continue
  }

  const personId = randomUUID()
  try {
    await sql.query(
      `INSERT INTO atlas_people (
         id, atlas_id, status, display_name, birth_year, death_year, current_source_person_id
       ) VALUES ($1, $2, 'active', $3, $4, $5, $6)`,
      [personId, atlasId, person.name, person.birthYear ?? null, person.deathYear ?? null, person.id],
    )
  } catch (error) {
    const conflict = await sql.query(
      `SELECT id FROM atlas_people
       WHERE atlas_id = $1 AND current_source_person_id = $2
       LIMIT 1`,
      [atlasId, person.id],
    )
    if (!conflict.length) throw error
    await sql.query(
      `INSERT INTO atlas_person_aliases (
         atlas_person_id, atlas_id, import_id, source_type, source_person_id, match_kind
       ) VALUES ($1, $2, $3, 'gedcom', $4, 'seeded')
       ON CONFLICT (atlas_id, import_id, source_person_id) DO NOTHING`,
      [conflict[0].id, atlasId, SEED_IMPORT_ID, person.id],
    )
    reusedPeople += 1
    continue
  }

  await sql.query(
    `INSERT INTO atlas_person_aliases (
       atlas_person_id, atlas_id, import_id, source_type, source_person_id, match_kind
     ) VALUES ($1, $2, $3, 'gedcom', $4, 'seeded')
     ON CONFLICT (atlas_id, import_id, source_person_id) DO NOTHING`,
    [personId, atlasId, SEED_IMPORT_ID, person.id],
  )
  createdPeople += 1
}

const rootRows = await sql.query(
  `SELECT atlas_person_id FROM atlas_person_aliases
   WHERE atlas_id = $1 AND import_id = $2 AND source_person_id = $3
   LIMIT 1`,
  [atlasId, SEED_IMPORT_ID, rootGedcomId],
)
const rootAtlasPersonId = rootRows[0]?.atlas_person_id ?? null
if (rootAtlasPersonId) {
  await sql.query(`UPDATE atlases SET root_person_id = $2 WHERE id = $1`, [
    atlasId,
    rootAtlasPersonId,
  ])
}

const mediaUpdate = await sql.query(
  `UPDATE media_assets AS media
   SET atlas_person_id = alias.atlas_person_id
   FROM atlas_person_aliases AS alias
   WHERE media.atlas_id = alias.atlas_id
     AND media.person_id = alias.source_person_id
     AND alias.import_id = $2
     AND media.atlas_id = $1
     AND media.atlas_person_id IS NULL
   RETURNING media.id`,
  [atlasId, SEED_IMPORT_ID],
)

const peopleCount = await sql.query(
  `SELECT count(*)::int AS n FROM atlas_people WHERE atlas_id = $1`,
  [atlasId],
)
const aliasCount = await sql.query(
  `SELECT count(*)::int AS n FROM atlas_person_aliases WHERE atlas_id = $1 AND import_id = $2`,
  [atlasId, SEED_IMPORT_ID],
)
const duplicateAliases = await sql.query(
  `SELECT source_person_id, count(*)::int AS n
   FROM atlas_person_aliases
   WHERE atlas_id = $1 AND import_id = $2
   GROUP BY source_person_id
   HAVING count(*) > 1`,
  [atlasId, SEED_IMPORT_ID],
)
const seededIds = await sql.query(
  `SELECT source_person_id FROM atlas_person_aliases WHERE atlas_id = $1 AND import_id = $2`,
  [atlasId, SEED_IMPORT_ID],
)
const seededSet = new Set(seededIds.map((row) => row.source_person_id))
const failedToSeed = people.map((person) => person.id).filter((id) => !seededSet.has(id))
const extraPeople = await sql.query(
  `SELECT current_source_person_id
   FROM atlas_people
   WHERE atlas_id = $1
     AND current_source_person_id IS NOT NULL
     AND current_source_person_id <> ALL($2::text[])`,
  [atlasId, people.map((person) => person.id)],
)
const mediaTotal = await sql.query(
  `SELECT count(*)::int AS n FROM media_assets WHERE atlas_id = $1`,
  [atlasId],
)
const mediaMapped = await sql.query(
  `SELECT count(*)::int AS n FROM media_assets WHERE atlas_id = $1 AND atlas_person_id IS NOT NULL`,
  [atlasId],
)
const mediaUnmatched = await sql.query(
  `SELECT id, person_id FROM media_assets WHERE atlas_id = $1 AND atlas_person_id IS NULL`,
  [atlasId],
)
const atlasRoot = await sql.query(`SELECT root_person_id FROM atlases WHERE id = $1`, [atlasId])

const report = {
  familyPersonCount: people.length,
  atlasPersonCount: peopleCount[0].n,
  aliasCount: aliasCount[0].n,
  createdPeople,
  reusedPeople,
  duplicateAliases: duplicateAliases.map((row) => row.source_person_id),
  failedToSeed,
  extraAtlasPeople: extraPeople.map((row) => row.current_source_person_id),
  mediaTotal: mediaTotal[0].n,
  mediaBackfilledThisRun: mediaUpdate.length,
  mediaMapped: mediaMapped[0].n,
  mediaUnmatched: mediaUnmatched.map((row) => ({ id: row.id, personId: row.person_id })),
  rootGedcomId: rootGedcomId,
  rootAtlasPersonId,
  atlasRootPersonId: atlasRoot[0]?.root_person_id ?? null,
  cleanOneToOne:
    people.length === peopleCount[0].n &&
    people.length === aliasCount[0].n &&
    failedToSeed.length === 0 &&
    duplicateAliases.length === 0 &&
    extraPeople.length === 0 &&
    Boolean(rootAtlasPersonId),
}

console.log(JSON.stringify(report, null, 2))
if (!report.cleanOneToOne) {
  console.error('Seed verification failed: mapping is not a clean 1:1.')
  process.exit(1)
}
console.log('2D.3A seed complete. 1:1 mapping verified.')
