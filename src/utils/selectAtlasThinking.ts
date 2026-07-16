import type { AtlasThinking, DetailContent } from '../types'

const MIN_RELEVANCE_SCORE = 48

type SelectAtlasThinkingInput = {
  observations: AtlasThinking[]
  center: number
  span: number
  detail: DetailContent
  highlightedStoryPersonId: string | null
  thinkingFocusRange: { start: number; end: number } | null
}

function overlapsRange(observation: AtlasThinking, start: number, end: number): boolean {
  return observation.yearStart <= end && observation.yearEnd >= start
}

function scoreObservation(
  observation: AtlasThinking,
  focusYear: number,
  rangeStart: number,
  rangeEnd: number,
  personId: string | null,
): number {
  let score = 0
  if (personId && observation.relatedPersonIds.includes(personId)) {
    if (observation.relatedPersonIds.length === 1) score += 35
    else score += 70
  }
  if (overlapsRange(observation, rangeStart, rangeEnd)) score += 40
  const mid = (observation.yearStart + observation.yearEnd) / 2
  score += Math.max(0, 30 - Math.abs(mid - focusYear) / 12)
  return score
}

export function selectAtlasThinking({
  observations,
  center,
  span,
  detail,
  highlightedStoryPersonId,
  thinkingFocusRange,
}: SelectAtlasThinkingInput): AtlasThinking | null {
  if (!observations.length) return null

  const start = center - span / 2
  const end = center + span / 2
  const rangeStart = thinkingFocusRange?.start ?? start
  const rangeEnd = thinkingFocusRange?.end ?? end

  let focusPersonId: string | null = highlightedStoryPersonId
  let focusYear = center

  if (detail?.type === 'person') {
    focusPersonId = detail.personId
  } else if (detail?.type === 'familyEvent') {
    focusPersonId = detail.event.person.id
    focusYear = detail.event.year
  } else if (detail?.type === 'history') {
    focusYear = detail.event.year
  } else if (detail?.type === 'thinking') {
    return detail.thinking
  }

  const ranked = [...observations].sort((a, b) => {
    const scoreA = scoreObservation(a, focusYear, rangeStart, rangeEnd, focusPersonId)
    const scoreB = scoreObservation(b, focusYear, rangeStart, rangeEnd, focusPersonId)
    return (
      scoreB - scoreA ||
      Math.abs((a.yearStart + a.yearEnd) / 2 - focusYear) -
        Math.abs((b.yearStart + b.yearEnd) / 2 - focusYear)
    )
  })

  const best = ranked[0]
  if (!best) return null

  const bestScore = scoreObservation(best, focusYear, rangeStart, rangeEnd, focusPersonId)
  if (bestScore < MIN_RELEVANCE_SCORE) return null

  return best
}
