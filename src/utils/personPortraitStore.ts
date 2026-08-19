import type { PersonImage } from '../types'
import {
  deleteMediaAsset,
  fetchPrimaryPortrait,
  uploadPrimaryPortrait,
  type CloudPortrait,
} from './mediaApi'

const MAX_EDGE_PX = 900
const JPEG_QUALITY = 0.84

export type PersonPortraitMap = Record<string, PersonImage>

const listeners = new Set<() => void>()
let snapshot: PersonPortraitMap = {}
const inflight = new Map<string, Promise<void>>()
const objectUrls = new Map<string, string>()

function revokePortraitObjectUrl(personId: string): void {
  const url = objectUrls.get(personId)
  if (!url) return
  URL.revokeObjectURL(url)
  objectUrls.delete(personId)
}

/** Prefetch private media bytes for reliable preview in the detail drawer. */
async function portraitWithDisplayUrl(portrait: CloudPortrait): Promise<PersonImage> {
  const res = await fetch(portrait.src, { credentials: 'include' })
  if (!res.ok) {
    let message = `Portrait bytes failed (${res.status})`
    try {
      const data = (await res.json()) as { error?: string }
      if (typeof data.error === 'string') message = data.error
    } catch {
      // keep status message
    }
    throw new Error(message)
  }

  const headerType = res.headers.get('content-type') ?? ''
  const blob = await res.blob()
  const mime =
    blob.type ||
    (headerType.startsWith('image/') ? headerType : '') ||
    'image/jpeg'

  if (!mime.startsWith('image/') && !headerType.startsWith('image/')) {
    throw new Error('Portrait response was not an image')
  }

  revokePortraitObjectUrl(portrait.personId)
  const objectUrl = URL.createObjectURL(
    blob.type.startsWith('image/') ? blob : new Blob([await blob.arrayBuffer()], { type: mime }),
  )
  objectUrls.set(portrait.personId, objectUrl)
  return { ...portrait, src: objectUrl, loadError: undefined }
}

function emit(): void {
  for (const listener of listeners) listener()
}

export function getPersonPortraitSnapshot(): PersonPortraitMap {
  return snapshot
}

export function subscribePersonPortraits(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
  }
}

export function getPersonPortrait(personId: string): PersonImage | undefined {
  return snapshot[personId]
}

function setLocalPortrait(personId: string, image: PersonImage): void {
  snapshot = { ...snapshot, [personId]: image }
  emit()
}

function clearLocalPortrait(personId: string): void {
  if (!(personId in snapshot)) return
  revokePortraitObjectUrl(personId)
  const next = { ...snapshot }
  delete next[personId]
  snapshot = next
  emit()
}

/** Load primary cloud portrait for a person (no-op if already cached). */
export function ensurePersonPortraitLoaded(personId: string): Promise<void> {
  if (snapshot[personId]) return Promise.resolve()
  const existing = inflight.get(personId)
  if (existing) return existing

  const task = (async () => {
    try {
      const portrait = await fetchPrimaryPortrait(personId)
      if (!portrait) return
      try {
        setLocalPortrait(personId, await portraitWithDisplayUrl(portrait))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Portrait bytes failed'
        console.warn('Portrait bytes prefetch failed', personId, error)
        setLocalPortrait(personId, { ...portrait, loadError: message })
      }
    } catch (error) {
      console.warn('Portrait load failed', personId, error)
    } finally {
      inflight.delete(personId)
    }
  })()

  inflight.set(personId, task)
  return task
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that image.'))
    img.src = src
  })
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Could not read that file.'))
    }
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}

/** Compress an image file client-side, then upload to private Atlas media storage. */
export async function createPortraitFromFile(
  file: File,
  personName: string,
): Promise<{ prepared: { dataBase64: string; contentType: string; width: number; height: number }; previewAlt: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.')
  }

  const dataUrl = await readFileAsDataUrl(file)
  const source = await loadImageElement(dataUrl)
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(source.width, source.height))
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not prepare that image.')
  ctx.drawImage(source, 0, 0, width, height)

  const jpegDataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  const dataBase64 = jpegDataUrl.replace(/^data:image\/jpeg;base64,/, '')

  return {
    prepared: {
      dataBase64,
      contentType: 'image/jpeg',
      width,
      height,
    },
    previewAlt: `Portrait of ${personName}`,
  }
}

export async function uploadPersonPortrait(
  personId: string,
  personName: string,
  file: File,
): Promise<CloudPortrait> {
  const { prepared } = await createPortraitFromFile(file, personName)
  const portrait = await uploadPrimaryPortrait({
    personId,
    personName,
    dataBase64: prepared.dataBase64,
    contentType: prepared.contentType,
    width: prepared.width,
    height: prepared.height,
    originalFilename: file.name || 'portrait.jpg',
  })
  try {
    setLocalPortrait(personId, await portraitWithDisplayUrl(portrait))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Portrait bytes failed'
    setLocalPortrait(personId, { ...portrait, loadError: message })
  }
  return portrait
}

/** Force a fresh metadata + byte fetch (e.g. after fixing Blob env). */
export function reloadPersonPortrait(personId: string): Promise<void> {
  clearLocalPortrait(personId)
  return ensurePersonPortraitLoaded(personId)
}

export async function removePersonPortrait(personId: string): Promise<void> {
  const current = snapshot[personId] as CloudPortrait | undefined
  const assetId = current && 'assetId' in current ? current.assetId : null
  if (assetId) {
    await deleteMediaAsset(assetId)
  } else {
    // Attempt refresh-from-server then delete if found.
    const remote = await fetchPrimaryPortrait(personId)
    if (remote?.assetId) await deleteMediaAsset(remote.assetId)
  }
  clearLocalPortrait(personId)
}

/** @deprecated localStorage writes removed — kept name for call-site clarity in older notes */
export function setPersonPortrait(personId: string, image: PersonImage): void {
  setLocalPortrait(personId, image)
}
