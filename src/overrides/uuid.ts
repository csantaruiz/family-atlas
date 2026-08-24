/** Browser-safe UUID helper (tests + client). */
export function randomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `ov-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
