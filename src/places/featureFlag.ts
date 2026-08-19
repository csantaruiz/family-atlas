const SESSION_KEY = 'atlas.unifiedPlaces'

/**
 * Phase 2A.2 — Explore/Map cutover gate. Default OFF.
 * Activate: ?unifiedPlaces=1
 * Rollback: ?unifiedPlaces=0 or clear sessionStorage key `atlas.unifiedPlaces`
 */
export function isUnifiedPlacesEnabled(): boolean {
  if (typeof window === 'undefined') return false

  const params = new URLSearchParams(window.location.search)
  if (params.has('unifiedPlaces')) {
    const value = params.get('unifiedPlaces')?.trim().toLowerCase()
    if (value === '0' || value === 'false' || value === 'off') {
      sessionStorage.removeItem(SESSION_KEY)
      return false
    }
    sessionStorage.setItem(SESSION_KEY, '1')
    return true
  }

  if (sessionStorage.getItem(SESSION_KEY) === '1') return true

  return import.meta.env.VITE_UNIFIED_PLACES === '1'
}
