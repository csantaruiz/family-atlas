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
