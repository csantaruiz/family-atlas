import type { NormalizedPlace } from './types'

function stableAdminSignature(normalized: NormalizedPlace): string {
  const { country, admin1, admin2 } = normalized.components
  return [country, admin1, admin2].filter(Boolean).join('|').toLowerCase()
}

/**
 * Stable fingerprint for override matching across GEDCOM re-imports.
 */
export function placeFingerprint(normalized: NormalizedPlace): string {
  return `${normalized.matchKey}::${stableAdminSignature(normalized)}`
}
