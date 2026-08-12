import { randomUUID } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireEditAccess } from '../_lib/auth'
import { deletePrivateMedia, mediaPathname, putPrivateMedia } from '../_lib/blob'
import { getSql, requireAtlasId } from '../_lib/db'
import { allowCors, handleOptions, sendError } from '../_lib/http'

type MediaKind = 'portrait' | 'photo' | 'document'

function personImageFromAsset(row: {
  id: string
  person_id: string
  caption: string | null
  credit: string | null
}): {
  assetId: string
  personId: string
  src: string
  alt: string
  caption: string
  credit: string
  isUserUpload: true
  isPlaceholder: false
} {
  return {
    assetId: row.id,
    personId: row.person_id,
    src: `/api/media/${row.id}`,
    alt: 'Family portrait',
    caption: row.caption || 'Family photograph',
    credit: row.credit || 'Saved to this Atlas',
    isUserUpload: true,
    isPlaceholder: false,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  allowCors(res)
  if (handleOptions(req, res)) return

  try {
    const sql = getSql()
    const atlasId = requireAtlasId()

    if (req.method === 'GET') {
      const personId = typeof req.query.personId === 'string' ? req.query.personId : ''
      if (!personId) {
        sendError(res, 400, 'personId is required')
        return
      }

      const rows = await sql`
        SELECT id, person_id, caption, credit
        FROM media_assets
        WHERE atlas_id = ${atlasId}
          AND person_id = ${personId}
          AND kind = 'portrait'
          AND is_primary = true
        LIMIT 1
      `

      if (!rows.length) {
        res.status(200).json({ portrait: null })
        return
      }

      res.status(200).json({ portrait: personImageFromAsset(rows[0] as never) })
      return
    }

    if (req.method === 'POST') {
      if (!requireEditAccess(req, res)) return

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
      const personId = typeof body.personId === 'string' ? body.personId.trim() : ''
      const personName = typeof body.personName === 'string' ? body.personName.trim() : 'Family member'
      const kind = (body.kind === 'photo' || body.kind === 'document' ? body.kind : 'portrait') as MediaKind
      const isPrimary = kind === 'portrait' ? true : Boolean(body.isPrimary)
      const dataBase64 = typeof body.dataBase64 === 'string' ? body.dataBase64 : ''
      const contentType =
        typeof body.contentType === 'string' && body.contentType.startsWith('image/')
          ? body.contentType
          : 'image/jpeg'
      const width = typeof body.width === 'number' ? body.width : null
      const height = typeof body.height === 'number' ? body.height : null
      const originalFilename =
        typeof body.originalFilename === 'string' ? body.originalFilename : 'portrait.jpg'

      if (!personId || !dataBase64) {
        sendError(res, 400, 'personId and dataBase64 are required')
        return
      }

      const buffer = Buffer.from(dataBase64, 'base64')
      if (buffer.byteLength < 32) {
        sendError(res, 400, 'Image data is empty')
        return
      }
      if (buffer.byteLength > 4_500_000) {
        sendError(res, 413, 'Image is too large')
        return
      }

      const assetId = randomUUID()
      const pathname = mediaPathname({
        atlasId,
        personId,
        assetId,
        filename: kind === 'portrait' ? 'portrait.jpg' : originalFilename,
      })

      const uploaded = await putPrivateMedia(pathname, buffer, contentType)

      // Replace prior primary portrait for this person when uploading a new primary portrait.
      if (kind === 'portrait' && isPrimary) {
        const existing = await sql`
          SELECT id, blob_url
          FROM media_assets
          WHERE atlas_id = ${atlasId}
            AND person_id = ${personId}
            AND kind = 'portrait'
            AND is_primary = true
        `
        for (const row of existing) {
          try {
            await deletePrivateMedia(String((row as { blob_url: string }).blob_url))
          } catch (error) {
            console.warn('Failed deleting prior blob', error)
          }
          await sql`DELETE FROM media_assets WHERE id = ${(row as { id: string }).id}`
        }
      }

      const caption = 'Family photograph'
      const credit = 'Saved to this Atlas'

      await sql`
        INSERT INTO media_assets (
          id, atlas_id, person_id, kind, is_primary,
          blob_pathname, blob_url, content_type, byte_size,
          width, height, original_filename, caption, credit
        ) VALUES (
          ${assetId},
          ${atlasId},
          ${personId},
          ${kind},
          ${isPrimary},
          ${uploaded.pathname},
          ${uploaded.url},
          ${contentType},
          ${buffer.byteLength},
          ${width},
          ${height},
          ${originalFilename},
          ${caption},
          ${credit}
        )
      `

      res.status(201).json({
        portrait: {
          assetId,
          personId,
          src: `/api/media/${assetId}`,
          alt: `Portrait of ${personName}`,
          caption,
          credit,
          isUserUpload: true,
          isPlaceholder: false,
        },
      })
      return
    }

    sendError(res, 405, 'Method not allowed')
  } catch (error) {
    console.error(error)
    sendError(res, 500, error instanceof Error ? error.message : 'Media error')
  }
}
