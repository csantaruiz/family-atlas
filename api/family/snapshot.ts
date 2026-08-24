import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readPrivateMedia } from '../_lib/blob.js'
import { getSql, requireAtlasId } from '../_lib/db.js'
import { allowCors, handleOptions, sendError } from '../_lib/http.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  allowCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'GET') {
    sendError(res, 405, 'Method not allowed')
    return
  }
  try {
    const sql = getSql()
    const atlasId = requireAtlasId()
    const atlasRows = await sql`
      SELECT active_import_id FROM atlases WHERE id = ${atlasId} LIMIT 1
    `
    const activeImportId = (atlasRows[0] as { active_import_id: string | null } | undefined)?.active_import_id
    if (!activeImportId) {
      res.status(200).json({ source: 'seed', importId: null, database: null, marriages: null })
      return
    }
    const imports = await sql`
      SELECT activated_snapshot_pathname, snapshot_pathname
      FROM gedcom_imports
      WHERE id = ${activeImportId} AND atlas_id = ${atlasId}
      LIMIT 1
    `
    const row = imports[0] as
      | { activated_snapshot_pathname: string | null; snapshot_pathname: string | null }
      | undefined
    const pathname = row?.activated_snapshot_pathname || row?.snapshot_pathname
    if (!pathname) {
      res.status(200).json({ source: 'seed', importId: null, database: null, marriages: null })
      return
    }
    const blob = await readPrivateMedia({ blobUrl: pathname, blobPathname: pathname })
    const snapshot = JSON.parse(Buffer.from(blob.body).toString('utf8')) as {
      people: unknown[]
      root: string
      stats: unknown
      marriages?: unknown[]
    }
    res.status(200).json({
      source: 'import',
      importId: activeImportId,
      database: { people: snapshot.people, root: snapshot.root, stats: snapshot.stats },
      marriages: snapshot.marriages ?? [],
    })
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : 'Snapshot load failed')
  }
}
