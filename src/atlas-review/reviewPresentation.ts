import type { CustomerPlaceChoice, CustomerReviewItem } from './selectCustomerReviews'

/** Customer-facing layout. Health/resolver categories stay internal. */
export type ReviewPresentationState = 'recommended' | 'candidates' | 'unresolved'

export type ReviewCandidate = CustomerPlaceChoice

/**
 * Fold the recommendation in as the first card, then extras, max 4.
 */
export function reviewCandidates(item: CustomerReviewItem): ReviewCandidate[] {
  const cards: ReviewCandidate[] = []
  const seen = new Set<string>()

  const add = (choice: ReviewCandidate | null | undefined) => {
    if (!choice?.canonicalPlaceId || seen.has(choice.canonicalPlaceId)) return
    seen.add(choice.canonicalPlaceId)
    cards.push(choice)
  }

  if (item.recommendedCanonicalPlaceId && item.recommendedLabel) {
    add({
      canonicalPlaceId: item.recommendedCanonicalPlaceId,
      label: item.recommendedLabel,
      latitude: item.latitude,
      longitude: item.longitude,
    })
  }
  for (const alt of item.alternatives) add(alt)
  return cards.slice(0, 4)
}

export function presentationState(item: CustomerReviewItem): ReviewPresentationState {
  if (item.domain !== 'place') return 'unresolved'
  const cards = reviewCandidates(item)
  if (item.recommendedCanonicalPlaceId && item.recommendedLabel && item.alternatives.length === 0) {
    return 'recommended'
  }
  if (item.recommendedCanonicalPlaceId && item.recommendedLabel && item.alternatives.length > 0) {
    return 'recommended'
  }
  if (cards.length >= 2) return 'candidates'
  if (cards.length === 1) return 'recommended'
  return 'unresolved'
}

export function introBreakdown(items: CustomerReviewItem[]): {
  recommended: number
  candidates: number
  unresolved: number
  dates: number
  names: number
} {
  let recommended = 0
  let candidates = 0
  let unresolved = 0
  let dates = 0
  let names = 0
  for (const item of items) {
    if (item.domain === 'date') {
      dates += 1
      continue
    }
    if (item.domain === 'name') {
      names += 1
      continue
    }
    const state = presentationState(item)
    if (state === 'recommended') recommended += 1
    else if (state === 'candidates') candidates += 1
    else unresolved += 1
  }
  return { recommended, candidates, unresolved, dates, names }
}
