import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import { loadLocalEnv } from './loadEnv.js'

loadLocalEnv()

let cached: NeonQueryFunction<false, false> | null = null

export function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not configured')
  }
  if (!cached) cached = neon(url)
  return cached
}

export function requireAtlasId(): string {
  const id = process.env.ATLAS_ID?.trim()
  if (!id) {
    throw new Error('ATLAS_ID is not configured')
  }
  return id
}
