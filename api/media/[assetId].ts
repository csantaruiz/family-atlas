import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireEditAccess } from '../_lib/auth'
import { deletePrivateMedia, readPrivateMediaByUrl } from '../_lib/blob'
import { getSql, requireAtlasId } from '../_lib/db'
import { allowCors, handleOptions, sendError } from '../_lib/http'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  allowCors(res)
  if (handleOptions(req, res)) return

  try {
    const sql = getSql()
    const atlasId = requireAtlasId()
    const assetId = typeof req.query.assetId === 'string' ? req.query.assetId : ''

    if (!assetId) {
      sendError(res, 400, 'assetId is required')
      return
    }

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT blob_url, content_type
        FROM media_assets
        WHERE id = ${assetId} AND atlas_id = ${atlasId}
        LIMIT 1
      `
      if (!rows.length) {
        sendError(res, 404, 'Media not found')
        return
      }

      const row = rows[0] as { blob_url: string; content_type: string }
      const { body, contentType } = await readPrivateMediaByUrl(row.blob_url)
      res.setHeader('Content-Type', contentType || row.content_type || 'application/octet-stream')
      res.setHeader('Cache-Control', 'private, max-age=3600')
      res.status(200).send(Buffer.from(body))
      return
    }

    if (req.method === 'DELETE') {
      if (!requireEditAccess(req, res)) return

      const rows = await sql`
        SELECT id, blob_url
        FROM media_assets
        WHERE id = ${assetId} AND atlas_id = ${atlasId}
        LIMIT 1
      `
      if (!rows.length) {
        sendError(res, 404, 'Media not found')
        return
      }

      const row = rows[0] as { id: string; blob_url: string }
      try {
        await deletePrivateMedia(row.blob_url)
      } catch (error) {
        console.warn('Blob delete failed', error)
      }
      await sql`DELETE FROM media_assets WHERE id = ${row.id}`
      res.status(200).json({ ok: true })
      return
    }

    sendError(res, 405, 'Method not allowed')
  } catch (error) {
    console.error(error)
    sendError(res, 500, error instanceof Error ? error.message : 'Media error')
  }
}
