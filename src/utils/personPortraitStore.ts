import type { PersonImage } from '../types'

const STORAGE_KEY = 'atlas.person-portraits.v1'
const MAX_EDGE_PX = 900
const JPEG_QUALITY = 0.84

export type PersonPortraitMap = Record<string, PersonImage>

const listeners = new Set<() => void>()
let snapshot: PersonPortraitMap = readFromStorage()

function readFromStorage(): PersonPortraitMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as PersonPortraitMap
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

function writeToStorage(map: PersonPortraitMap): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Quota exceeded or private mode — keep in-memory snapshot only.
  }
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

export function setPersonPortrait(personId: string, image: PersonImage): void {
  snapshot = { ...snapshot, [personId]: image }
  writeToStorage(snapshot)
  emit()
}

export function removePersonPortrait(personId: string): void {
  if (!(personId in snapshot)) return
  const next = { ...snapshot }
  delete next[personId]
  snapshot = next
  writeToStorage(snapshot)
  emit()
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

/** Compress and normalize an uploaded portrait for on-device storage. */
export async function createPortraitFromFile(
  file: File,
  personName: string,
): Promise<PersonImage> {
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

  const src = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  return {
    src,
    alt: `Portrait of ${personName}`,
    caption: 'Family photograph',
    credit: 'Saved on this device',
    isPlaceholder: false,
    isUserUpload: true,
  }
}
