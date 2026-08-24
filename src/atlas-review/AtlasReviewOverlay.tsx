import { useEffect, useMemo, useState } from 'react'
import { placeEntityKey, placeSourceSignature, personDateEntityKey, personDateSourceSignature, personNameEntityKey, personNameSourceSignature } from '../overrides/identity'
import { buildPersonDatePayload, isSafeDateCorrection } from '../overrides/applyPersonDateOverrides'
import { buildPersonNamePayload, isSafeNameCorrection } from '../overrides/applyPersonNameOverrides'
import { getFamilyDatabase } from '../family-data/activeFamily'
import { formatAmericanDate } from '../utils/formatDate'
import { upsertOverrideRemote, fetchOverrides } from '../overrides/overrideApi'
import { fetchEditStatus, unlockEditing } from '../utils/mediaApi'
import { diagnosticEntityKey } from '../atlas-health/dev/reviewFindingsModel'
import {
  CUSTOMER_REVIEW_SOURCE,
  type CustomerPlaceChoice,
  type CustomerReviewItem,
  type DateFactSide,
  customerDiagnosticKey,
  dateReviewDiagnosticKey,
} from './selectCustomerReviews'
import {
  cancel,
  candidatesKicker,
  closeReview,
  chooseAnother,
  completeCounts,
  completeNote,
  completeTitle,
  confirmHint,
  dateBothCorrectAction,
  dateBothCorrectHint,
  dateChangeAction,
  dateChangeSideAction,
  dateConflictQuestion,
  dateDismissAction,
  dateEditTitle,
  dateEntryHint,
  dateFactVerb,
  dateKeepAction,
  dateQuestion,
  dateRelatedKicker,
  dateSaveAction,
  dateSkipAction,
  nameConsequence,
  nameEditQuestion,
  nameExplain,
  nameKeepAction,
  nameOriginalLabel,
  nameQuestion,
  nameSaveAction,
  nameSkipAction,
  nameSkipHint,
  nameUseDifferentAction,
  nameUseSuggestedAction,
  dismissAction,
  dismissHint,
  dateFlagConfirm,
  dateFlagDialogTitle,
  flagConfirm,
  flagDialogBody,
  flagDialogTitle,
  introBody,
  introPrimary,
  introSecondary,
  introSummaryLine,
  introTitle,
  itemQuestion,
  progressLabel,
  recommendedKicker,
  returnToAtlas,
  reviewSkipped,
  saveLockedBody,
  saveLockedTitle,
  saveUnlockAction,
  skipAction,
  skipHint,
  sourceKicker,
  unresolvedBody,
  useThisPlace,
  yesRight,
} from './customerReviewCopy'
import { AtlasReviewMapPreview } from './AtlasReviewMapPreview'
import { AtlasReviewPerson } from './AtlasReviewPerson'
import { PhoneCloseButton } from '../components/phone/PhoneSheet'
import { usePhoneOverlayLock } from '../hooks/usePhoneOverlayLock'
import { introBreakdown, presentationState, reviewCandidates } from './reviewPresentation'

type Props = {
  items: CustomerReviewItem[]
  showIntro: boolean
  overlayShown?: boolean
  onIntroConsumed: () => void
  onClose: () => void
  onQueueChanged: () => void
}

type Phase = 'intro' | 'item' | 'complete'
type PendingSave =
  | { kind: 'confirm'; item: CustomerReviewItem; choice: CustomerPlaceChoice }
  | { kind: 'flag'; item: CustomerReviewItem }
  | { kind: 'date-confirm'; item: CustomerReviewItem }
  | { kind: 'date-set'; item: CustomerReviewItem; interpretedRaw: string; side: DateFactSide }
  | { kind: 'date-flag'; item: CustomerReviewItem }
  | { kind: 'date-conflict-confirm'; item: CustomerReviewItem }
  | { kind: 'name-confirm'; item: CustomerReviewItem }
  | { kind: 'name-set'; item: CustomerReviewItem; interpretedRaw: string }

