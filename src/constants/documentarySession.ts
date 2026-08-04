export const DOCUMENTARY_SESSION_KEY = 'family-atlas-documentary-seen'

export function readDocumentarySeen(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(DOCUMENTARY_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function writeDocumentarySeen(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(DOCUMENTARY_SESSION_KEY, '1')
  } catch {
    /* ignore */
  }
}
