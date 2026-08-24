import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { hydrateOverrideCache, setOverrideAtlasId } from '../../overrides/overrideCache'
import { memoryOverrideStore } from '../../overrides/memoryStore'
import { selectCustomerReviews } from '../selectCustomerReviews'
import {
  dismissAction,
  introSummaryLine,
  nameConsequence,
  nameEditQuestion,
  nameExplain,
  nameKeepAction,
  nameOriginalLabel,
  nameQuestion,
  nameReviewCustomerCopy,
  nameSaveAction,
  nameSkipAction,
  nameSkipHint,
  nameUseDifferentAction,
  nameUseSuggestedAction,
  saveLockedBody,
  saveLockedTitle,
  skipAction,
  sourceKicker,
  unresolvedBody,
} from '../customerReviewCopy'

const PLACE_TERMS =
  /\bplaces?\b|where this refers|recognize this place|couldn’t identify|we think this is|possible matches|i don’t recognize|don’t ask me about this again/i

describe('name Review customer copy', () => {
  beforeEach(() => {
    memoryOverrideStore.clear()
    setOverrideAtlasId('test-atlas')
    hydrateOverrideCache('test-atlas', [])
  })

  it('uses the Salvador card wording without sounding like data corruption', () => {
    const salvador = selectCustomerReviews().find((item) => item.domain === 'name')
    expect(salvador).toBeTruthy()
    expect(salvador?.sourceNameRaw).toMatch(/salvador\*\s*pinon vernal/i)
    expect(salvador?.suggestedName).toBe('Salvador Pinon Vernal')

    expect(nameQuestion()).toBe('This name may need a quick check')
    expect(nameExplain(salvador!.suggestedName)).toBe(
      'This name includes an unusual character. Did your family record mean “Salvador Pinon Vernal”?',
    )
    expect(sourceKicker()).toBe('Your family record says')
    expect(nameUseSuggestedAction(salvador!.suggestedName!)).toBe('Use Salvador Pinon Vernal')
    expect(nameUseDifferentAction()).toBe('Enter a different name')
    expect(nameKeepAction()).toBe('Keep as written')
    expect(nameSkipAction()).toBe('I’m not sure')
    expect(nameSkipHint()).toBe('Skip for now. We may ask again later.')
    expect(nameConsequence()).toBe(
      'This changes how the name appears in your Atlas. Your original family record stays unchanged.',
    )
    expect(nameEditQuestion()).toBe('How should this name appear?')
    expect(`${nameOriginalLabel()}: ${salvador!.sourceNameRaw}`).toBe(
      'Original family record: Salvador* Pinon Vernal',
    )
    expect(nameSaveAction()).toBe('Save name')
    expect(introSummaryLine('name', 1)).toBe('1 name that may need a quick check')
  })

  it('does not include place terminology on a name Review card', () => {
    const salvador = selectCustomerReviews().find((item) => item.domain === 'name')
    expect(salvador).toBeTruthy()
    const blob = nameReviewCustomerCopy(salvador!).join('\n')
    expect(blob).not.toMatch(PLACE_TERMS)
    expect(blob).not.toContain(unresolvedBody())
    expect(blob).not.toContain(skipAction('unresolved'))
    expect(blob).not.toContain(dismissAction('unresolved'))
    expect(blob).not.toMatch(/damaged/i)
  })

  it('keeps place unresolved copy available only for the place domain', () => {
    expect(unresolvedBody()).toMatch(/where this refers/i)
    expect(skipAction('unresolved')).toMatch(/recognize this place/i)
    expect(nameQuestion()).not.toMatch(PLACE_TERMS)
    expect(nameExplain('Salvador Pinon Vernal')).not.toMatch(PLACE_TERMS)
  })
})

describe('name Review overlay composition', () => {
  it('gates place presentation on domain === place, not on not-date', () => {
    const overlay = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../AtlasReviewOverlay.tsx'),
      'utf8',
    )
    expect(overlay).not.toMatch(/item\.domain !== ['"]date['"]/)
    expect(overlay).toMatch(/item\.domain === ['"]place['"] && layoutState === ['"]unresolved['"]/)
    expect(overlay).toMatch(/item\.domain === ['"]place['"] && layoutState === ['"]unresolved['"][\s\S]{0,80}unresolvedBody\(\)/)
    expect(overlay).toMatch(/nameSkipAction\(\)/)
    expect(overlay).toMatch(/nameConsequence\(\)/)
    expect(overlay).not.toMatch(/Don’t ask me about this again/)
    expect(overlay).toMatch(/fetchEditStatus\(\)/)
    expect(overlay).toMatch(/unlockNeeded/)
    expect(overlay).toMatch(/atlas-review-close/)
    expect(overlay).toMatch(/PhoneCloseButton/)
    expect(overlay).toMatch(/label=\{closeReview\(\)\}/)
  })
})

describe('Review save lock copy', () => {
  it('asks for the family edit password without place language', () => {
    const blob = `${saveLockedTitle()} ${saveLockedBody()}`
    expect(blob).toMatch(/locked/i)
    expect(blob).toMatch(/password/i)
    expect(blob).not.toMatch(PLACE_TERMS)
  })
})
