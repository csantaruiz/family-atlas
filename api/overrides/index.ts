import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireEditAccess } from '../_lib/auth.js'
import { allowCors, handleOptions, sendError } from '../_lib/http.js'
import {
  getOverride,
  listOverrides,
  lookupOverride,
  revertOverride,
  upsertOverride,
} from '../_lib/overrides.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  allowCors(res)
  if (handleOptions(req, res)) return

  try {
    if (req.method === 'GET') {
      const id = typeof req.query.id === 'string' ? req.query.id : ''
      const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : undefined
      const entityKey = typeof req.query.entityKey === 'string' ? req.query.entityKey : undefined
      const overrideType =
        typeof req.query.overrideType === 'string' ? req.query.overrideType : undefined
      const status = typeof req.query.status === 'string' ? req.query.status : undefined
      const lookup = req.query.lookup === '1' || req.query.lookup === 'true'

      if (id) {
        const record = await getOverride(id)
        if (!record) {
          sendError(res, 404, 'Override not found')
          return
        }
        res.status(200).json({ override: record })
        return
      }

      if (lookup && entityType && entityKey) {
        const record = await lookupOverride({ entityType, entityKey, overrideType })
        res.status(200).json({ override: record })
        return
      }

      const result = await listOverrides({ status, entityType })
      res.status(200).json(result)
      return
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      if (!requireEditAccess(req, res)) return
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
      const entityType = typeof body.entityType === 'string' ? body.entityType : ''
      const entityKey = typeof body.entityKey === 'string' ? body.entityKey : ''
      const overrideType = typeof body.overrideType === 'string' ? body.overrideType : ''
      const payload =
        body.payload && typeof body.payload === 'object'
          ? (body.payload as Record<string, unknown>)
          : null

      if (!entityType || !entityKey || !overrideType || !payload) {
        sendError(res, 400, 'entityType, entityKey, overrideType, and payload are required')
        return
      }

      const record = await upsertOverride({
        entityType,
        entityKey,
        overrideType,
        payload,
        source: typeof body.source === 'string' ? body.source : 'api',
        matchConfidence:
          typeof body.matchConfidence === 'string' ? body.matchConfidence : 'exact',
        sourceSignature:
          typeof body.sourceSignature === 'string' || body.sourceSignature === null
            ? body.sourceSignature
            : null,
        notes: typeof body.notes === 'string' ? body.notes : null,
        createdBy: typeof body.createdBy === 'string' ? body.createdBy : null,
        reviewState: typeof body.reviewState === 'string' ? body.reviewState : null,
      })
      res.status(200).json({ override: record })
      return
    }

    if (req.method === 'DELETE') {
      if (!requireEditAccess(req, res)) return
      const id = typeof req.query.id === 'string' ? req.query.id : ''
      if (!id) {
        sendError(res, 400, 'id is required')
        return
      }
      const record = await revertOverride(id)
      if (!record) {
        sendError(res, 404, 'Active override not found')
        return
      }
      res.status(200).json({ override: record })
      return
    }

    sendError(res, 405, 'Method not allowed')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Override API error'
    sendError(res, 500, message)
  }
}
