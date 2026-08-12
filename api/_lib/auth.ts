import { createHmac, timingSafeEqual } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { loadLocalEnv } from './loadEnv'

loadLocalEnv()

export const EDIT_COOKIE = 'atlas_edit'

function editSecret(): string {
  const secret = process.env.ATLAS_EDIT_SECRET
  if (!secret) throw new Error('ATLAS_EDIT_SECRET is not configured')
  return secret
}

export function makeEditToken(): string {
  return createHmac('sha256', editSecret()).update('atlas-edit-v1').digest('hex')
}

export function isValidEditToken(token: string | undefined): boolean {
  if (!token) return false
  try {
    const expected = makeEditToken()
    const a = Buffer.from(token)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function parseCookies(header: string | string[] | undefined): Record<string, string> {
  const raw = Array.isArray(header) ? header.join(';') : (header ?? '')
  const out: Record<string, string> = {}
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=')
    if (idx <= 0) continue
    const key = part.slice(0, idx).trim()
    const value = decodeURIComponent(part.slice(idx + 1).trim())
    out[key] = value
  }
  return out
}

export function readEditCookie(req: VercelRequest): string | undefined {
  return parseCookies(req.headers.cookie)[EDIT_COOKIE]
}

export function requireEditAccess(req: VercelRequest, res: VercelResponse): boolean {
  if (isValidEditToken(readEditCookie(req))) return true
  res.status(401).json({ error: 'Edit unlock required' })
  return false
}

export function setEditCookie(res: VercelResponse, token: string): void {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
  const parts = [
    `${EDIT_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${60 * 60 * 24 * 30}`,
  ]
  if (secure) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

export function clearEditCookie(res: VercelResponse): void {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
  const parts = [`${EDIT_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (secure) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}
