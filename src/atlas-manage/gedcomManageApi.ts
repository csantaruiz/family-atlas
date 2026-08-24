import type { InspectableGedcomImport } from '../gedcom/import/inspectImport'

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

function failMessage(status: number): string {
  if (status === 401) return 'Please sign in as the family editor first.'
  if (status === 409) return 'This family-tree file is already here.'
  if (status === 404) return 'The update service is not available in this copy of the Atlas.'
  return 'We couldn’t update your family tree.'
}

export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export async function uploadGedcomFile(
  file: File,
  fetchFn: typeof fetch = fetch,
): Promise<{ inspect: InspectableGedcomImport | null; duplicateImportId?: string; error?: string }> {
  const dataBase64 = await fileToBase64(file)
  const response = await fetchFn('/api/gedcom/imports', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, dataBase64 }),
  })
  const data = await readJson(response)
  const duplicateId = typeof data.importId === 'string' ? data.importId : null
  if (response.status === 409 && duplicateId) {
    return { inspect: null, duplicateImportId: duplicateId, error: failMessage(409) }
  }
  if (!response.ok) {
    return { inspect: null, error: failMessage(response.status) }
  }
  const inspect = data.import as InspectableGedcomImport | undefined
  return { inspect: inspect ?? null }
}

export async function loadGedcomImport(
  id: string,
  fetchFn: typeof fetch = fetch,
): Promise<InspectableGedcomImport | null> {
  const response = await fetchFn(`/api/gedcom/imports?id=${encodeURIComponent(id)}`, {
    credentials: 'include',
  })
  if (!response.ok) return null
  const data = await readJson(response)
  return (data.import as InspectableGedcomImport) ?? null
}

export async function discardGedcomImport(id: string, fetchFn: typeof fetch = fetch): Promise<boolean> {
  const response = await fetchFn(`/api/gedcom/imports?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  return response.ok
}

export async function activateGedcomImport(
  importId: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ ok: boolean; livePaused?: boolean; error?: string }> {
  const response = await fetchFn('/api/gedcom/imports/activate', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ importId }),
  })
  const data = await readJson(response)
  if (data.livePaused === true) {
    return { ok: false, livePaused: true, error: 'We couldn’t update your family tree.' }
  }
  if (!response.ok) {
    const status = response.status === 409 ? 500 : response.status
    return { ok: false, error: failMessage(status) }
  }
  return { ok: true }
}

export async function listGedcomImports(
  fetchFn: typeof fetch = fetch,
): Promise<InspectableGedcomImport[]> {
  const response = await fetchFn('/api/gedcom/imports', { credentials: 'include' })
  if (!response.ok) return []
  const data = await readJson(response)
  return Array.isArray(data.imports) ? (data.imports as InspectableGedcomImport[]) : []
}
