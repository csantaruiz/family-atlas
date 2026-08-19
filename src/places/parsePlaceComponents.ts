import type { ParsedPlaceComponents } from './types'
import {
  findAdmin1InParts,
  findAdmin2InParts,
  findCountryInParts,
  matchAdmin1,
  matchAdmin2,
  matchCountry,
} from './registry/adminDivisions'
import {
  hasModernMexicoContext,
  hasModernUsContext,
  matchHistoricalEntity,
} from './registry/historicalEntities'

function remainingLocality(
  parts: string[],
  usedIndices: Set<number>,
): string | null {
  const remaining = parts.filter((_, index) => !usedIndices.has(index))
  if (remaining.length === 0) return null
  return remaining.join(', ')
}

/**
 * Assign hierarchical components right-to-left with admin context precedence.
 */
export function parsePlaceComponents(
  parts: string[],
  parseNotes: string[],
  original: string,
): ParsedPlaceComponents {
  if (parts.length === 0) {
    return {
      parts: [],
      locality: null,
      admin2: null,
      admin1: null,
      country: null,
      historicalEntity: null,
      parseQuality: 'empty',
      parseNotes,
    }
  }

  const usedIndices = new Set<number>()
  let country: string | null = null
  let admin1: string | null = null
  let admin2: string | null = null
  let historicalEntity: string | null = null

  const historical = matchHistoricalEntity(original)
  if (historical) {
    historicalEntity = historical.canonicalName
    parseNotes.push(`historical-entity:${historical.id}`)
  }

  const countryMatch = findCountryInParts(parts)
  if (countryMatch) {
    country = countryMatch.name
    const idx = parts.findIndex((part) => matchCountry(part)?.name === countryMatch.name)
    if (idx >= 0) usedIndices.add(idx)
  } else if (historical && hasModernMexicoContext(original)) {
    country = 'Mexico'
    parseNotes.push('modern-mexico-context-from-historical-string')
  } else if (/\b(usa|u\.s\.a\.|united states)\b/i.test(original)) {
    country = 'United States'
  }

  if (country) {
    const admin1Match = findAdmin1InParts(parts, country)
    if (admin1Match) {
      admin1 = admin1Match.admin.name
      usedIndices.add(admin1Match.index)
    }
  } else {
    // Infer country from recognized admin1 when country omitted (common in GEDCOM).
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const us = matchAdmin1(parts[i], 'United States')
      if (us) {
        country = 'United States'
        admin1 = us.name
        usedIndices.add(i)
        parseNotes.push('inferred-us-from-state')
        break
      }
      const mx = matchAdmin1(parts[i], 'Mexico')
      if (mx) {
        country = 'Mexico'
        admin1 = mx.name
        usedIndices.add(i)
        parseNotes.push('inferred-mexico-from-state')
        break
      }
    }
  }

  // Pennsylvania "Wyoming" / "Susquehanna" are counties when Pa/Pennsylvania is present.
  if (country === 'United States' && admin1 === 'Pennsylvania') {
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      if (usedIndices.has(i)) continue
      const county = matchAdmin2(parts[i], country, admin1)
      if (county) {
        admin2 = county.name
        usedIndices.add(i)
        break
      }
    }
  } else if (country && admin1) {
    const admin2Match = findAdmin2InParts(parts, country, admin1, usedIndices)
    if (admin2Match) {
      admin2 = admin2Match.admin.name
      usedIndices.add(admin2Match.index)
    }
  }

  // Camden as county when in New Jersey without explicit admin2 yet.
  if (country === 'United States' && admin1 === 'New Jersey' && !admin2) {
    for (let i = 0; i < parts.length; i += 1) {
      if (usedIndices.has(i)) continue
      if (/^camden$/i.test(parts[i])) {
        admin2 = 'Camden'
        usedIndices.add(i)
        break
      }
    }
  }

  // New London as Connecticut county — never as London, England.
  if (country === 'United States' && admin1 === 'Connecticut' && !admin2) {
    for (let i = 0; i < parts.length; i += 1) {
      if (usedIndices.has(i)) continue
      if (/^new london$/i.test(parts[i])) {
        admin2 = 'New London'
        usedIndices.add(i)
        parseNotes.push('connecticut-new-london-county')
        break
      }
    }
  }

  // St Johns as Florida county.
  if (country === 'United States' && admin1 === 'Florida' && !admin2) {
    for (let i = 0; i < parts.length; i += 1) {
      if (usedIndices.has(i)) continue
      if (/^st\.?\s*johns$/i.test(parts[i])) {
        admin2 = 'St Johns'
        usedIndices.add(i)
        break
      }
    }
  }

  // Hampshire county disambiguation by admin1.
  if (country === 'United States' && !admin2) {
    for (let i = 0; i < parts.length; i += 1) {
      if (usedIndices.has(i)) continue
      if (/^hampshire$/i.test(parts[i]) && admin1) {
        const county = matchAdmin2('Hampshire', country, admin1)
        if (county) {
          admin2 = county.name
          usedIndices.add(i)
          break
        }
      }
    }
  }

  // Knox county in Missouri.
  if (country === 'United States' && admin1 === 'Missouri' && !admin2) {
    for (let i = 0; i < parts.length; i += 1) {
      if (usedIndices.has(i)) continue
      if (/^knox$/i.test(parts[i])) {
        admin2 = 'Knox'
        usedIndices.add(i)
        break
      }
    }
  }

  const locality = remainingLocality(parts, usedIndices)

  let parseQuality: ParsedPlaceComponents['parseQuality'] = 'clean'
  if (parseNotes.some((note) => note.startsWith('dropped-empty') || note.includes('truncated'))) {
    parseQuality = 'malformed'
  } else if (!locality && (admin1 || admin2)) {
    parseQuality = 'partial'
  } else if (parts.length === 1 && !country && !admin1) {
    parseQuality = 'partial'
  }

  if (historical && !country && !hasModernMexicoContext(original) && !hasModernUsContext(original)) {
    parseNotes.push('historical-only-no-modern-admin')
  }

  return {
    parts,
    locality,
    admin2,
    admin1,
    country,
    historicalEntity,
    parseQuality,
    parseNotes,
  }
}
