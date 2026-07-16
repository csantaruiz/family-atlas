import type { FamilyEvent } from '../types'
import {
  chapterScope,
  countEventTypes,
  fullTimelineTitle,
  isGenuinelyEarlyRange,
  type ScopeCategory,
} from './chapterPresentation'
import { semanticZoomMode } from './semanticZoom'
import { placeRegion } from './placeUtils'

export type TimelineChapterNarrative = {
  title: string
  narrative: string
  importance: number
}

type NarrativeDepth = 'far' | 'medium' | 'near'

type TitleCandidate = {
  title: string
  priority: number
  minDepth: NarrativeDepth
}

const DEPTH_RANK: Record<NarrativeDepth, number> = {
  far: 0,
  medium: 1,
  near: 2,
}

function narrativeDepth(span: number, fullSpan: number): NarrativeDepth {
  const mode = semanticZoomMode(span, fullSpan)
  if (mode === 'far') return 'far'
  if (mode === 'medium') return 'medium'
  return 'near'
}

function dominantSurname(events: FamilyEvent[]): string {
  const counts = new Map<string, number>()
  for (const event of events) {
    const parts = event.person.name.trim().split(/\s+/)
    const surname = parts.length > 1 ? parts[parts.length - 1] : parts[0]
    if (!surname) continue
    counts.set(surname, (counts.get(surname) ?? 0) + 1)
  }
  let best = ''
  let bestCount = 0
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name
      bestCount = count
    }
  }
  return best
}

function leadPerson(events: FamilyEvent[]): FamilyEvent | null {
  const sorted = [...events].sort(
    (a, b) =>
      (a.person.generation ?? 99) - (b.person.generation ?? 99) ||
      (b.importance ?? 0) - (a.importance ?? 0) ||
      a.year - b.year,
  )
  return sorted[0] ?? null
}

function placeBlob(events: FamilyEvent[]): string {
  return events
    .map((e) => `${e.person.birthPlace ?? ''} ${e.person.deathPlace ?? ''} ${e.detail ?? ''}`)
    .join(' ')
    .toLowerCase()
}

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

function isTooSimilar(title: string, compare?: string | null): boolean {
  if (!compare) return false
  const a = normalizeTitle(title)
  const b = normalizeTitle(compare)
  if (!a || !b) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true

  const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 3))
  const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 3))
  if (!wordsA.size || !wordsB.size) return false

  let overlap = 0
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++
  }
  const minSize = Math.min(wordsA.size, wordsB.size)
  return overlap / minSize >= 0.55
}

function isTooSimilarToAny(title: string, others: string[]): boolean {
  return others.some((o) => isTooSimilar(title, o))
}

function pickTitle(
  candidates: TitleCandidate[],
  depth: NarrativeDepth,
  avoid: string[],
): { title: string; priority: number } {
  const depthRank = DEPTH_RANK[depth]
  const eligible = candidates
    .filter((c) => DEPTH_RANK[c.minDepth] <= depthRank)
    .sort((a, b) => b.priority - a.priority)

  for (const c of eligible) {
    if (!isTooSimilarToAny(c.title, avoid)) return { title: c.title, priority: c.priority }
  }

  for (const c of eligible) {
    const alt =
      depth === 'near'
        ? `${c.title} — up close`
        : depth === 'medium'
          ? `${c.title} in focus`
          : c.title
    if (!isTooSimilarToAny(alt, avoid)) return { title: alt, priority: c.priority - 2 }
  }

  return { title: eligible[0]?.title ?? 'Family records', priority: eligible[0]?.priority ?? 40 }
}

