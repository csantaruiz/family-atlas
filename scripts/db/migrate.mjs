#!/usr/bin/env node
/**
 * Apply schema (+ optional seed) against DATABASE_URL from .env.local / process env.
 *
 * Usage:
 *   npm run db:migrate
 *   npm run db:seed
 */
import { readFileSync, existsSync, appendFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '../..')
const ATLAS_ID = '8f3a2c1e-9b4d-4e6f-a1c2-d3e4f5a6b7c8'

function loadEnvLocal() {
  const path = join(root, '.env.local')
  if (!existsSync(path)) return
  const text = readFileSync(path, 'utf8')
  for (const line of text.split('\n')) {
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

loadEnvLocal()

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is missing. Pull or set .env.local first.')
  process.exit(1)
}

const sql = neon(databaseUrl)
const mode = process.argv[2] === 'seed' ? 'seed' : 'migrate'

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS atlases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  `CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atlas_id UUID NOT NULL REFERENCES atlases (id) ON DELETE CASCADE,
  person_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('portrait', 'photo', 'document')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  blob_pathname TEXT NOT NULL UNIQUE,
  blob_url TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER,
  width INTEGER,
  height INTEGER,
  original_filename TEXT,
  caption TEXT,
  credit TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  `CREATE INDEX IF NOT EXISTS media_assets_atlas_person_idx
  ON media_assets (atlas_id, person_id)`,
  `CREATE INDEX IF NOT EXISTS media_assets_atlas_kind_idx
  ON media_assets (atlas_id, kind)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS media_assets_one_primary_portrait
  ON media_assets (atlas_id, person_id)
  WHERE kind = 'portrait' AND is_primary = true`,
  `CREATE TABLE IF NOT EXISTS atlas_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atlas_id UUID NOT NULL REFERENCES atlases (id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('place', 'event', 'diagnostic', 'person')),
  entity_key TEXT NOT NULL,
  override_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'reverted', 'orphaned', 'needs_review')),
  review_state TEXT
    CHECK (review_state IS NULL OR review_state IN ('unresolved', 'confirmed', 'corrected', 'ignored')),
  source TEXT NOT NULL DEFAULT 'api',
  match_confidence TEXT NOT NULL DEFAULT 'exact'
    CHECK (match_confidence IN ('exact', 'probable', 'ambiguous')),
  source_signature TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  `CREATE INDEX IF NOT EXISTS atlas_overrides_atlas_entity_idx
  ON atlas_overrides (atlas_id, entity_type, entity_key)`,
  `CREATE INDEX IF NOT EXISTS atlas_overrides_atlas_status_idx
  ON atlas_overrides (atlas_id, status)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS atlas_overrides_one_active
  ON atlas_overrides (atlas_id, entity_type, entity_key, override_type)
  WHERE status = 'active'`,
  `ALTER TABLE atlas_overrides DROP CONSTRAINT IF EXISTS atlas_overrides_entity_type_check`,
  `ALTER TABLE atlas_overrides ADD CONSTRAINT atlas_overrides_entity_type_check
  CHECK (entity_type IN ('place', 'event', 'diagnostic', 'person'))`,
  `CREATE TABLE IF NOT EXISTS atlas_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atlas_id UUID NOT NULL REFERENCES atlases (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'source_removed', 'needs_review')),
  display_name TEXT,
  birth_year INTEGER,
  death_year INTEGER,
  current_source_person_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  `CREATE INDEX IF NOT EXISTS atlas_people_atlas_idx
  ON atlas_people (atlas_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS atlas_people_one_current_source
  ON atlas_people (atlas_id, current_source_person_id)
  WHERE current_source_person_id IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS atlas_person_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atlas_person_id UUID NOT NULL REFERENCES atlas_people (id) ON DELETE CASCADE,
  atlas_id UUID NOT NULL REFERENCES atlases (id) ON DELETE CASCADE,
  import_id TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'gedcom',
  source_person_id TEXT NOT NULL,
  match_kind TEXT NOT NULL DEFAULT 'seeded'
    CHECK (match_kind IN ('exact', 'strong_match', 'seeded', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS atlas_person_aliases_one_source
  ON atlas_person_aliases (atlas_id, import_id, source_person_id)`,
  `CREATE INDEX IF NOT EXISTS atlas_person_aliases_person_idx
  ON atlas_person_aliases (atlas_person_id)`,
  `ALTER TABLE atlases
  ADD COLUMN IF NOT EXISTS root_person_id UUID REFERENCES atlas_people (id)`,
  `ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS atlas_person_id UUID REFERENCES atlas_people (id)`,
  `CREATE INDEX IF NOT EXISTS media_assets_atlas_person_uuid_idx
  ON media_assets (atlas_id, atlas_person_id)`,
  `CREATE TABLE IF NOT EXISTS gedcom_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atlas_id UUID NOT NULL REFERENCES atlases (id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  checksum TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  gedcom_pathname TEXT NOT NULL,
  snapshot_pathname TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'processing', 'ready', 'failed')),
  person_count INTEGER,
  family_count INTEGER,
  error_code TEXT,
  error_message TEXT,
  diff_summary JSONB,
  reconciliation_summary JSONB,
  blockers JSONB,
  diff_json JSONB,
  reconciliation_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
)`,
  `CREATE INDEX IF NOT EXISTS gedcom_imports_atlas_status_idx
  ON gedcom_imports (atlas_id, status, created_at DESC)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS gedcom_imports_atlas_checksum_open
  ON gedcom_imports (atlas_id, checksum)
  WHERE status IN ('uploaded', 'processing', 'ready')`,
  `ALTER TABLE atlases ADD COLUMN IF NOT EXISTS active_import_id UUID REFERENCES gedcom_imports (id)`,
  `ALTER TABLE gedcom_imports ADD COLUMN IF NOT EXISTS activated_snapshot_pathname TEXT`,
  `ALTER TABLE gedcom_imports ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ`,
  `ALTER TABLE gedcom_imports DROP CONSTRAINT IF EXISTS gedcom_imports_status_check`,
  `ALTER TABLE gedcom_imports ADD CONSTRAINT gedcom_imports_status_check CHECK (status IN ('uploaded', 'processing', 'ready', 'failed', 'active', 'superseded'))`,
]

const SEED_STATEMENTS = [
  `INSERT INTO atlases (id, slug, name)
VALUES (
  '${ATLAS_ID}',
  'santa-ruiz',
  'Santa Ruiz Family Atlas'
)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name`,
]

const statements = mode === 'seed' ? SEED_STATEMENTS : SCHEMA_STATEMENTS

for (const statement of statements) {
  await sql.query(statement, [])
}

if (mode !== 'seed') {
  await sql.query(`ALTER TABLE atlases ADD COLUMN IF NOT EXISTS active_import_id UUID REFERENCES gedcom_imports (id)`, [])
  await sql.query(`ALTER TABLE gedcom_imports ADD COLUMN IF NOT EXISTS activated_snapshot_pathname TEXT`, [])
  await sql.query(`ALTER TABLE gedcom_imports ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ`, [])
  await sql.query(`ALTER TABLE gedcom_imports DROP CONSTRAINT IF EXISTS gedcom_imports_status_check`, [])
  await sql.query(`ALTER TABLE gedcom_imports ADD CONSTRAINT gedcom_imports_status_check CHECK (status IN ('uploaded', 'processing', 'ready', 'failed', 'active', 'superseded'))`, [])
  await sql.query(`CREATE OR REPLACE FUNCTION apply_gedcom_activation(p_atlas_id UUID, p_import_id UUID, p_payload JSONB) RETURNS JSONB LANGUAGE plpgsql AS $fn$
DECLARE
  prev_id UUID;
  op JSONB;
  rewrite JSONB;
BEGIN
  PERFORM 1 FROM atlases WHERE id = p_atlas_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'atlas_not_found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM gedcom_imports WHERE id = p_import_id AND atlas_id = p_atlas_id AND status = 'ready'
  ) THEN RAISE EXCEPTION 'import_not_ready'; END IF;
  SELECT active_import_id INTO prev_id FROM atlases WHERE id = p_atlas_id;
  UPDATE atlas_people SET current_source_person_id = NULL
  WHERE atlas_id = p_atlas_id
    AND id IN (
      SELECT (elem->>'atlasPersonId')::uuid FROM jsonb_array_elements(p_payload->'ops') AS elem
      WHERE elem->>'action' IN ('reuse_exact', 'reuse_strong', 'source_removed')
    );
  FOR op IN SELECT * FROM jsonb_array_elements(p_payload->'ops') LOOP
    IF op->>'action' = 'create' THEN
      INSERT INTO atlas_people (id, atlas_id, status, display_name, birth_year, death_year, current_source_person_id, updated_at)
      VALUES ((op->>'atlasPersonId')::uuid, p_atlas_id, 'active', op->>'displayName', NULLIF(op->>'birthYear','')::integer, NULLIF(op->>'deathYear','')::integer, op->>'candidateGedcomId');
    ELSIF op->>'action' = 'source_removed' THEN
      UPDATE atlas_people SET status = 'source_removed', updated_at = now()
      WHERE id = (op->>'atlasPersonId')::uuid AND atlas_id = p_atlas_id;
    ELSE
      UPDATE atlas_people SET status = 'active', display_name = op->>'displayName',
        birth_year = NULLIF(op->>'birthYear','')::integer, death_year = NULLIF(op->>'deathYear','')::integer,
        current_source_person_id = op->>'candidateGedcomId', updated_at = now()
      WHERE id = (op->>'atlasPersonId')::uuid AND atlas_id = p_atlas_id;
    END IF;
    IF op->>'candidateGedcomId' IS NOT NULL THEN
      INSERT INTO atlas_person_aliases (atlas_person_id, atlas_id, import_id, source_type, source_person_id, match_kind)
      VALUES ((op->>'atlasPersonId')::uuid, p_atlas_id, p_import_id::text, 'gedcom', op->>'candidateGedcomId', COALESCE(op->>'matchKind','seeded'))
      ON CONFLICT (atlas_id, import_id, source_person_id) DO NOTHING;
    END IF;
  END LOOP;
  FOR rewrite IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'eventRewrites', '[]'::jsonb)) LOOP
    IF COALESCE((rewrite->>'keep')::boolean, false) THEN
      UPDATE atlas_overrides SET entity_key = rewrite->>'toKey', updated_at = now()
      WHERE id = (rewrite->>'id')::uuid AND atlas_id = p_atlas_id;
    ELSE
      UPDATE atlas_overrides SET status = 'orphaned', updated_at = now()
      WHERE id = (rewrite->>'id')::uuid AND atlas_id = p_atlas_id;
    END IF;
  END LOOP;
  FOR rewrite IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'personRewrites', '[]'::jsonb)) LOOP
    IF COALESCE((rewrite->>'keep')::boolean, false) THEN
      UPDATE atlas_overrides SET entity_key = rewrite->>'toKey', updated_at = now()
      WHERE id = (rewrite->>'id')::uuid AND atlas_id = p_atlas_id;
    ELSE
      UPDATE atlas_overrides SET status = 'orphaned', updated_at = now()
      WHERE id = (rewrite->>'id')::uuid AND atlas_id = p_atlas_id;
    END IF;
  END LOOP;
  UPDATE media_assets m
  SET atlas_person_id = p.id
  FROM atlas_people p
  WHERE m.atlas_id = p_atlas_id
    AND p.atlas_id = p_atlas_id
    AND (
      m.person_id = p.current_source_person_id
      OR m.person_id IN (
        SELECT a.source_person_id FROM atlas_person_aliases a
        WHERE a.atlas_id = p_atlas_id AND a.atlas_person_id = p.id
      )
      OR m.atlas_person_id = p.id
    );
  IF prev_id IS NOT NULL THEN
    UPDATE gedcom_imports SET status = 'superseded' WHERE id = prev_id AND atlas_id = p_atlas_id;
  END IF;
  UPDATE gedcom_imports SET status = 'active', activated_snapshot_pathname = p_payload->>'activatedSnapshotPath', activated_at = now()
  WHERE id = p_import_id AND atlas_id = p_atlas_id;
  UPDATE atlases SET active_import_id = p_import_id, root_person_id = NULLIF(p_payload->>'rootAtlasPersonId','')::uuid
  WHERE id = p_atlas_id;
  RETURN jsonb_build_object('ok', true, 'previousImportId', prev_id, 'activeImportId', p_import_id);
END;
$fn$`, [])
}


if (mode === 'seed') {
  const envPath = join(root, '.env.local')
  if (existsSync(envPath)) {
    const current = readFileSync(envPath, 'utf8')
    if (!/^ATLAS_ID=/m.test(current)) {
      appendFileSync(envPath, `\nATLAS_ID=${ATLAS_ID}\nATLAS_SLUG=santa-ruiz\n`)
      console.log('Appended ATLAS_ID and ATLAS_SLUG to .env.local')
    }
  }
  console.log('Seed complete.')
  console.log(`ATLAS_ID=${ATLAS_ID}`)
  console.log('Also add ATLAS_ID to Vercel → Environment Variables (Production/Preview/Development).')
} else {
  console.log('Schema migration complete.')
}
