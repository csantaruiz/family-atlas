import type { PersonImage } from '../types'

export type CloudPortrait = PersonImage & {
  assetId: string
  personId: string
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function fetchEditStatus(): Promise<boolean> {
  const res = await fetch('/api/unlock', { credentials: 'include' })
  if (!res.ok) return false
  const data = await parseJson(res)
  return Boolean(data.editing)
}

export async function unlockEditing(secret: string): Promise<void> {
  const res = await fetch('/api/unlock', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: secret.trim() }),
  })
  const data = await parseJson(res)
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        'Upload API not found. Use this computer’s local Atlas tab after restarting npm run dev (not the live Vercel site).',
      )
    }
    throw new Error(
      typeof data.error === 'string' ? data.error : `Could not unlock editing (${res.status})`,
    )
  }
}

/** Prompt once for the atlas edit secret when uploads/deletes need it. */
export async function ensureEditAccess(): Promise<void> {
  if (await fetchEditStatus()) return
  const secret = window.prompt('Enter the Atlas edit password to upload or remove photos:')
  if (!secret) throw new Error('Edit unlock cancelled.')
  await unlockEditing(secret)
}

export async function fetchPrimaryPortrait(personId: string): Promise<CloudPortrait | null> {
  const res = await fetch(`/api/media?personId=${encodeURIComponent(personId)}`, {
    credentials: 'include',
  })
  if (!res.ok) {
    const data = await parseJson(res)
    throw new Error(typeof data.error === 'string' ? data.error : 'Could not load portrait')
  }
  const data = await parseJson(res)
  const portrait = data.portrait
  if (!portrait || typeof portrait !== 'object') return null
  return portrait as CloudPortrait
}

export async function uploadPrimaryPortrait(input: {
  personId: string
  personName: string
  dataBase64: string
  contentType: string
  width: number
  height: number
  originalFilename: string
}): Promise<CloudPortrait> {
  await ensureEditAccess()
  const res = await fetch('/api/media', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personId: input.personId,
      personName: input.personName,
      kind: 'portrait',
      isPrimary: true,
      dataBase64: input.dataBase64,
      contentType: input.contentType,
      width: input.width,
      height: input.height,
      originalFilename: input.originalFilename,
    }),
  })
  const data = await parseJson(res)
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Upload failed')
  }
  return data.portrait as CloudPortrait
}

export async function deleteMediaAsset(assetId: string): Promise<void> {
  await ensureEditAccess()
  const res = await fetch(`/api/media/${encodeURIComponent(assetId)}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) {
    const data = await parseJson(res)
    throw new Error(typeof data.error === 'string' ? data.error : 'Remove failed')
  }
}
