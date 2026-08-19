/** DEV-only Atlas Debugger gate — requires ?atlasDebug=1 */
export function isAtlasDebugEnabled(): boolean {
  if (!import.meta.env.DEV) return false
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).has('atlasDebug')
}
