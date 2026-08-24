import { describe, expect, it } from 'vitest'
import type { CustomerReviewItem } from '../selectCustomerReviews'
import { introBreakdown, presentationState, reviewCandidates } from '../reviewPresentation'
import {
  completeCounts,
  dateBothCorrectAction,
  dateConflictQuestion,
  dismissAction,
  itemQuestion,
  reviewMenuCount,
  reviewMenuHint,
  reviewShortcutLabel,
  skipAction,
} from '../customerReviewCopy'

function sample(partial: Partial<CustomerReviewItem> = {}): CustomerReviewItem {
  return {
    domain: 'place',
    id: 'x',
    originals: ['Graz, Styria, Austria'],
    primaryOriginal: 'Graz, Styria, Austria',
    kind: 'unresolved',
    healthCategory: 'ATLAS_REVIEW',
    familyWording: 'Graz, Styria, Austria',
    atlasReading: null,
    whyAsking: '',
    personId: 'I1',
    personName: 'John Hendry',
    personRole: 'birth place',
    eventYear: 1798,
    eventKind: 'birth',
    recommendedCanonicalPlaceId: null,
    recommendedLabel: null,
    alternatives: [],
    latitude: null,
    longitude: null,
    ...partial,
  }
}

describe('Atlas Review presentation', () => {
  it('maps a single recommendation to recommended', () => {
    const item = sample({
      recommendedCanonicalPlaceId: 'graz',
      recommendedLabel: 'Graz, Styria, Austria',
    })
    expect(presentationState(item)).toBe('recommended')
    expect(itemQuestion(presentationState(item))).toBe('Is this the right place?')
    expect(skipAction('recommended')).toBe('I’m not sure')
    expect(dismissAction('recommended')).toBe('That’s not the right place')
  })

  it('keeps extras behind recommended until the customer asks for them', () => {
    const item = sample({
      recommendedCanonicalPlaceId: 'graz',
      recommendedLabel: 'Graz, Styria, Austria',
      alternatives: [
        {
          canonicalPlaceId: 'graz-umgebung',
          label: 'Graz-Umgebung, Styria, Austria',
          latitude: 47.07,
          longitude: 15.44,
        },
      ],
    })
    expect(presentationState(item)).toBe('recommended')
    expect(reviewCandidates(item).map((c) => c.canonicalPlaceId)).toEqual(['graz', 'graz-umgebung'])
  })

  it('maps two alternatives without a recommendation to candidates', () => {
    const item = sample({
      kind: 'ambiguous',
      alternatives: [
        { canonicalPlaceId: 'graz', label: 'Graz, Styria, Austria', latitude: 47.07, longitude: 15.44 },
        {
          canonicalPlaceId: 'graz-umgebung',
          label: 'Graz-Umgebung, Styria, Austria',
          latitude: 47.1,
          longitude: 15.5,
        },
      ],
    })
    expect(presentationState(item)).toBe('candidates')
    expect(itemQuestion('candidates')).toBe('Which place does your family record mean?')
    expect(skipAction('candidates')).toBe('I’m not sure')
    expect(dismissAction('candidates')).toBe('None of these')
    expect(reviewCandidates(item)).toHaveLength(2)
  })

  it('maps no recommendation and no alternatives to unresolved', () => {
    const item = sample()
    expect(presentationState(item)).toBe('unresolved')
    expect(itemQuestion('unresolved')).toBe('Do you recognize this place?')
    expect(skipAction('unresolved')).toBe('I don’t recognize this place')
    expect(dismissAction('unresolved')).toBe('Don’t ask me about this again')
  })

  it('caps candidates at four and summarizes intro counts', () => {
    const items = [
      sample({ id: 'a', recommendedCanonicalPlaceId: 'graz', recommendedLabel: 'Graz' }),
      sample({
        id: 'b',
        kind: 'ambiguous',
        alternatives: [
          { canonicalPlaceId: 'one', label: 'One', latitude: 1, longitude: 1 },
          { canonicalPlaceId: 'two', label: 'Two', latitude: 2, longitude: 2 },
        ],
      }),
      sample({ id: 'c' }),
    ]
    expect(introBreakdown(items)).toEqual({ recommended: 1, candidates: 1, unresolved: 1, dates: 0, names: 0 })
    expect(completeCounts(5, 1, 1).join(' ')).toContain('5 details confirmed')
  })

  it('does not leak resolver language into customer copy', () => {
    const blob = [
      itemQuestion('recommended'),
      itemQuestion('candidates'),
      itemQuestion('unresolved'),
      skipAction('recommended'),
      dismissAction('recommended'),
      skipAction('unresolved'),
      dismissAction('unresolved'),
    ].join(' ')
    expect(blob).not.toMatch(/GEOGRAPHIC_CONFLICT|canonicalPlaceId|HIGH|override|interpretation|diagnostic/i)
  })

  it('uses a quiet Review shortcut label and hides the empty-queue hint', () => {
    expect(reviewShortcutLabel(1)).toBe('1 item to review')
    expect(reviewShortcutLabel(4)).toBe('4 items to review')
    expect(reviewMenuHint(0)).toBeNull()
    expect(reviewMenuHint(4)).toBe('4 items need your help')
    expect(reviewMenuCount(0)).toBeNull()
    expect(reviewMenuCount(8)).toBe('8')
  })

  it('uses conflict copy that does not pick a wrong date in advance', () => {
    expect(dateConflictQuestion()).toMatch(/two dates/i)
    expect(dateBothCorrectAction()).toMatch(/both dates are correct/i)
    expect(`${dateConflictQuestion()} ${dateBothCorrectAction()}`).not.toMatch(/keep this date|change this date/i)
  })

  it('counts name items separately from unresolved places', () => {
    expect(introBreakdown([sample({ id: 'n', domain: 'name', kind: 'name' })])).toEqual({
      recommended: 0,
      candidates: 0,
      unresolved: 0,
      dates: 0,
      names: 1,
    })
  })
})