function migrationTitleCandidates(
  events: FamilyEvent[],
  blob: string,
  depth: NarrativeDepth,
  yearStart: number,
  yearEnd: number,
): TitleCandidate[] {
  const moves = events.filter((e) => e.kind === 'move')
  if (!moves.length) return []

  const candidates: TitleCandidate[] = []
  const dest = placeRegion(moves[0].detail.split('into ')[1] || moves[0].detail)

  if (/chihuahua|coahuila|durango|sonora|parral|rosales/.test(blob)) {
    if (depth === 'far') {
      candidates.push({ title: 'Migration into northern Mexico', priority: 99, minDepth: 'far' })
      candidates.push({ title: 'Settlement in Northern New Spain', priority: 98, minDepth: 'far' })
      candidates.push({ title: 'Families take root in the north', priority: 92, minDepth: 'far' })
    }
    if (depth !== 'far') {
      candidates.push({ title: 'A century in colonial Chihuahua', priority: 96, minDepth: 'medium' })
      candidates.push({ title: 'Expansion through Chihuahua', priority: 90, minDepth: 'medium' })
    }
    if (depth === 'near') {
      candidates.push({ title: 'From mission towns to ranch communities', priority: 94, minDepth: 'near' })
      candidates.push({ title: 'Borderlands after Mexican Independence', priority: 88, minDepth: 'near' })
    }
    if (yearEnd >= 1840 && yearStart < 1920) {
      candidates.push({
        title: 'From Chihuahua toward the United States',
        priority: 95,
        minDepth: 'medium',
      })
    }
  }

  if (/california|san diego|los angeles/.test(blob)) {
    candidates.push({ title: 'Arrival in California', priority: 98, minDepth: 'medium' })
    candidates.push({ title: 'California becomes home', priority: 97, minDepth: 'medium' })
    candidates.push({ title: 'Crossing into California', priority: 91, minDepth: 'near' })
  }

  if (/pennsylvania|new jersey|iron|hendry/.test(blob)) {
    candidates.push({ title: 'Industrial America and the Hendrys', priority: 96, minDepth: 'far' })
    candidates.push({ title: 'The ironworker generation', priority: 94, minDepth: 'medium' })
    candidates.push({ title: 'The New Jersey years', priority: 92, minDepth: 'near' })
    candidates.push({ title: 'Arrival in America', priority: 88, minDepth: 'medium' })
  }

  if (/new jersey|camden|essex|morris/.test(blob) && !/pennsylvania/.test(blob)) {
    candidates.push({ title: 'The New Jersey years', priority: 95, minDepth: 'medium' })
  }

  if (/england|cheshire|gawsworth|lancashire|britain/.test(blob)) {
    candidates.push({ title: 'Early branches take shape', priority: 90, minDepth: 'far' })
    candidates.push({ title: 'Crossing the Atlantic', priority: 93, minDepth: 'medium' })
  }

  if (dest) {
    candidates.push({
      title: depth === 'far' ? 'Families move across borders' : `Toward ${dest}`,
      priority: 82,
      minDepth: 'medium',
    })
  }

  if (moves.length >= 2) {
    candidates.push({ title: 'Migration and a new generation', priority: 80, minDepth: 'near' })
  }

  return candidates
}

function eraTitleCandidates(
  yearStart: number,
  yearEnd: number,
  blob: string,
): TitleCandidate[] {
  const mid = (yearStart + yearEnd) / 2
  const candidates: TitleCandidate[] = []

  if (yearMaxBefore(yearEnd, 1821) && /mexico|chihuahua/.test(blob)) {
    candidates.push({ title: 'The generation before Independence', priority: 93, minDepth: 'medium' })
    candidates.push({ title: 'Life before Independence', priority: 89, minDepth: 'near' })
  }

  if (yearStart < 1821 && yearEnd >= 1810 && /mexico|chihuahua/.test(blob)) {
    candidates.push({ title: 'Families living through Independence', priority: 95, minDepth: 'medium' })
  }

  if (yearStart >= 1914 && yearEnd <= 1945) {
    candidates.push({ title: 'The World War generation', priority: 96, minDepth: 'medium' })
  }

  if (mid >= 1860 && mid < 1914 && /pennsylvania|iron|hendry|new jersey/.test(blob)) {
    candidates.push({ title: 'The ironworker generation', priority: 92, minDepth: 'medium' })
    candidates.push({ title: 'Industrial-age generations', priority: 86, minDepth: 'far' })
  }

  if (yearStart >= 1945) {
    candidates.push({ title: 'The postwar expansion', priority: 86, minDepth: 'medium' })
    candidates.push({ title: 'The living family', priority: 84, minDepth: 'medium' })
    candidates.push({ title: 'Postwar generations', priority: 80, minDepth: 'near' })
  }

  if (yearStart >= 1865 && yearEnd <= 1918 && /pennsylvania|new jersey|iron|hendry/.test(blob)) {
    candidates.push({ title: 'Building the ironworker family', priority: 94, minDepth: 'near' })
  }

  if (yearStart < 1650) {
    candidates.push({ title: 'The earliest documented generations', priority: 88, minDepth: 'far' })
  }

  return candidates
}

