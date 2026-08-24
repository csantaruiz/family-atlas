import { useEffect, useMemo, useState } from 'react'
import { placeEntityKey, placeSourceSignature } from '../../overrides/identity'
import { upsertOverrideRemote, fetchOverrides } from '../../overrides/overrideApi'
import { buildPlaceResolutionRecord } from '../placeResolution'
import {
  buildPlainFindingCopy,
  buildReviewQueue,
  describePlaceContext,
  diagnosticEntityKey,
  reviewFindingKey,
  surfaceImpactNote,
  type PriorityFinding,
} from './reviewFindingsModel'
import type { AtlasHealthReport } from '../types'

type Props = {
  report: AtlasHealthReport
  /** Bump parent Health memo / place refresh after durable save. */
  onPersisted: () => void
  onOpenPlaceTab: (original: string) => void
  onExit: () => void
}

/**
 * DEV-only (?atlasDebug=1) one-at-a-time review harness over Phase 2B overrides.
 * Confirm / Ignore require successful /api/overrides writes — no silent local success.
 */
export function ReviewFindingsPanel({ report, onPersisted, onOpenPlaceTab, onExit }: Props) {
  /** Keys removed immediately after a successful Confirm/Ignore (before Health re-aggregate). */
  const [handledKeys, setHandledKeys] = useState<string[]>([])
  const [queueEpoch, setQueueEpoch] = useState(0)
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [techOpen, setTechOpen] = useState(false)

  const queue = useMemo(() => {
    const handled = new Set(handledKeys)
    return buildReviewQueue(report).filter((f) => !handled.has(reviewFindingKey(f)))
    // queueEpoch forces recompute after cache seed even if report reference is stale
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, handledKeys, queueEpoch])

  useEffect(() => {
    setIndex((i) => (queue.length === 0 ? 0 : Math.min(i, queue.length - 1)))
  }, [queue])

  const finding: PriorityFinding | null = queue[index] ?? null
  const copy = finding ? buildPlainFindingCopy(finding) : null
  const context = finding ? describePlaceContext(finding.original) : null
  const techRecord = finding ? buildPlaceResolutionRecord(finding.original) : null

  const afterSuccessfulWrite = (actedOn: PriorityFinding, action: 'confirmed' | 'ignored') => {
    const key = reviewFindingKey(actedOn)
    const remaining = queue.filter((f) => reviewFindingKey(f) !== key)
    const next = remaining[Math.min(index, Math.max(0, remaining.length - 1))]

    setHandledKeys((prev) => (prev.includes(key) ? prev : [...prev, key]))
    setQueueEpoch((n) => n + 1)
    setTechOpen(false)
    setError(null)
    setStatus(
      action === 'confirmed'
        ? `Saved confirmation for “${actedOn.original}”.${
            next ? ` Next: “${next.original}”.` : ' No priority findings left.'
          }`
        : `Ignored “${actedOn.original}”.${
            next ? ` Next: “${next.original}”.` : ' No priority findings left.'
          }`,
    )
    onPersisted()
  }

  const confirm = async () => {
    if (!finding || !copy?.recommendedCanonicalPlaceId) return
    const actedOn = finding
    const recommendedId = copy.recommendedCanonicalPlaceId
    const recommendedLabel = copy.recommendedLabel
    setBusy(true)
    setError(null)
    setStatus('Saving confirmation…')
    try {
      const fingerprint = placeEntityKey(actedOn.original)
      await upsertOverrideRemote({
        entityType: 'place',
        entityKey: fingerprint,
        overrideType: 'confirm_resolution',
        source: 'atlas-debug-review',
        sourceSignature: placeSourceSignature(actedOn.original, recommendedId),
        reviewState: 'confirmed',
        payload: {
          fingerprint,
          originalExamples: [actedOn.original],
          canonicalPlaceId: recommendedId,
          label: recommendedLabel ?? undefined,
          selectionProvenance: 'canonical_selection',
          autoCanonicalPlaceId: recommendedId,
        },
      })
      // Also mark this Health finding so the queue drops even if place fingerprint lookup lags
      await upsertOverrideRemote({
        entityType: 'diagnostic',
        entityKey: diagnosticEntityKey(actedOn.original, actedOn.category),
        overrideType: 'disposition',
        source: 'atlas-debug-review',
        reviewState: 'confirmed',
        payload: {
          category: actedOn.category,
          disposition: 'confirmed',
          originalRef: actedOn.original,
        },
      })
      await fetchOverrides({ status: 'active' })
      afterSuccessfulWrite(actedOn, 'confirmed')
    } catch (err) {
      setStatus(null)
      setError(
        err instanceof Error
          ? `Save failed — finding left unresolved. ${err.message}`
          : 'Save failed — finding left unresolved.',
      )
    } finally {
      setBusy(false)
    }
  }

  const ignore = async () => {
    if (!finding) return
    const actedOn = finding
    setBusy(true)
    setError(null)
    setStatus('Saving ignore…')
    try {
      await upsertOverrideRemote({
        entityType: 'diagnostic',
        entityKey: diagnosticEntityKey(actedOn.original, actedOn.category),
        overrideType: 'disposition',
        source: 'atlas-debug-review',
        reviewState: 'ignored',
        payload: {
          category: actedOn.category,
          disposition: 'ignored',
          originalRef: actedOn.original,
        },
      })
      await fetchOverrides({ status: 'active' })
      afterSuccessfulWrite(actedOn, 'ignored')
    } catch (err) {
      setStatus(null)
      setError(
        err instanceof Error
          ? `Save failed — finding left unresolved. ${err.message}`
          : 'Save failed — finding left unresolved.',
      )
    } finally {
      setBusy(false)
    }
  }

  const skip = () => {
    setError(null)
    setStatus(null)
    if (index < queue.length - 1) setIndex(index + 1)
  }

  if (!finding || !copy || !context) {
    return (
      <div className="atlas-debug-block atlas-review">
        {status ? <p className="atlas-review-status">{status}</p> : null}
        <p>No remaining priority findings to review.</p>
        <p className="atlas-debug-muted">
          Geographic conflicts and resolution gaps that are still open appear here. Precision and
          confidence-only items stay on the Health summary.
        </p>
        <div className="atlas-debug-actions">
          <button type="button" onClick={onExit}>
            Back to Health summary
          </button>
        </div>
      </div>
    )
  }

  const affectedPeople =
    context.people.length === 0
      ? 'No person record matched this exact place string.'
      : context.people
          .slice(0, 6)
          .map((p) => `${p.name} (${p.role})`)
          .join('; ') + (context.people.length > 6 ? ` · +${context.people.length - 6} more` : '')

  const affectedEvents =
    context.events.length === 0 && context.marriages.length === 0
      ? null
      : [
          ...context.events.map((e) => `${e.year} ${e.kind}: ${e.personName}`),
          ...context.marriages.map((m) => m.summary),
        ]
          .slice(0, 4)
          .join('; ')

  return (
    <div className="atlas-debug-block atlas-review">
      <div className="atlas-review-progress">
        <strong>
          {index + 1} of {queue.length} remaining
        </strong>
        <span className="atlas-debug-muted">
          {' '}
          · {finding.category.replace(/_/g, ' ').toLowerCase()}
          {handledKeys.length ? ` · ${handledKeys.length} handled this session` : ''}
        </span>
      </div>

      {status ? <p className="atlas-review-status">{status}</p> : null}
      {error ? <p className="atlas-debug-danger">{error}</p> : null}

      <dl className="atlas-debug-dl atlas-review-plain">
        <dt>What may be wrong</dt>
        <dd>{copy.whatMayBeWrong}</dd>
        <dt>Exact GEDCOM place string</dt>
        <dd>
          <code className="atlas-review-gedcom">{finding.original}</code>
          <div className="atlas-debug-muted atlas-review-hint">
            Each spelling is its own finding. Confirming this one does not auto-clear similar
            Gloucester / San Jose variants.
          </div>
        </dd>
        <dt>Who it affects</dt>
        <dd>
          {affectedPeople}
          {affectedEvents ? (
            <>
              <br />
              <span className="atlas-debug-muted">Events: {affectedEvents}</span>
            </>
          ) : null}
        </dd>
        <dt>Atlas recommendation</dt>
        <dd>{copy.recommendation}</dd>
        <dt>Why flagged</dt>
        <dd>{copy.whyFlagged}</dd>
        <dt>Experiences that could be affected</dt>
        <dd>{surfaceImpactNote(copy.surfaces)}</dd>
      </dl>

      <div className="atlas-debug-actions atlas-review-nav">
        <button type="button" disabled={busy || index <= 0} onClick={() => setIndex(index - 1)}>
          Previous
        </button>
        <button
          type="button"
          disabled={busy || index >= queue.length - 1}
          onClick={() => {
            setStatus(null)
            setIndex(index + 1)
          }}
        >
          Next
        </button>
      </div>

      <div className="atlas-debug-actions">
        <button type="button" disabled={busy || !copy.canConfirm} onClick={() => void confirm()}>
          {busy ? 'Saving…' : 'Confirm recommendation'}
        </button>
        <button type="button" disabled={busy} onClick={skip}>
          Not sure / Skip
        </button>
        <button type="button" disabled={busy} onClick={() => void ignore()}>
          Ignore finding
        </button>
      </div>
      {!copy.canConfirm && copy.confirmDisabledReason ? (
        <p className="atlas-debug-muted">{copy.confirmDisabledReason}</p>
      ) : null}

      <details
        className="atlas-review-tech"
        open={techOpen}
        onToggle={(e) => setTechOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary>View technical details</summary>
        {techRecord ? (
          <dl className="atlas-debug-dl">
            <dt>Normalized</dt>
            <dd>{techRecord.normalized || '—'}</dd>
            <dt>Explore (legacy)</dt>
            <dd>
              {techRecord.explore.label ?? '—'} · {techRecord.explore.method} ·{' '}
              {techRecord.explore.confidence}
            </dd>
            <dt>Documentary (legacy)</dt>
            <dd>
              {techRecord.documentary.label ?? '—'}
              {techRecord.documentary.canonicalId
                ? ` (${techRecord.documentary.canonicalId})`
                : ''}{' '}
              · {techRecord.documentary.method} · {techRecord.documentary.confidence}
            </dd>
            <dt>Unified</dt>
            <dd>
              {techRecord.unified.status === 'resolved' || techRecord.unified.status === 'coarse'
                ? techRecord.unified.label
                : techRecord.unified.status}{' '}
              · {techRecord.unified.method} · {techRecord.unified.confidence}
            </dd>
            <dt>Comparison</dt>
            <dd>
              {techRecord.comparison.category}: {techRecord.comparison.summary}
            </dd>
          </dl>
        ) : null}
        <button
          type="button"
          className="atlas-debug-action"
          onClick={() => onOpenPlaceTab(finding.original)}
        >
          Open full Place debugger
        </button>
      </details>

      <div className="atlas-debug-actions">
        <button type="button" disabled={busy} onClick={onExit}>
          Back to Health summary
        </button>
      </div>
    </div>
  )
}
