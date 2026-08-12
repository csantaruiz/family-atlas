import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  clearEditCookie,
  isValidEditToken,
  makeEditToken,
  readEditCookie,
  setEditCookie,
} from '../_lib/auth.js'
import { allowCors, handleOptions, sendError } from '../_lib/http.js'

function readJsonBody(req: VercelRequest): Record<string, unknown> {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  if (typeof req.body === 'object') return req.body as Record<string, unknown>
  return {}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  allowCors(res)
  if (handleOptions(req, res)) return

  try {
    if (req.method === 'GET') {
      const editing = isValidEditToken(readEditCookie(req))
      res.status(200).json({ editing })
      return
    }

    if (req.method === 'POST') {
      const body = readJsonBody(req)
      const action = body.action === 'logout' ? 'logout' : 'unlock'

      if (action === 'logout') {
        clearEditCookie(res)
        res.status(200).json({ editing: false })
        return
      }

      const secret = typeof body.secret === 'string' ? body.secret.trim() : ''
      const expected = (process.env.ATLAS_EDIT_SECRET ?? '').trim()

      if (!expected) {
        sendError(
          res,
          500,
          'Server missing ATLAS_EDIT_SECRET. Ensure it is in .env.local and restart npx vercel dev.',
        )
        return
      }

      if (!secret || secret !== expected) {
        sendError(res, 401, 'Invalid edit secret')
        return
      }

      setEditCookie(res, makeEditToken())
      res.status(200).json({ editing: true })
      return
    }

    sendError(res, 405, 'Method not allowed')
  } catch (error) {
    console.error(error)
    sendError(res, 500, error instanceof Error ? error.message : 'Auth error')
  }
}
