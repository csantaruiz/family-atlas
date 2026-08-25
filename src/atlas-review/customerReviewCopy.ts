import type { CustomerReviewItem, DateFactSide } from './selectCustomerReviews'
import type { ReviewPresentationState } from './reviewPresentation'

export function introTitle(): string {
  return 'A few details could use your help'
}

/** Quiet header shortcut. Hidden entirely when count is 0. */
export function reviewShortcutLabel(count: number): string {
  return count === 1 ? '1 item to review' : `${count} items to review`
}

export function reviewMenuHint(count: number): string | null {
  if (count <= 0) return null
  return count === 1 ? '1 item needs your help' : `${count} items need your help`
}

export function reviewMenuCount(count: number): string | null {
  if (count <= 0) return null
  return String(count)
}

/** Gear-menu row on tablet/desktop — not shown as header text. */
export function reviewMenuItemLabel(count: number): string {
  if (count <= 0) return 'Atlas Review'
  return count === 1 ? 'Atlas Review — 1 item' : `Atlas Review — ${count} items`
}

export function reviewGearAriaLabel(count: number, fallback: string): string {
  if (count <= 0) return fallback
  return count === 1 ? '1 Atlas Review item' : `${count} Atlas Review items`
}

export function introBody(count: number): string {
  const n = count === 1 ? '1 detail' : `${count} details`
  return `Family records are sometimes abbreviated, misspelled, or contradictory. We found ${n} where your knowledge may help make the Atlas more accurate.`
}

export function introSummaryLine(
  kind: ReviewPresentationState | 'date' | 'name',
  count: number,
): string | null {
  if (count <= 0) return null
  if (kind === 'date') {
    return count === 1 ? '1 family date that may need a closer look' : `${count} family dates that may need a closer look`
  }
  if (kind === 'name') {
    return count === 1 ? '1 name that may need a quick check' : `${count} names that may need a quick check`
  }
  if (kind === 'unresolved') {
    return count === 1 ? '1 place we couldn’t identify' : `${count} places we couldn’t identify`
  }
  if (kind === 'candidates') {
    return count === 1
      ? '1 place with more than one possible match'
      : `${count} places with more than one possible match`
  }
  return count === 1 ? '1 detail we’d like you to confirm' : `${count} details we’d like you to confirm`
}

export function introPrimary(count: number): string {
  return count === 1 ? 'Review 1 detail' : `Review ${count} details`
}

export function introSecondary(): string {
  return 'Maybe later'
}

export function closeReview(): string {
  return 'Close'
}

export function progressLabel(index: number, total: number): string {
  return `${index} of ${total}`
}

export function itemQuestion(state: ReviewPresentationState): string {
  if (state === 'recommended') return 'Is this the right place?'
  if (state === 'candidates') return 'Which place does your family record mean?'
  return 'Do you recognize this place?'
}

export function sourceKicker(): string {
  return 'Your family record says'
}

export function recommendedKicker(): string {
  return 'We think this is'
}

export function candidatesKicker(): string {
  return 'We found a few possible matches'
}

export function unresolvedBody(): string {
  return 'We couldn’t identify where this refers to.'
}

export function yesRight(): string {
  return 'Yes, that’s right'
}

export function confirmHint(): string {
  return 'This won’t change the original family record.'
}

export function chooseAnother(): string {
  return 'Choose another place'
}

export function useThisPlace(): string {
  return 'Use this place'
}

export function skipAction(state: ReviewPresentationState): string {
  return state === 'unresolved' ? 'I don’t recognize this place' : 'I’m not sure'
}

export function skipHint(state: ReviewPresentationState): string {
  return state === 'unresolved'
    ? 'We’ll leave it unresolved and may ask again later.'
    : 'We’ll ask again later.'
}

export function dismissAction(state: ReviewPresentationState): string {
  if (state === 'unresolved') return 'Don’t ask me about this again'
  if (state === 'candidates') return 'None of these'
  return 'That’s not the right place'
}

export function dismissHint(state: ReviewPresentationState): string {
  if (state === 'unresolved') {
    return 'Remove this from Atlas Review. Your original family record won’t be changed.'
  }
  return 'We’ll stop asking. Your original family record won’t be changed.'
}

export function flagDialogTitle(state: ReviewPresentationState): string {
  if (state === 'unresolved') return 'Stop asking about this place?'
  if (state === 'candidates') return 'None of these places are right?'
  return 'This isn’t the right place?'
}

export function dateFlagDialogTitle(): string {
  return 'Stop asking about this date?'
}

export function dateFlagConfirm(): string {
  return 'Don’t ask again'
}

export function flagDialogBody(): string {
  return 'We’ll remove this from Atlas Review. Your original family record won’t be changed.'
}

export function flagConfirm(state: ReviewPresentationState): string {
  return state === 'unresolved' ? 'Don’t ask again' : 'Stop asking about this'
}

export function cancel(): string {
  return 'Cancel'
}

export function saveErrorTitle(): string {
  return 'We couldn’t save that yet.'
}

export function saveErrorBody(): string {
  return 'Your family record has not been changed. Please try again.'
}

export function saveLockedTitle(): string {
  return 'This Atlas is locked.'
}

export function saveLockedBody(): string {
  return 'Enter the family edit password to save. Your family record has not been changed.'
}

export function saveUnlockAction(): string {
  return 'Unlock and save'
}

export function tryAgain(): string {
  return 'Try again'
}

export function completeTitle(): string {
  return 'Thanks — your Atlas knows a little more now.'
}

