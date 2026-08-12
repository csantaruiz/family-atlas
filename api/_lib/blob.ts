import { del, get, put } from '@vercel/blob'
import { loadLocalEnv } from './loadEnv.js'

loadLocalEnv()

function blobToken(): string | undefined {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (!token || token === '[SENSITIVE]') return undefined
  if (!token.startsWith('vercel_blob_rw_')) return undefined
  return token
}

function blobAuth() {
  const token = blobToken()
  const storeId = process.env.BLOB_STORE_ID?.trim()
  return {
    ...(token ? { token } : {}),
    ...(storeId ? { storeId } : {}),
  }
}

export async function putPrivateMedia(pathname: string, body: Buffer, contentType: string) {
  return put(pathname, body, {
    access: 'private',
    ...blobAuth(),
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

export async function deletePrivateMedia(blobUrlOrPathname: string): Promise<void> {
  await del(blobUrlOrPathname, blobAuth())
}

/** Fetch private blob bytes via the Blob SDK (OIDC or RW token). Never expose Blob URLs to the browser. */
export async function readPrivateMediaByUrl(blobUrl: string): Promise<{
  body: ArrayBuffer
  contentType: string
}> {
  const result = await get(blobUrl, {
    access: 'private',
    ...blobAuth(),
  })
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(`Blob read failed (${result?.statusCode ?? 'no response'})`)
  }
  const body = await new Response(result.stream).arrayBuffer()
  return {
    body,
    contentType: result.blob.contentType || 'application/octet-stream',
  }
}

export function mediaPathname(input: {
  atlasId: string
  personId: string
  assetId: string
  filename: string
}): string {
  const safePerson = input.personId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const safeFile = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `atlases/${input.atlasId}/people/${safePerson}/media/${input.assetId}/${safeFile}`
}
