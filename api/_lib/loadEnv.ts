import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

let loaded = false

function applyEnvFile(path: string, options?: { preferLocal?: boolean }): void {
  if (!existsSync(path)) return
  const text = readFileSync(path, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const eq = trimmed.indexOf('=')
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!value || value === '[SENSITIVE]') continue
    if (key === 'BLOB_READ_WRITE_TOKEN' && !value.startsWith('vercel_blob_rw_')) continue
    const current = process.env[key]
    const preferLocalKey =
      options?.preferLocal === true &&
      (key === 'BLOB_READ_WRITE_TOKEN' || key === 'BLOB_STORE_ID')
    const shouldOverride =
      preferLocalKey ||
      current === undefined ||
      current === '' ||
      current === '[SENSITIVE]' ||
      key === 'ATLAS_EDIT_SECRET' ||
      key === 'ATLAS_ID'
    if (shouldOverride) {
      process.env[key] = value
    }
  }
}

/** Load .env.local into process.env for local Vite/`vercel dev`. Production uses dashboard env. */
export function loadLocalEnv(): void {
  if (loaded) return
  loaded = true
  try {
    const cwd = process.cwd()
    applyEnvFile(join(cwd, '.env'))
    // Local Blob creds from `vercel env pull` must win over masked `vercel env run` values.
    applyEnvFile(join(cwd, '.env.local'), { preferLocal: true })
  } catch {
    // Serverless has no local env files; Vercel dashboard env is the source of truth.
  }
}
