import { del, get, put } from '@vercel/blob'
import { loadLocalEnv } from './loadEnv.js'

loadLocalEnv()

function blobToken(): string | undefined {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (!token || token === '[SENSITIVE]') return undefined
  if (!token.startsWith('vercel_blob_rw_')) return undefined
  return token
}

function blobAuth(options?: { includeStoreId?: boolean }) {
  const token = blobToken()
  const storeId = process.env.BLOB_STORE_ID?.trim()
  return {
    ...(token ? { token } : {}),
    ...(options?.includeStoreId !== false && storeId ? { storeId } : {}),
  }
}

export async function putPrivateMedia(pathname: string, body: Buffer, contentType: string) {
  return put(pathname, body, {
    access: 'private',
    ...blobAuth({ includeStoreId: true }),
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

export async function deletePrivateMedia(blobUrlOrPathname: string): Promise<void> {
  await del(blobUrlOrPathname, blobAuth({ includeStoreId: true }))
}

async function readPrivateMediaTarget(target: string, includeStoreId: boolean): Promise<{
  body: ArrayBuffer
  contentType: string
}> {
  const result = await get(target, {
    access: 'private',
    ...blobAuth({ includeStoreId }),
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

/** Fetch private blob bytes via the Blob SDK (OIDC or RW token). Never expose Blob URLs to the browser. */
export async function readPrivateMedia(input: {
  blobUrl: string
  blobPathname?: string | null
}): Promise<{
  body: ArrayBuffer
  contentType: string
}> {
  const targets = [input.blobPathname, input.blobUrl].filter(
    (value): value is string => Boolean(value?.trim()),
  )
  let lastError: Error | null = null

  for (const target of targets) {
    for (const includeStoreId of [true, false] as const) {
      try {
        return await readPrivateMediaTarget(target, includeStoreId)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
      }
    }
  }

  throw lastError ?? new Error('Blob read failed (no target)')
}

/** @deprecated Use readPrivateMedia */
export async function readPrivateMediaByUrl(blobUrl: string): Promise<{
  body: ArrayBuffer
  contentType: string
}> {
  return readPrivateMedia({ blobUrl })
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
