import type { AtlasThinking, DetailContent } from '../types'

const MIN_RELEVANCE_SCORE = 36

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

function viewportFitScore(observation: AtlasThinking, start: number, end: number, span: number): number {
  const overlapStart = Math.max(start, observation.yearStart)
  const overlapEnd = Math.min(end, observation.yearEnd)
  const overlap = Math.max(0, overlapEnd - overlapStart)
  if (overlap <= 0) return 0
  return Math.min(30, (overlap / Math.max(1, span)) * 30)
}

function scoreObservation(
  observation: AtlasThinking,
  focusYear: number,
  rangeStart: number,
  rangeEnd: number,
  viewportStart: number,
  viewportEnd: number,
  viewportSpan: number,
  personId: string | null,
): number {
  let score = 0
  if (personId && observation.relatedPersonIds.includes(personId)) {
    if (observation.relatedPersonIds.length === 1) score += 35
    else score += 70
  }
  if (overlapsRange(observation, rangeStart, rangeEnd)) score += 40
  score += viewportFitScore(observation, viewportStart, viewportEnd, viewportSpan)
  const mid = (observation.yearStart + observation.yearEnd) / 2
  score += Math.max(0, 24 - Math.abs(mid - focusYear) / Math.max(6, viewportSpan / 8))
  if (observation.id.startsWith('viewport-')) score += 18
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
    const scoreA = scoreObservation(
      a,
      focusYear,
      rangeStart,
      rangeEnd,
      start,
      end,
      span,
      focusPersonId,
    )
    const scoreB = scoreObservation(
      b,
      focusYear,
      rangeStart,
      rangeEnd,
      start,
      end,
      span,
      focusPersonId,
    )
    return (
      scoreB - scoreA ||
      Math.abs((a.yearStart + a.yearEnd) / 2 - focusYear) -
        Math.abs((b.yearStart + b.yearEnd) / 2 - focusYear)
    )
  })

  const best = ranked[0]
  if (!best) return null

  const bestScore = scoreObservation(
    best,
    focusYear,
    rangeStart,
    rangeEnd,
    start,
    end,
    span,
    focusPersonId,
  )
  if (bestScore < MIN_RELEVANCE_SCORE) return null

  return best
}
