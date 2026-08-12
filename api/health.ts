import type { VercelRequest, VercelResponse } from '@vercel/node'
import { loadLocalEnv } from './_lib/loadEnv'

loadLocalEnv()

/** Quick check that serverless API routes are reachable. */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  const blobToken = (process.env.BLOB_READ_WRITE_TOKEN ?? '').trim()
  res.status(200).json({
    ok: true,
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasBlobToken: Boolean(blobToken) && blobToken !== '[SENSITIVE]',
    blobTokenLooksValid: blobToken.startsWith('vercel_blob_rw_'),
    hasEditSecret: Boolean(process.env.ATLAS_EDIT_SECRET),
    hasAtlasId: Boolean(process.env.ATLAS_ID),
  })
}
