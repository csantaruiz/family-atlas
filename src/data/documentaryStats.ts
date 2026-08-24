import { buildFamilyEvents } from './buildFamilyEvents'
import { getFamilyDatabase } from '../family-data/activeFamily'
import type { DocumentaryStats } from '../types/documentary'

export function getDocumentaryStats(): DocumentaryStats {
  const { stats } = getFamilyDatabase()
  const events = buildFamilyEvents(getFamilyDatabase().people)
  const migrations = events.filter((event) => event.kind === 'move').length
  const generations =
    Math.max(...getFamilyDatabase().people.map((person) => person.generation ?? 0), 0) + 1
  const yearSpan = stats.latestYear - stats.earliestYear
  const historicalEras = Math.max(3, Math.round(yearSpan / 120))

  return {
    generations,
    yearSpan,
    earliestYear: stats.earliestYear,
    latestYear: stats.latestYear,
    countries: stats.places.length,
    documentedMembers: stats.people,
    migrations,
    historicalEras,
    countryNames: stats.places.slice(0, 4).map(([name]) => name),
  }
}