export function completeCounts(confirmed: number, flagged: number, skipped: number): string[] {
  const lines: string[] = []
  if (confirmed > 0) {
    lines.push(confirmed === 1 ? '1 detail confirmed' : `${confirmed} details confirmed`)
  }
  if (flagged > 0) {
    lines.push(flagged === 1 ? '1 we won’t ask about again' : `${flagged} we won’t ask about again`)
  }
  if (skipped > 0) {
    lines.push(skipped === 1 ? '1 skipped' : `${skipped} skipped`)
  }
  if (lines.length === 0) return ['Nothing was changed this time.']
  return lines
}

export function completeNote(): string {
  return 'Your original family records were left unchanged.'
}

export function returnToAtlas(): string {
  return 'Return to the Atlas'
}

export function reviewSkipped(): string {
  return 'Review skipped items'
}

export function dateQuestion(): string {
  return 'This date may need a closer look'
}

export function dateConflictQuestion(): string {
  return 'These two dates don’t seem to agree'
}

export function dateBothCorrectAction(): string {
  return 'I believe both dates are correct'
}

export function dateBothCorrectHint(): string {
  return 'We’ll stop asking. Neither date will be changed.'
}

export function dateChangeSideAction(side: DateFactSide): string {
  const who = givenName(side.personName)
  const fact = side.field === 'death' ? 'death' : 'birth'
  return `Change ${possessiveName(who)} ${fact} date`
}

export function dateEditTitle(side: DateFactSide): string {
  const fact = side.field === 'death' ? 'death' : 'birth'
  return `Change ${possessiveName(side.personName)} ${fact} date`
}

export function dateFactVerb(field: 'birth' | 'death'): string {
  return field === 'death' ? 'Died' : 'Born'
}

function givenName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

function possessiveName(name: string): string {
  const trimmed = name.trim()
  return /s$/i.test(trimmed) ? `${trimmed}’` : `${trimmed}’s`
}

export function dateKeepAction(): string {
  return 'Keep this date'
}

export function dateChangeAction(): string {
  return 'Change this date'
}

export function dateSaveAction(): string {
  return 'Save new date'
}

export function dateEntryHint(): string {
  return 'You can enter a year, month and year, or a full date. About, before, and after are fine.'
}

export function dateRelatedKicker(): string {
  return 'Another family record says'
}

export function dateSkipAction(): string {
  return 'I’m not sure'
}

export function dateDismissAction(): string {
  return 'Don’t ask again'
}

export function nameQuestion(): string {
  return 'This name may need a quick check'
}

export function nameExplain(suggested: string | null | undefined): string {
  if (suggested) {
    return `This name includes an unusual character. Did your family record mean “${suggested}”?`
  }
  return 'This name includes an unusual character.'
}

export function nameUseSuggestedAction(suggested: string): string {
  return `Use ${suggested}`
}

export function nameUseDifferentAction(): string {
  return 'Enter a different name'
}

export function nameKeepAction(): string {
  return 'Keep as written'
}

export function nameEntryHint(): string {
  return 'Enter the name as your family knows it.'
}

export function nameSaveAction(): string {
  return 'Save name'
}

export function nameEditQuestion(): string {
  return 'How should this name appear?'
}

export function nameOriginalLabel(): string {
  return 'Original family record'
}

export function nameSkipAction(): string {
  return 'I’m not sure'
}

export function nameSkipHint(): string {
  return 'Skip for now. We may ask again later.'
}

export function nameConsequence(): string {
  return 'This changes how the name appears in your Atlas. Your original family record stays unchanged.'
}

/** Every customer-facing string a name Review card can show. Place copy must never appear here. */
export function nameReviewCustomerCopy(item: CustomerReviewItem): string[] {
  const original = item.sourceNameRaw || item.familyWording
  return [
    nameQuestion(),
    item.personName,
    eventStoryLine(item),
    sourceKicker(),
    original,
    nameExplain(item.suggestedName),
    item.suggestedName ? nameUseSuggestedAction(item.suggestedName) : '',
    nameUseDifferentAction(),
    nameKeepAction(),
    nameSkipAction(),
    nameSkipHint(),
    nameConsequence(),
    nameEditQuestion(),
    `${nameOriginalLabel()}: ${original}`,
    nameSaveAction(),
    introSummaryLine('name', 1),
  ].filter((line): line is string => Boolean(line))
}

export function eventStoryLine(item: CustomerReviewItem): string {
  if (item.domain === 'name') return 'Name'
  if (item.domain === 'date') {
    if (item.dateShape === 'conflict' && item.dateSides && item.dateSides.length >= 2) {
      return 'Two dates that don’t agree'
    }
    const field = item.dateField === 'death' ? 'Death' : 'Birth'
    const raw = item.sourceDateRaw
    return raw ? `${field} · ${raw}` : field
  }
  const kind = formatEventKind(item.eventKind) ?? formatRole(item.personRole)
  const year = item.eventYear
  if (kind && year) return `${kind} · ${year}`
  if (kind) return kind
  if (year) return String(year)
  return 'Place on record'
}

function formatEventKind(kind: string | null): string | null {
  if (!kind) return null
  const map: Record<string, string> = {
    birth: 'Birth',
    death: 'Death',
    marriage: 'Marriage',
    move: 'Move',
  }
  return map[kind] ?? `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`
}

function formatRole(role: string | null): string | null {
  if (!role) return null
  if (role === 'birth place') return 'Birth'
  if (role === 'death place') return 'Death'
  return 'Place on record'
}