function yearMaxBefore(yearEnd: number, year: number): boolean {
  return yearEnd <= year
}

function peopleTitleCandidates(
  events: FamilyEvent[],
  surname: string,
  lead: FamilyEvent | null,
  blob: string,
  depth: NarrativeDepth,
): TitleCandidate[] {
  const births = events.filter((e) => e.kind === 'birth')
  const candidates: TitleCandidate[] = []

  if (surname && births.length >= 2) {
    if (depth === 'far') {
      candidates.push({ title: `The first documented ${surname} families`, priority: 91, minDepth: 'far' })
    }
    if (depth === 'medium') {
      candidates.push({ title: `The ${surname} line expands`, priority: 87, minDepth: 'medium' })
    }
    if (depth === 'near') {
      candidates.push({ title: `The ${surname} generation`, priority: 90, minDepth: 'near' })
    }
  }

  if (/rosales/.test(blob)) {
    candidates.push({ title: 'The Rosales generation', priority: 94, minDepth: 'near' })
  }

  if (lead && depth === 'near') {
    const nameParts = lead.person.name.split(/\s+/)
    const familyName = nameParts.slice(-2).join(' ')
    candidates.push({ title: `The ${familyName} generation`, priority: 88, minDepth: 'near' })
  }

  if (births.length >= 6 && depth === 'medium') {
    candidates.push({ title: 'A growing family line', priority: 78, minDepth: 'medium' })
  }

  return candidates
}

function militaryTitleCandidates(events: FamilyEvent[], depth: NarrativeDepth): TitleCandidate[] {
  const military = events.filter((e) => e.kind === 'service')
  if (!military.length) return []

  const candidates: TitleCandidate[] = []
  if (military.length >= 2 || military.length / events.length >= 0.12) {
    candidates.push({ title: 'The wartime generation', priority: 94, minDepth: 'medium' })
    candidates.push({ title: 'Service and wartime years', priority: 90, minDepth: 'far' })
  }
  if (depth === 'near') {
    candidates.push({ title: 'Called to serve', priority: 86, minDepth: 'near' })
  }
  return candidates
}

function generateNarrativeSentence(input: {
  events: FamilyEvent[]
  yearStart: number
  yearEnd: number
  scope: ScopeCategory
  depth: NarrativeDepth
  blob: string
  surname: string
  title: string
}): string {
  const { events, yearStart, yearEnd, scope, depth, blob, surname, title } = input
  const counts = countEventTypes(events)
  const moves = events.filter((e) => e.kind === 'move')
  const military = events.filter((e) => e.kind === 'service')
  const span = yearEnd - yearStart

  if (scope === 'full_timeline') {
    if (/chihuahua|mexico/.test(blob) && /california|pennsylvania|new jersey/.test(blob)) {
      return 'The documented line moves from colonial Mexico through industrial America into the present.'
    }
    return `The uploaded tree traces more than ${span} years of births, migrations, and family change.`
  }

  if (/chihuahua|rosales|parral|santa isabel/.test(blob)) {
    if (yearEnd < 1821) {
      return 'Several generations remained in Chihuahua before the upheaval of Independence.'
    }
    if (yearStart < 1821 && yearEnd >= 1810) {
      return 'The family remains rooted in Chihuahua while revolutions reshape North America.'
    }
    if (moves.length >= 1 && /california|texas|united states|arizona/.test(blob)) {
      return 'Documented moves carry branches from Chihuahua toward the United States.'
    }
    if (span >= 80) {
      return 'The uploaded tree documents over a century centered almost entirely in colonial Chihuahua.'
    }
    return 'Births and local records suggest a family line taking root in northern Mexico.'
  }

  if (/pennsylvania|iron|hendry|new jersey/.test(blob)) {
    if (military.length >= 1) {
      return 'Industrial work and wartime service shape this American chapter of the family.'
    }
    return 'Ironwork, settlement, and new births mark the family’s arrival in industrial America.'
  }

  if (/california|san diego/.test(blob)) {
    return 'Later generations consolidate in California as the western branch of the family.'
  }

  if (/england|cheshire|gawsworth/.test(blob)) {
    return 'Sparse early records suggest branches forming in England before later migrations.'
  }

  if (moves.length >= 2) {
    const dest = placeRegion(moves[moves.length - 1].detail.split('into ')[1] || moves[moves.length - 1].detail)
    if (dest) {
      return `Multiple documented moves point toward ${dest} as the family redefines its home.`
    }
    return 'Migration records outnumber other events — the family is on the move.'
  }

  if (military.length >= 1) {
    return 'Wartime service interrupts local life as family members are drawn into broader conflict.'
  }

  if (surname && counts.births >= counts.deaths) {
    if (depth === 'near') {
      return `The ${surname} name recurs across births here, suggesting a consolidating generation.`
    }
    return `The ${surname} line grows through births and local settlement across these years.`
  }

  if (span >= 60 && events.length <= 8) {
    return 'Only scattered records survive, but they hint at a long quiet chapter in the family story.'
  }

  if (title.includes('Independence')) {
    return 'The Ruiz line spans the colonial era into Mexican Independence.'
  }

  const parts: string[] = []
  if (counts.births) parts.push(`${counts.births} birth${counts.births === 1 ? '' : 's'}`)
  if (counts.moves) parts.push(`${counts.moves} migration${counts.moves === 1 ? '' : 's'}`)
  if (counts.military) parts.push('wartime service')
  if (parts.length) {
    return `This chapter is shaped by ${parts.join(', ')} across the visible years.`
  }

  return 'The records here capture a distinct chapter in how this family took shape.'
}

