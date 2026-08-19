import type { ParsedPlaceComponents, NormalizedPlace } from './types'
import { parsePlaceComponents } from './parsePlaceComponents'

const LOCALITY_ABBREVIATIONS: [RegExp, string][] = [
  [/^glou\.?\s*/i, 'Gloucester '],
  [/^st\.?\s+/i, 'Saint '],
]

const TOKEN_ABBREVIATIONS: Record<string, string> = {
  'n.j.': 'New Jersey',
  nj: 'New Jersey',
  'n.j': 'New Jersey',
  ca: 'California',
  'c.a.': 'California',
  pa: 'Pennsylvania',
  tx: 'Texas',
  usa: 'United States',
  us: 'United States',
  'u.s.a.': 'United States',
  'u.s.a': 'United States',
  mexique: 'Mexico',
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeMatchKey(value: string): string {
  return collapseWhitespace(value).toLowerCase().replace(/\s*,\s*/g, ', ')
}

function expandPart(part: string): string {
  let expanded = part.trim()
  for (const [pattern, replacement] of LOCALITY_ABBREVIATIONS) {
    expanded = expanded.replace(pattern, replacement)
  }
  const lower = expanded.toLowerCase()
  if (TOKEN_ABBREVIATIONS[lower]) {
    return TOKEN_ABBREVIATIONS[lower]
  }
  if (/^[a-z]{2}$/i.test(expanded)) {
    const key = expanded.toLowerCase()
    if (TOKEN_ABBREVIATIONS[key]) return TOKEN_ABBREVIATIONS[key]
  }
  return expanded
}

function splitParts(original: string): { parts: string[]; parseNotes: string[] } {
  const parseNotes: string[] = []
  const compact = collapseWhitespace(original)
  if (!compact) return { parts: [], parseNotes: ['empty-string'] }

  const rawParts = compact.split(',').map((part) => part.trim())
  const parts: string[] = []
  for (const raw of rawParts) {
    if (!raw) {
      parseNotes.push('dropped-empty-component')
      continue
    }
    parts.push(raw)
  }

  if (parts.length > 0 && /^of\s+/i.test(parts[0])) {
    parts[0] = parts[0].replace(/^of\s+/i, '')
    parseNotes.push('stripped-gedcom-locality-prefix')
    if (!parts[0]) {
      parts.shift()
      parseNotes.push('empty-after-prefix-strip')
    }
  }

  const last = parts[parts.length - 1]
  if (last && /^county of$/i.test(last)) {
    parseNotes.push('truncated-admin-suffix')
    parts.pop()
  }

  return { parts, parseNotes }
}

/**
 * Non-destructive normalization — never mutates the original GEDCOM string.
 */
export function normalizePlace(original: string): NormalizedPlace {
  const { parts: rawParts, parseNotes } = splitParts(original)
  const expandedParts = rawParts.flatMap((part) => {
    if (/^ca\s+usa$/i.test(part)) return ['California', 'United States']
    if (/^tx\s+usa$/i.test(part)) return ['Texas', 'United States']
    return [expandPart(part)]
  })
  const compact = expandedParts.join(', ')
  const parseForm = compact
  const matchKey = normalizeMatchKey(parseForm)
  const components: ParsedPlaceComponents = parsePlaceComponents(expandedParts, parseNotes, original)

  return {
    compact,
    matchKey,
    parseForm,
    components,
  }
}

export { normalizeMatchKey }
