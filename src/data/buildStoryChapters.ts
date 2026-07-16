import type { FamilyEvent, StoryChapter } from '../types'
import { canonicalEventId } from '../utils/canonicalEvent'
import {
  countEventTypes,
  formatEventSummary,
} from '../utils/chapterPresentation'
import { generateTimelineChapter } from '../utils/timelineChapterTitles'

export function eventRecordId(event: FamilyEvent): string {
  return canonicalEventId(event)
}

function chapterStatsSummary(events: FamilyEvent[]): string {
  return formatEventSummary(countEventTypes(events))
}

/**
 * Deterministic chapter title from local event data only.
 * Does NOT use Featured Story, story seeds, or carousel state.
 */
export function inferChapterTitle(
  events: FamilyEvent[],
  yearStart: number,
  yearEnd: number,
  earliestYear: number,
  presentYear: number,
  viewportSpan: number,
  fullSpan: number,
  siblingTitles: string[] = [],
): { title: string; subtitle: string; importance: number } {
  const narrative = generateTimelineChapter({
    events,
    yearStart,
    yearEnd,
    earliestYear,
    presentYear,
    viewportSpan,
    fullSpan,
    siblingTitles,
  })
  return {
    title: narrative.title,
    subtitle: narrative.narrative,
    importance: narrative.importance,
  }
}

function chapterGroupGap(span: number, modeGap?: number): number {
  if (modeGap) return modeGap
  if (span > 300) return 110
  if (span > 180) return 80
  if (span > 100) return 55
  if (span > 50) return 38
  return 22
}

function mergeChapterGroup(
  a: StoryChapter,
  b: StoryChapter,
  eventsA: FamilyEvent[],
  eventsB: FamilyEvent[],
  earliestYear: number,
  presentYear: number,
  viewportSpan: number,
  fullSpan: number,
): { chapter: StoryChapter; events: FamilyEvent[] } {
  const mergedEvents = [...eventsA, ...eventsB].sort((x, y) => x.year - y.year)
  const yearStart = Math.min(a.yearStart, b.yearStart)
  const yearEnd = Math.max(a.yearEnd, b.yearEnd)
  const narrative = inferChapterTitle(
    mergedEvents,
    yearStart,
    yearEnd,
    earliestYear,
    presentYear,
    viewportSpan,
    fullSpan,
  )
  return {
    chapter: {
      id: `chapter-${yearStart}-${yearEnd}`,
      title: narrative.title,
      subtitle: narrative.subtitle,
      yearStart,
      yearEnd,
      summary: chapterStatsSummary(mergedEvents),
      importance: Math.max(a.importance, b.importance, narrative.importance),
      relatedEventIds: mergedEvents.map(eventRecordId),
      relatedPersonIds: [...new Set(mergedEvents.map((e) => e.person.id))],
    },
    events: mergedEvents,
  }
}

function capChapterCount(
  chapters: StoryChapter[],
  eventGroups: FamilyEvent[][],
  maxChapters: number,
  earliestYear: number,
  presentYear: number,
  viewportSpan: number,
  fullSpan: number,
): { chapters: StoryChapter[]; eventGroups: FamilyEvent[][] } {
  let ch = [...chapters]
  let groups = eventGroups.map((g) => [...g])

  while (ch.length > maxChapters && ch.length > 1) {
    let mergeIdx = 0
    let smallestSpan = Infinity
    for (let i = 0; i < ch.length - 1; i++) {
      const gap = ch[i + 1].yearStart - ch[i].yearEnd
      const size = groups[i].length + groups[i + 1].length
      const score = gap + size * 0.1
      if (score < smallestSpan) {
        smallestSpan = score
        mergeIdx = i
      }
    }
    const merged = mergeChapterGroup(
      ch[mergeIdx],
      ch[mergeIdx + 1],
      groups[mergeIdx],
      groups[mergeIdx + 1],
      earliestYear,
      presentYear,
      viewportSpan,
      fullSpan,
    )
    ch.splice(mergeIdx, 2, merged.chapter)
    groups.splice(mergeIdx, 2, merged.events)
  }

  return { chapters: ch, eventGroups: groups }
}

export function buildStoryChaptersForViewport(
  events: FamilyEvent[],
  start: number,
  end: number,
  span: number,
  earliestYear: number,
  presentYear: number,
  maxChapters = 8,
  fullSpan?: number,
): StoryChapter[] {
  const timelineSpan = fullSpan ?? Math.max(1, presentYear - earliestYear)
  const visible = events
    .filter((e) => e.year >= start && e.year <= end)
    .sort((a, b) => a.year - b.year)
  if (!visible.length) return []

  const gapYears = chapterGroupGap(span)
  const groups: FamilyEvent[][] = []
  let current: FamilyEvent[] = []

  for (const event of visible) {
    if (!current.length) {
      current = [event]
      continue
    }
    const lastYear = current[current.length - 1].year
    if (event.year - lastYear > gapYears) {
      groups.push(current)
      current = [event]
    } else {
      current.push(event)
    }
  }
  if (current.length) groups.push(current)

  const usedTitles: string[] = []
  let chapters = groups.map((group) => {
    const yearStart = Math.min(...group.map((e) => e.year))
    const yearEnd = Math.max(...group.map((e) => e.year))
    const narrative = inferChapterTitle(
      group,
      yearStart,
      yearEnd,
      earliestYear,
      presentYear,
      span,
      timelineSpan,
      usedTitles,
    )
    usedTitles.push(narrative.title)
    return {
      id: `chapter-${yearStart}-${yearEnd}`,
      title: narrative.title,
      subtitle: narrative.subtitle,
      yearStart,
      yearEnd,
      summary: chapterStatsSummary(group),
      importance: narrative.importance,
      relatedEventIds: group.map(eventRecordId),
      relatedPersonIds: [...new Set(group.map((e) => e.person.id))],
    }
  })

  if (chapters.length > maxChapters) {
    const capped = capChapterCount(
      chapters,
      groups,
      maxChapters,
      earliestYear,
      presentYear,
      span,
      timelineSpan,
    )
    chapters = capped.chapters
  }

  return chapters
}

export function assignEventsToChapters(
  events: FamilyEvent[],
  chapters: StoryChapter[],
): Map<string, FamilyEvent[]> {
  const map = new Map<string, FamilyEvent[]>()
  for (const chapter of chapters) {
    map.set(chapter.id, [])
  }

  for (const event of events) {
    let best: StoryChapter | null = null
    let bestDist = Infinity
    for (const chapter of chapters) {
      if (event.year >= chapter.yearStart && event.year <= chapter.yearEnd) {
        best = chapter
        bestDist = 0
        break
      }
      const mid = (chapter.yearStart + chapter.yearEnd) / 2
      const dist = Math.abs(event.year - mid)
      if (dist < bestDist) {
        bestDist = dist
        best = chapter
      }
    }
    if (best) {
      map.get(best.id)!.push(event)
    }
  }

  return map
}