export type TimelineChapterInput = {
  events: FamilyEvent[]
  yearStart: number
  yearEnd: number
  earliestYear: number
  presentYear: number
  viewportSpan: number
  fullSpan: number
  siblingTitles?: string[]
  parentTitle?: string | null
}

export function generateTimelineChapter(input: TimelineChapterInput): TimelineChapterNarrative {
  const {
    events,
    yearStart,
    yearEnd,
    earliestYear,
    presentYear,
    viewportSpan,
    fullSpan,
    siblingTitles = [],
    parentTitle,
  } = input

  const scope = chapterScope(yearStart, yearEnd, earliestYear, presentYear)
  const depth = narrativeDepth(viewportSpan, fullSpan)
  const blob = placeBlob(events)
  const surname = dominantSurname(events)
  const lead = leadPerson(events)
  const avoid = [...siblingTitles, parentTitle].filter(Boolean) as string[]

  if (scope === 'full_timeline') {
    const title = fullTimelineTitle(yearStart, yearEnd)
    return {
      title: isTooSimilarToAny(title, avoid) ? 'The documented family timeline' : title,
      narrative: generateNarrativeSentence({
        events,
        yearStart,
        yearEnd,
        scope,
        depth,
        blob,
        surname,
        title,
      }),
      importance: 90,
    }
  }

  const candidates: TitleCandidate[] = [
    ...militaryTitleCandidates(events, depth),
    ...migrationTitleCandidates(events, blob, depth, yearStart, yearEnd),
    ...eraTitleCandidates(yearStart, yearEnd, blob),
    ...peopleTitleCandidates(events, surname, lead, blob, depth),
  ]

  if (isGenuinelyEarlyRange(yearStart, yearEnd, earliestYear, presentYear) && /england|cheshire/.test(blob)) {
    candidates.push({ title: 'The English branch emerges', priority: 85, minDepth: 'medium' })
  }

  if (/chihuahua|rosales/.test(blob) && depth === 'near') {
    candidates.push({ title: 'Families take root in Chihuahua', priority: 82, minDepth: 'near' })
  }

  if (scope === 'broad_era' && !candidates.length) {
    if (yearStart < 1850) {
      candidates.push({ title: 'Colonial and frontier years', priority: 60, minDepth: 'far' })
    } else if (yearStart < 1950) {
      candidates.push({ title: 'Twentieth-century family life', priority: 58, minDepth: 'far' })
    }
  }

  const picked = pickTitle(candidates, depth, avoid)
  const narrative = generateNarrativeSentence({
    events,
    yearStart,
    yearEnd,
    scope,
    depth,
    blob,
    surname,
    title: picked.title,
  })

  return {
    title: picked.title,
    narrative,
    importance: picked.priority,
  }
}
