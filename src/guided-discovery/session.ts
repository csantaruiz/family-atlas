export const GUIDED_SEEN_KEY = 'family-atlas-guided-discovery-seen'
export const GUIDED_PENDING_KEY = 'family-atlas-guided-discovery-pending'

function safeGet(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* ignore quota / private mode */
  }
}

function safeRemove(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export function readGuidedSeen(): boolean {
  return safeGet(GUIDED_SEEN_KEY) === '1'
}

export function writeGuidedSeen(): void {
  safeSet(GUIDED_SEEN_KEY, '1')
}

/** Request guided start on next Atlas mount — only if the visitor has not completed it. */
export function requestGuidedOnAtlasEntry(): void {
  if (readGuidedSeen()) return
  safeSet(GUIDED_PENDING_KEY, '1')
}

export function consumeGuidedPending(): boolean {
  if (safeGet(GUIDED_PENDING_KEY) !== '1') return false
  safeRemove(GUIDED_PENDING_KEY)
  return true
}

export function clearGuidedPending(): void {
  safeRemove(GUIDED_PENDING_KEY)
}