export function AtlasReviewOverlay({
  items,
  showIntro,
  overlayShown = true,
  onIntroConsumed,
  onClose,
  onQueueChanged,
}: Props) {
  usePhoneOverlayLock(overlayShown)
  const [queue, setQueue] = useState(items)
  const [phase, setPhase] = useState<Phase>(showIntro ? 'intro' : queue.length ? 'item' : 'complete')
  const [picking, setPicking] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [flagOpen, setFlagOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [unlockNeeded, setUnlockNeeded] = useState(false)
  const [unlockSecret, setUnlockSecret] = useState('')
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingSave | null>(null)
  const [skippedIds, setSkippedIds] = useState<string[]>([])
  const [doneIds, setDoneIds] = useState<string[]>([])
  const [confirmedCount, setConfirmedCount] = useState(0)
  const [flaggedCount, setFlaggedCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)
  const [replayingSkipped, setReplayingSkipped] = useState(false)
  const [dateDraft, setDateDraft] = useState('')
  const [dateEditing, setDateEditing] = useState(false)
  const [dateError, setDateError] = useState<string | null>(null)
  const [editingSide, setEditingSide] = useState<DateFactSide | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [nameEditing, setNameEditing] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  const total = queue.length
  const breakdown = useMemo(() => introBreakdown(queue), [queue])

  const visible = replayingSkipped
    ? queue.filter((row) => skippedIds.includes(row.id) && !doneIds.includes(row.id))
    : queue.filter((row) => !skippedIds.includes(row.id) && !doneIds.includes(row.id))

  const item = visible[0] ?? null
  const state = item?.domain === 'place' ? presentationState(item) : null
  const layoutState = picking && item?.domain === 'place' ? 'candidates' : state
  const candidates = item?.domain === 'place' ? reviewCandidates(item) : []
  const progressIndex = Math.min(total, doneIds.length + (replayingSkipped ? 0 : skippedIds.length) + (item ? 1 : 0))

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (busy) return
      if (flagOpen) {
        setFlagOpen(false)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, flagOpen, onClose])

  useEffect(() => {
    setQueue(items)
  }, [items])

  useEffect(() => {
    if (phase !== 'item') return
    if (visible.length === 0) setPhase('complete')
  }, [phase, visible.length])

  const ensureCanSave = async (): Promise<boolean> => {
    setUnlockError(null)
    if (await fetchEditStatus()) {
      setUnlockNeeded(false)
      return true
    }
    setUnlockNeeded(true)
    setSaveFailed(false)
    return false
  }

  const handleSaveError = (error: unknown) => {
    const message = error instanceof Error ? error.message : ''
    void fetchEditStatus().then((editing) => {
      if (!editing || /unlock|edit password|edit secret|401/i.test(message)) {
        setUnlockNeeded(true)
        setSaveFailed(false)
        return
      }
      setSaveFailed(true)
      setUnlockNeeded(true)
    })
  }

  const persistConfirm = async (target: CustomerReviewItem, choice: CustomerPlaceChoice) => {
    setBusy(true)
    setSaveFailed(false)
    setPending({ kind: 'confirm', item: target, choice })
    try {
      if (!(await ensureCanSave())) return
      for (const original of target.originals) {
        const fingerprint = placeEntityKey(original)
        await upsertOverrideRemote({
          entityType: 'place',
          entityKey: fingerprint,
          overrideType: 'confirm_resolution',
          source: CUSTOMER_REVIEW_SOURCE,
          sourceSignature: placeSourceSignature(original, choice.canonicalPlaceId),
          reviewState: 'confirmed',
          payload: {
            fingerprint,
            originalExamples: [original],
            canonicalPlaceId: choice.canonicalPlaceId,
            label: choice.label,
            selectionProvenance: 'canonical_selection',
            autoCanonicalPlaceId: target.recommendedCanonicalPlaceId,
          },
        })
        await upsertOverrideRemote({
          entityType: 'diagnostic',
          entityKey: customerDiagnosticKey(original),
          overrideType: 'disposition',
          source: CUSTOMER_REVIEW_SOURCE,
          reviewState: 'confirmed',
          payload: {
            category: CUSTOMER_REVIEW_SOURCE,
            disposition: 'confirmed',
            originalRef: original,
          },
        })
        if (
          target.healthCategory === 'GEOGRAPHIC_CONFLICT' ||
          target.healthCategory === 'RESOLUTION_GAP'
        ) {
          await upsertOverrideRemote({
            entityType: 'diagnostic',
            entityKey: diagnosticEntityKey(original, target.healthCategory),
            overrideType: 'disposition',
            source: CUSTOMER_REVIEW_SOURCE,
            reviewState: 'confirmed',
            payload: {
              category: target.healthCategory,
              disposition: 'confirmed',
              originalRef: original,
            },
          })
        }
      }
      try {
        await fetchOverrides({ status: 'active' })
      } catch {
        /* Override already saved; keep the card moving. */
      }
      setConfirmedCount((n) => n + 1)
      finishItem(target.id, 'confirmed')
    } catch (error) {
      handleSaveError(error)
    } finally {
      setBusy(false)
    }
  }

  const originalDateFor = (target: CustomerReviewItem, side?: DateFactSide) => {
    const field = side?.field ?? (target.dateField === 'death' ? 'death' : 'birth')
    const personId = side?.personId ?? target.personId
    const person = personId
      ? getFamilyDatabase().people.find((row) => row.id === personId)
      : null
    if (field === 'death') return person?.dateSource?.deathDate ?? person?.deathDate ?? side?.dateRaw ?? target.sourceDateRaw ?? ''
    return person?.dateSource?.birthDate ?? person?.birthDate ?? side?.dateRaw ?? target.sourceDateRaw ?? ''
  }

  const singleDateSide = (target: CustomerReviewItem): DateFactSide | null => {
    if (target.dateSides?.[0]) return target.dateSides[0]
    if (!target.personId || !target.dateField) return null
    return {
      personId: target.personId,
      personName: target.personName ?? '',
      field: target.dateField,
      dateRaw: target.sourceDateRaw ?? '',
      overrideKey: personDateEntityKey(target.personId, target.dateField),
    }
  }

  const persistDateConfirm = async (target: CustomerReviewItem) => {
    if (!target.personId || !target.dateField) return
    setBusy(true)
    setSaveFailed(false)
    setPending({ kind: 'date-confirm', item: target })
    try {
      if (!(await ensureCanSave())) return
      const originalRaw = originalDateFor(target)
      const payload = buildPersonDatePayload({
        field: target.dateField,
        originalRaw,
        interpretedRaw: originalRaw,
      })
      await upsertOverrideRemote({
        entityType: 'person',
        entityKey: personDateEntityKey(target.personId, target.dateField),
        overrideType: 'confirm_date',
        source: CUSTOMER_REVIEW_SOURCE,
        sourceSignature: personDateSourceSignature(target.dateField, originalRaw),
        reviewState: 'confirmed',
        payload,
      })
      try {
        await fetchOverrides({ status: 'active' })
      } catch {
        /* Override already saved; keep the card moving. */
      }
      setConfirmedCount((n) => n + 1)
      finishItem(target.id, 'confirmed')
    } catch (error) {
      handleSaveError(error)
    } finally {
      setBusy(false)
    }
  }

  const persistDateSet = async (target: CustomerReviewItem, interpretedRaw: string, side?: DateFactSide) => {
    const targetSide = side ?? singleDateSide(target)
    if (!targetSide) return
    if (!isSafeDateCorrection(interpretedRaw)) {
      setDateError('Please enter a year, month and year, or a full date.')
      return
    }
    setBusy(true)
    setSaveFailed(false)
    setPending({ kind: 'date-set', item: target, interpretedRaw, side: targetSide })
    try {
      if (!(await ensureCanSave())) return
      const originalRaw = originalDateFor(target, targetSide)
      const payload = buildPersonDatePayload({
        field: targetSide.field,
        originalRaw,
        interpretedRaw: interpretedRaw.trim(),
      })
      await upsertOverrideRemote({
        entityType: 'person',
        entityKey: personDateEntityKey(targetSide.personId, targetSide.field),
        overrideType: 'set_date',
        source: CUSTOMER_REVIEW_SOURCE,
        sourceSignature: personDateSourceSignature(targetSide.field, originalRaw),
        reviewState: 'corrected',
        payload,
      })
      try {
        await fetchOverrides({ status: 'active' })
      } catch {
        /* Override already saved; keep the card moving. */
      }
      setConfirmedCount((n) => n + 1)
      setDateEditing(false)
      setEditingSide(null)
      finishItem(target.id, 'confirmed')
    } catch (error) {
      handleSaveError(error)
    } finally {
      setBusy(false)
    }
  }

  const originalNameFor = (target: CustomerReviewItem) => {
    const person = target.personId
      ? getFamilyDatabase().people.find((row) => row.id === target.personId)
      : null
    return person?.nameOverrideSource?.originalDisplay ?? target.sourceNameRaw ?? person?.name ?? target.primaryOriginal
  }

  const persistNameConfirm = async (target: CustomerReviewItem) => {
    if (!target.personId) return
    setBusy(true)
    setSaveFailed(false)
    setPending({ kind: 'name-confirm', item: target })
    try {
      if (!(await ensureCanSave())) return
      const originalRaw = originalNameFor(target)
      await upsertOverrideRemote({
        entityType: 'person',
        entityKey: personNameEntityKey(target.personId),
        overrideType: 'confirm_name',
        source: CUSTOMER_REVIEW_SOURCE,
        sourceSignature: personNameSourceSignature(originalRaw),
        reviewState: 'confirmed',
        payload: buildPersonNamePayload({ originalRaw, interpretedRaw: originalRaw }),
      })
      try {
        await fetchOverrides({ status: 'active' })
      } catch {
        /* Override already saved; keep the card moving. */
      }
      setConfirmedCount((n) => n + 1)
      finishItem(target.id, 'confirmed')
    } catch (error) {
      handleSaveError(error)
    } finally {
      setBusy(false)
    }
  }

  const persistNameSet = async (target: CustomerReviewItem, interpretedRaw: string) => {
    if (!target.personId) return
    if (!isSafeNameCorrection(interpretedRaw)) {
      setNameError('Please enter a name without extra marks like * or #.')
      return
    }
    setBusy(true)
    setSaveFailed(false)
    setPending({ kind: 'name-set', item: target, interpretedRaw })
    try {
      if (!(await ensureCanSave())) return
      const originalRaw = originalNameFor(target)
      await upsertOverrideRemote({
        entityType: 'person',
        entityKey: personNameEntityKey(target.personId),
        overrideType: 'set_name',
        source: CUSTOMER_REVIEW_SOURCE,
        sourceSignature: personNameSourceSignature(originalRaw),
        reviewState: 'corrected',
        payload: buildPersonNamePayload({ originalRaw, interpretedRaw }),
      })
      try {
        await fetchOverrides({ status: 'active' })
      } catch {
        /* Override already saved; keep the card moving. */
      }
      setConfirmedCount((n) => n + 1)
      setNameEditing(false)
      finishItem(target.id, 'confirmed')
    } catch (error) {
      handleSaveError(error)
    } finally {
      setBusy(false)
    }
  }

  const persistConflictConfirm = async (target: CustomerReviewItem) => {
    if (!target.personId) return
    setBusy(true)
    setSaveFailed(false)
    setPending({ kind: 'date-conflict-confirm', item: target })
    try {
      if (!(await ensureCanSave())) return
      await upsertOverrideRemote({
        entityType: 'diagnostic',
        entityKey: dateReviewDiagnosticKey({
          personId: target.personId,
          fact: target.dateField ?? 'birth',
          code: target.findingCode ?? 'date',
          relatedPersonId: target.relatedPersonId ?? undefined,
        }),
        overrideType: 'disposition',
        source: CUSTOMER_REVIEW_SOURCE,
        reviewState: 'confirmed',
        payload: {
          category: CUSTOMER_REVIEW_SOURCE,
          disposition: 'confirmed',
          originalRef: target.sourceDateRaw ?? target.primaryOriginal,
        },
      })
      try {
        await fetchOverrides({ status: 'active' })
      } catch {
        /* Override already saved; keep the card moving. */
      }
      setConfirmedCount((n) => n + 1)
      finishItem(target.id, 'confirmed')
    } catch (error) {
      handleSaveError(error)
    } finally {
      setBusy(false)
    }
  }

  const persistDateFlag = async (target: CustomerReviewItem) => {
    if (!target.personId) return
    setBusy(true)
    setSaveFailed(false)
    setPending({ kind: 'date-flag', item: target })
    try {
      if (!(await ensureCanSave())) return
      await upsertOverrideRemote({
        entityType: 'diagnostic',
        entityKey: dateReviewDiagnosticKey({
          personId: target.personId,
          fact: target.dateField ?? 'birth',
          code: target.findingCode ?? 'date',
          relatedPersonId: target.relatedPersonId ?? undefined,
        }),
        overrideType: 'disposition',
        source: CUSTOMER_REVIEW_SOURCE,
        reviewState: 'ignored',
        payload: {
          category: CUSTOMER_REVIEW_SOURCE,
          disposition: 'ignored',
          originalRef: target.sourceDateRaw ?? target.primaryOriginal,
        },
      })
      try {
        await fetchOverrides({ status: 'active' })
      } catch {
        /* Override already saved; keep the card moving. */
      }
      setFlaggedCount((n) => n + 1)
      setFlagOpen(false)
      finishItem(target.id, 'flagged')
    } catch (error) {
      handleSaveError(error)
    } finally {
      setBusy(false)
    }
  }

  const persistFlag = async (target: CustomerReviewItem) => {
    setBusy(true)
    setSaveFailed(false)
    setPending({ kind: 'flag', item: target })
    try {
      if (!(await ensureCanSave())) return
      for (const original of target.originals) {
        await upsertOverrideRemote({
          entityType: 'diagnostic',
          entityKey: customerDiagnosticKey(original),
          overrideType: 'disposition',
          source: CUSTOMER_REVIEW_SOURCE,
          reviewState: 'ignored',
          payload: {
            category: CUSTOMER_REVIEW_SOURCE,
            disposition: 'ignored',
            originalRef: original,
          },
        })
      }
      try {
        await fetchOverrides({ status: 'active' })
      } catch {
        /* Override already saved; keep the card moving. */
      }
      setFlaggedCount((n) => n + 1)
      setFlagOpen(false)
      finishItem(target.id, 'flagged')
    } catch (error) {
      handleSaveError(error)
    } finally {
      setBusy(false)
    }
  }

  const finishItem = (id: string, how: 'confirmed' | 'flagged' | 'skipped') => {
    setPicking(false)
    setSelectedId(null)
    setPending(null)
    setSaveFailed(false)
    setUnlockNeeded(false)
    setUnlockSecret('')
    setUnlockError(null)
    setFlagOpen(false)
    setDateEditing(false)
    setEditingSide(null)
    setDateDraft('')
    setDateError(null)
    setNameEditing(false)
    setNameDraft('')
    setNameError(null)
    if (how === 'skipped') {
      setSkippedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    } else {
      setDoneIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
      if (replayingSkipped) setSkippedIds((prev) => prev.filter((row) => row !== id))
    }
    onQueueChanged()
  }

  const skip = (target: CustomerReviewItem) => {
    if (busy) return
    setSkippedCount((n) => n + 1)
    finishItem(target.id, 'skipped')
  }

  const retry = () => {
    if (!pending) return
    if (pending.kind === 'confirm') void persistConfirm(pending.item, pending.choice)
    else if (pending.kind === 'flag') void persistFlag(pending.item)
    else if (pending.kind === 'date-confirm') void persistDateConfirm(pending.item)
    else if (pending.kind === 'date-set') void persistDateSet(pending.item, pending.interpretedRaw, pending.side)
    else if (pending.kind === 'date-conflict-confirm') void persistConflictConfirm(pending.item)
    else if (pending.kind === 'name-confirm') void persistNameConfirm(pending.item)
    else if (pending.kind === 'name-set') void persistNameSet(pending.item, pending.interpretedRaw)
    else void persistDateFlag(pending.item)
  }

  const submitUnlock = async () => {
    setUnlockError(null)
    if (await fetchEditStatus()) {
      setUnlockNeeded(false)
      setSaveFailed(false)
      retry()
      return
    }
    const secret = unlockSecret.trim()
    if (!secret) {
      setUnlockError('Enter the family edit password.')
      return
    }
    setBusy(true)
    try {
      await unlockEditing(secret)
      setUnlockNeeded(false)
      setUnlockSecret('')
      setSaveFailed(false)
      setBusy(false)
      retry()
    } catch {
      setUnlockError('That password didn’t work. Please try again.')
      setBusy(false)
    }
  }

  const showMap =
    Boolean(
      item &&
        item.domain === 'place' &&
        layoutState === 'recommended' &&
        item.latitude != null &&
        item.longitude != null &&
        item.recommendedLabel,
    )

  return (
    <div
      className={`atlas-review-scrim${overlayShown ? ' is-open' : ''}`}
      role="presentation"
      onClick={() => {
        if (!busy && !flagOpen) onClose()
      }}
    >
      <section
        className="atlas-review-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="atlas-review-title"
        onClick={(event) => event.stopPropagation()}
      >
        <PhoneCloseButton
          className="atlas-review-close"
          onClick={onClose}
          label={closeReview()}
          disabled={busy}
        />
        {phase === 'intro' ? (
          <>
            <h2 id="atlas-review-title">{introTitle()}</h2>
            <p className="atlas-review-lead">{introBody(total)}</p>
            <ul className="atlas-review-summary">
              {[
                introSummaryLine('unresolved', breakdown.unresolved),
                introSummaryLine('candidates', breakdown.candidates),
                introSummaryLine('recommended', breakdown.recommended),
                introSummaryLine('date', breakdown.dates),
                introSummaryLine('name', breakdown.names),
              ]
                .filter((line): line is string => Boolean(line))
                .map((line) => (
                  <li key={line}>{line}</li>
                ))}
            </ul>
            <div className="atlas-review-actions">
              <button
                type="button"
                className="atlas-review-primary"
                onClick={() => {
                  onIntroConsumed()
                  setPhase(queue.length ? 'item' : 'complete')
                }}
              >
                {introPrimary(total)}
              </button>
              <button type="button" onClick={onClose}>
                {introSecondary()}
              </button>
            </div>
          </>
        ) : null}

        {phase === 'complete' ? (
          <>
            <h2 id="atlas-review-title">{completeTitle()}</h2>
            <ul className="atlas-review-summary">
              {completeCounts(confirmedCount, flaggedCount, skippedCount).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="atlas-review-lead">{completeNote()}</p>
            <div className="atlas-review-actions">
              <button type="button" className="atlas-review-primary" onClick={onClose}>
                {returnToAtlas()}
              </button>
              {skippedIds.length > 0 && !replayingSkipped ? (
                <button
                  type="button"
                  onClick={() => {
                    setReplayingSkipped(true)
                    setPhase('item')
                  }}
                >
                  {reviewSkipped()}
                </button>
              ) : null}
            </div>
          </>
        ) : null}

        {phase === 'item' && item ? (
          <div key={item.id} className="atlas-review-item">
            <p className="atlas-review-progress" aria-live="polite">
              {progressLabel(progressIndex, total)}
            </p>
            <div className="atlas-review-track" aria-hidden="true">
              <span style={{ width: `${Math.round((progressIndex / Math.max(total, 1)) * 100)}%` }} />
            </div>
            <h2 id="atlas-review-title">
              {item.domain === 'name'
                ? nameEditing
                  ? nameEditQuestion()
                  : nameQuestion()
                : item.domain === 'date'
                ? item.dateShape === 'conflict'
                  ? dateConflictQuestion()
                  : dateQuestion()
                : itemQuestion(layoutState ?? 'unresolved')}
            </h2>
            {item.domain === 'date' && item.dateShape === 'conflict' ? null : <AtlasReviewPerson item={item} />}
            {item.domain === 'name' ? (
              nameEditing ? (
                <p className="atlas-review-original">
                  {nameOriginalLabel()}: {item.sourceNameRaw || item.familyWording}
                </p>
              ) : (
                <>
                  <div className="atlas-review-source">
                    <p className="atlas-review-kicker">{sourceKicker()}</p>
                    <blockquote>{item.sourceNameRaw || item.familyWording}</blockquote>
                  </div>
                  <p className="atlas-review-lead">{nameExplain(item.suggestedName)}</p>
                </>
              )
            ) : item.domain === 'date' && item.dateShape === 'conflict' ? (
              <>
                <div className="atlas-review-facts">
                  {(item.dateSides ?? []).map((side) => (
                    <div key={side.overrideKey} className="atlas-review-fact">
                      <p className="atlas-review-fact-name">
                        {side.personName}
                        {side.roleLabel ? <span className="atlas-review-fact-role"> — {side.roleLabel}</span> : null}
                      </p>
                      <p className="atlas-review-place">
                        {dateFactVerb(side.field)} {formatAmericanDate(side.dateRaw) || side.dateRaw}
                      </p>
                    </div>
                  ))}
                </div>
                {item.conflictSummary ? <p className="atlas-review-lead">{item.conflictSummary}</p> : null}
              </>
            ) : item.domain === 'date' ? (
              <>
                <div className="atlas-review-source">
                  <p className="atlas-review-kicker">{sourceKicker()}</p>
                  <blockquote>
                    {item.dateField === 'death' ? 'Died' : 'Born'}{' '}
                    {formatAmericanDate(item.sourceDateRaw || item.familyWording) || item.sourceDateRaw}
                  </blockquote>
                </div>
                {item.relatedLine || (item.relatedPersonName && item.relatedDateRaw) ? (
                  <div className="atlas-review-answer">
                    <p className="atlas-review-kicker">{dateRelatedKicker()}</p>
                    <p className="atlas-review-place">
                      {item.relatedLine ??
                        `${item.relatedPersonName} died ${formatAmericanDate(item.relatedDateRaw) || item.relatedDateRaw}`}
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
            <div className="atlas-review-source">
              <p className="atlas-review-kicker">{sourceKicker()}</p>
              <blockquote>“{item.familyWording}”</blockquote>
            </div>
            )}

            {item.domain === 'place' && layoutState === 'recommended' ? (
              <div className="atlas-review-answer">
                <p className="atlas-review-kicker">{recommendedKicker()}</p>
                <p className="atlas-review-place">{item.recommendedLabel}</p>
                {showMap ? (
                  <AtlasReviewMapPreview
                    latitude={item.latitude!}
                    longitude={item.longitude!}
                    label={item.recommendedLabel!}
                  />
                ) : null}
              </div>
            ) : null}

            {item.domain === 'place' && layoutState === 'candidates' ? (
              <div className="atlas-review-answer">
                <p className="atlas-review-kicker">{candidatesKicker()}</p>
                <ul className="atlas-review-candidates">
                  {candidates.map((choice) => (
                    <li key={choice.canonicalPlaceId}>
                      <button
                        type="button"
                        className={
                          selectedId === choice.canonicalPlaceId
                            ? 'atlas-review-candidate is-selected'
                            : 'atlas-review-candidate'
                        }
                        disabled={busy}
                        onClick={() => setSelectedId(choice.canonicalPlaceId)}
                      >
                        {choice.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {item.domain === 'place' && layoutState === 'unresolved' ? (
              <p className="atlas-review-lead">{unresolvedBody()}</p>
            ) : null}

            {unlockNeeded || saveFailed ? (
              <div className="atlas-review-error" role="alert">
                <strong>{saveLockedTitle()}</strong>
                <p>{saveLockedBody()}</p>
                <label className="atlas-review-kicker" htmlFor="atlas-review-unlock">
                  Family edit password
                </label>
                <input
                  id="atlas-review-unlock"
                  className="atlas-review-input"
                  type="password"
                  autoComplete="current-password"
                  value={unlockSecret}
                  onChange={(event) => {
                    setUnlockSecret(event.target.value)
                    setUnlockError(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void submitUnlock()
                  }}
                />
                {unlockError ? <p className="atlas-review-hint">{unlockError}</p> : null}
                <button
                  type="button"
                  className="atlas-review-primary"
                  disabled={busy}
                  onClick={() => void submitUnlock()}
                >
                  {busy ? 'Saving…' : saveUnlockAction()}
                </button>
              </div>
            ) : null}

            {flagOpen ? (
              <div className="atlas-review-flag">
                <p className="atlas-review-flag-title">
                  {item.domain === 'date'
                    ? dateFlagDialogTitle()
                    : flagDialogTitle(layoutState ?? 'unresolved')}
                </p>
                <p>{flagDialogBody()}</p>
                <div className="atlas-review-actions">
                  <button
                    type="button"
                    className="atlas-review-primary"
                    disabled={busy}
                    onClick={() => void (item.domain === 'date' ? persistDateFlag(item) : persistFlag(item))}
                  >
                    {item.domain === 'date' ? dateFlagConfirm() : flagConfirm(layoutState ?? 'unresolved')}
                  </button>
                  <button type="button" disabled={busy} onClick={() => setFlagOpen(false)}>
                    {cancel()}
                  </button>
                </div>
              </div>
            ) : saveFailed || unlockNeeded ? null : (
              <div className="atlas-review-actions">
                {item.domain === 'name' ? (
                  nameEditing ? (
                    <>
                      <input
                        id="atlas-review-name"
                        className="atlas-review-input"
                        value={nameDraft}
                        onChange={(event) => {
                          setNameDraft(event.target.value)
                          setNameError(null)
                        }}
                        placeholder={item.suggestedName ?? 'Salvador Pinon Vernal'}
                      />
                      {nameError ? <p className="atlas-review-error">{nameError}</p> : null}
                      <button
                        type="button"
                        className="atlas-review-primary"
                        disabled={busy}
                        onClick={() => void persistNameSet(item, nameDraft)}
                      >
                        {busy ? 'Saving…' : nameSaveAction()}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setNameEditing(false)
                          setNameDraft('')
                          setNameError(null)
                        }}
                      >
                        {cancel()}
                      </button>
                      <p className="atlas-review-consequence">{nameConsequence()}</p>
                    </>
                  ) : (
                    <>
                      {item.suggestedName ? (
                        <button
                          type="button"
                          className="atlas-review-primary"
                          disabled={busy}
                          onClick={() => void persistNameSet(item, item.suggestedName!)}
                        >
                          {busy ? 'Saving…' : nameUseSuggestedAction(item.suggestedName)}
                        </button>
                      ) : null}
                      <div className="atlas-review-inline">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setNameDraft(item.suggestedName ?? item.sourceNameRaw ?? '')
                            setNameError(null)
                            setNameEditing(true)
                          }}
                        >
                          {nameUseDifferentAction()}
                        </button>
                        <span aria-hidden="true"> · </span>
                        <button type="button" disabled={busy} onClick={() => void persistNameConfirm(item)}>
                          {busy ? 'Saving…' : nameKeepAction()}
                        </button>
                      </div>
                      <div className="atlas-review-skip">
                        <button type="button" disabled={busy} onClick={() => skip(item)}>
                          {nameSkipAction()}
                        </button>
                        <p className="atlas-review-hint">{nameSkipHint()}</p>
                      </div>
                      <p className="atlas-review-consequence">{nameConsequence()}</p>
                    </>
                  )
                ) : null}
                {item.domain === 'date' && item.dateShape === 'conflict' ? (
                  <>
                    {editingSide ? (
                      <>
                        <p className="atlas-review-kicker">{dateEditTitle(editingSide)}</p>
                        <p className="atlas-review-hint">
                          Currently {dateFactVerb(editingSide.field).toLowerCase()}{' '}
                          {formatAmericanDate(editingSide.dateRaw) || editingSide.dateRaw}
                        </p>
                        <label className="atlas-review-kicker" htmlFor="atlas-review-date">
                          New date
                        </label>
                        <input
                          id="atlas-review-date"
                          className="atlas-review-input"
                          value={dateDraft}
                          onChange={(event) => {
                            setDateDraft(event.target.value)
                            setDateError(null)
                          }}
                          placeholder="1875 or 5 Apr 1875"
                        />
                        <p className="atlas-review-hint">{dateEntryHint()}</p>
                        {dateError ? <p className="atlas-review-error">{dateError}</p> : null}
                        <button
                          type="button"
                          className="atlas-review-primary"
                          disabled={busy}
                          onClick={() => void persistDateSet(item, dateDraft, editingSide)}
                        >
                          {busy ? 'Saving…' : dateSaveAction()}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEditingSide(null)
                            setDateDraft('')
                            setDateError(null)
                          }}
                        >
                          {cancel()}
                        </button>
                      </>
                    ) : (
                      <>
                        {(item.dateSides ?? []).map((side) => (
                          <button
                            key={side.overrideKey}
                            type="button"
                            className="atlas-review-primary"
                            disabled={busy}
                            onClick={() => {
                              setEditingSide(side)
                              setDateDraft('')
                              setDateError(null)
                            }}
                          >
                            {dateChangeSideAction(side)}
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void persistConflictConfirm(item)}
                        >
                          {busy ? 'Saving…' : dateBothCorrectAction()}
                        </button>
                        <p className="atlas-review-hint">{dateBothCorrectHint()}</p>
                        <div className="atlas-review-secondary">
                          <button type="button" disabled={busy} onClick={() => skip(item)}>
                            {dateSkipAction()}
                          </button>
                          <p className="atlas-review-hint">{skipHint('unresolved')}</p>
                        </div>
                      </>
                    )}
                  </>
                ) : null}
                {item.domain === 'date' && item.dateShape !== 'conflict' ? (
                  <>
                    <button
                      type="button"
                      className="atlas-review-primary"
                      disabled={busy}
                      onClick={() => void persistDateConfirm(item)}
                    >
                      {busy ? 'Saving…' : dateKeepAction()}
                    </button>
                    <p className="atlas-review-hint">{confirmHint()}</p>
                    {dateEditing ? (
                      <>
                        <label className="atlas-review-kicker" htmlFor="atlas-review-date">
                          New date
                        </label>
                        <input
                          id="atlas-review-date"
                          className="atlas-review-input"
                          value={dateDraft}
                          onChange={(event) => {
                            setDateDraft(event.target.value)
                            setDateError(null)
                          }}
                          placeholder="1875 or 5 Apr 1875"
                        />
                        <p className="atlas-review-hint">{dateEntryHint()}</p>
                        {dateError ? <p className="atlas-review-error">{dateError}</p> : null}
                        <button
                          type="button"
                          className="atlas-review-primary"
                          disabled={busy}
                          onClick={() => void persistDateSet(item, dateDraft)}
                        >
                          {busy ? 'Saving…' : dateSaveAction()}
                        </button>
                      </>
                    ) : (
                      <button type="button" disabled={busy} onClick={() => setDateEditing(true)}>
                        {dateChangeAction()}
                      </button>
                    )}
                    <div className="atlas-review-secondary">
                      <button type="button" disabled={busy} onClick={() => skip(item)}>
                        {dateSkipAction()}
                      </button>
                      <p className="atlas-review-hint">{skipHint('unresolved')}</p>
                      <button type="button" disabled={busy} onClick={() => setFlagOpen(true)}>
                        {dateDismissAction()}
                      </button>
                      <p className="atlas-review-hint">{dismissHint('unresolved')}</p>
                    </div>
                  </>
                ) : null}
                {item.domain === 'place' && layoutState === 'recommended' && item.recommendedCanonicalPlaceId && item.recommendedLabel ? (
                  <>
                    <button
                      type="button"
                      className="atlas-review-primary"
                      disabled={busy}
                      onClick={() =>
                        void persistConfirm(item, {
                          canonicalPlaceId: item.recommendedCanonicalPlaceId!,
                          label: item.recommendedLabel!,
                          latitude: item.latitude,
                          longitude: item.longitude,
                        })
                      }
                    >
                      {busy ? 'Saving…' : yesRight()}
                    </button>
                    <p className="atlas-review-hint">{confirmHint()}</p>
                  </>
                ) : null}
                {item.domain === 'place' && layoutState === 'recommended' && item.alternatives.length > 0 ? (
                  <button type="button" disabled={busy} onClick={() => setPicking(true)}>
                    {chooseAnother()}
                  </button>
                ) : null}
                {item.domain === 'place' && layoutState === 'candidates' ? (
                  <>
                    <button
                      type="button"
                      className="atlas-review-primary"
                      disabled={busy || !selectedId}
                      onClick={() => {
                        const choice = candidates.find((row) => row.canonicalPlaceId === selectedId)
                        if (choice) void persistConfirm(item, choice)
                      }}
                    >
                      {busy ? 'Saving…' : useThisPlace()}
                    </button>
                    <p className="atlas-review-hint">{confirmHint()}</p>
                  </>
                ) : null}
                {item.domain === 'place' && layoutState ? (
                <div className="atlas-review-secondary">
                  <button type="button" disabled={busy} onClick={() => skip(item)}>
                    {skipAction(layoutState)}
                  </button>
                  <p className="atlas-review-hint">{skipHint(layoutState)}</p>
                  <button type="button" disabled={busy} onClick={() => setFlagOpen(true)}>
                    {dismissAction(layoutState)}
                  </button>
                  <p className="atlas-review-hint">{dismissHint(layoutState)}</p>
                </div>
                ) : null}
                {item.domain === 'place' && picking ? (
                  <button type="button" disabled={busy} onClick={() => setPicking(false)}>
                    {cancel()}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </section>
    </div>
  )
}
