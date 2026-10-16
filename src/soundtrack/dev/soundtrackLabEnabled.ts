/**
 * Soundtrack preview + diagnostics are available in local development, on Vercel
 * Preview hosts, or when the operator opts in via localStorage.
 * Never shown on a custom Production hostname unless explicitly opted in.
 */
export function isSoundtrackLabEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (localStorage.getItem('atlas-soundtrack-preview') === '1') return true
    if (localStorage.getItem('atlas-soundtrack-debug') === '1') return true
  } catch {
    // Private mode — fall through to host checks.
  }
  if (import.meta.env.DEV) return true
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') return true
  // Vercel Preview / branch deployments (not the production custom domain).
  if (host.endsWith('.vercel.app')) return true
  return false
}
