/**
 * Resolve a defensible soundtrack year for an ancestor profile.
 * Never uses lifespan midpoint — that invents a date unrelated to what the visitor is exploring.
 */
export type AncestorYearResolution = {
  year: number | null
  source: 'timeline_while_living' | 'birth' | 'death' | 'none'
  reason: string
}

export function resolveAncestorSubjectYear(
  birthYear: number | null | undefined,
  deathYear: number | null | undefined,
  timelineYear: number | null | undefined,
): AncestorYearResolution {
  const birth = birthYear ?? null
  const death = deathYear ?? null
  const timeline = timelineYear != null && Number.isFinite(timelineYear) ? Math.round(timelineYear) : null

  if (timeline != null && birth != null && timeline >= birth && (death == null || timeline <= death)) {
    return {
      year: timeline,
      source: 'timeline_while_living',
      reason: `timeline year ${timeline} while ancestor was living`,
    }
  }

  if (birth != null) {
    return {
      year: birth,
      source: 'birth',
      reason: 'documented birth year (conservative; not lifespan midpoint)',
    }
  }

  if (death != null) {
    return {
      year: death,
      source: 'death',
      reason: 'documented death year (no birth on record)',
    }
  }

  return { year: null, source: 'none', reason: 'no dated life events for soundtrack year' }
}
