import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useAmbientSoundtrack } from '../AmbientSoundtrackContext'
import { AMBIENT_TRACKS, MAIN_THEME_ID, isActiveTrack } from '../ambientManifest'
import { authenticityLabel } from '../context/historicalMeta'
import { isSoundtrackLabEnabled } from './soundtrackLabEnabled'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function yearLabel(from: number | null, to: number | null, attestation: number | null): string {
  const range =
    from == null && to == null ? 'no period claim' : `${from ?? '…'}–${to ?? 'present'}`
  const attested = attestation != null ? ` · attested ${attestation}` : ''
  return `${range}${attested}`
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx]
}

type SoundtrackLabPanelProps = {
  open: boolean
  onClose: () => void
  /** Anchor element for desktop popover placement (header audio cluster). */
  anchorRef?: RefObject<HTMLElement | null>
  /** When true, render inline (e.g. inside the Explore menu) instead of a portal. */
  inline?: boolean
}

type PopoverPos = { top: number; left: number; width: number; maxHeight: number }

function measurePopover(anchor: HTMLElement | null): PopoverPos {
  const width = Math.min(380, window.innerWidth - 24)
  const gap = 10
  const padding = 12
  if (!anchor) {
    return {
      top: padding,
      left: Math.max(padding, window.innerWidth - width - padding),
      width,
      maxHeight: Math.min(window.innerHeight - padding * 2, 620),
    }
  }
  const rect = anchor.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom - gap - padding
  const spaceAbove = rect.top - gap - padding
  const preferBelow = spaceBelow >= 280 || spaceBelow >= spaceAbove
  const maxHeight = Math.min(620, preferBelow ? Math.max(240, spaceBelow) : Math.max(240, spaceAbove))
  let left = rect.right - width
  left = Math.min(Math.max(padding, left), window.innerWidth - width - padding)
  const top = preferBelow ? rect.bottom + gap : Math.max(padding, rect.top - gap - maxHeight)
  return { top, left, width, maxHeight }
}

/** Compact Soundtrack Lab flyout — opened from the header audio controls. */
export function SoundtrackLabPanel({ open, onClose, anchorRef, inline = false }: SoundtrackLabPanelProps) {
  const enabled = useMemo(() => isSoundtrackLabEnabled(), [])
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<PopoverPos | null>(null)
  const {
    wantsSound,
    trackId,
    audibleTrackId,
    audible,
    previewTrackId,
    setPreviewTrack,
    autoContext,
    lastChoiceReason,
    lastEligibleCount,
    lastEligibleIds,
    lastRejected,
    schedulerStatus,
    pendingTrackId,
    usingFallback,
    transition,
    lastContextChangeAt,
    resolvedTrackId,
  } = useAmbientSoundtrack()

  useLayoutEffect(() => {
    if (!open || inline) return
    const update = () => setPos(measurePopover(anchorRef?.current ?? null))
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [anchorRef, inline, open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target)) return
      if (anchorRef?.current?.contains(target)) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
    }
  }, [anchorRef, onClose, open])

  if (!enabled || !open) return null

  const playing = AMBIENT_TRACKS.find((track) => track.id === trackId)
  const audibleTrack = AMBIENT_TRACKS.find((track) => track.id === audibleTrackId)
  const playable = AMBIENT_TRACKS.filter(isActiveTrack)
  const gaps = AMBIENT_TRACKS.filter((track) => track.status === 'placeholder')
  const mode = previewTrackId ? 'manual' : 'automatic'
  const contextAgeMs =
    lastContextChangeAt != null ? Math.round(performance.now() - lastContextChangeAt) : null
  const latencies = [...transition.recentLatenciesMs].sort((a, b) => a - b)
  const medianLatency = latencies.length
    ? latencies[Math.floor(latencies.length / 2)]
    : null
  const p95Latency = percentile(latencies, 95)

  const panelStyle: CSSProperties | undefined = inline
    ? undefined
    : pos
      ? {
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          width: pos.width,
          maxHeight: pos.maxHeight,
          zIndex: 1200,
        }
      : { position: 'fixed', visibility: 'hidden' }

  const panel = (
    <div
      ref={panelRef}
      id="atlas-soundtrack-lab"
      className={`soundtrack-lab-panel${inline ? ' is-inline' : ' is-anchored'}`}
      role="dialog"
      aria-label="Soundtrack Lab"
      style={panelStyle}
    >
      <div className="soundtrack-lab-panel-head">
        <div>
          <p className="soundtrack-lab-kicker">Soundtrack Lab</p>
          <p className="soundtrack-lab-meta">
            {audible ? 'audible' : wantsSound ? 'armed' : 'muted'} · {mode} · {schedulerStatus}
            {pendingTrackId ? ` → ${pendingTrackId}` : ''}
          </p>
        </div>
        <button type="button" className="soundtrack-lab-close" onClick={onClose} aria-label="Close Soundtrack Lab">
          Close
        </button>
      </div>

      <div className="soundtrack-lab-body">
        <section className="soundtrack-lab-section">
          <strong>Now playing</strong>
          {playing && isActiveTrack(playing) ? (
            <dl className="soundtrack-lab-diag">
              <div>
                <dt>Track</dt>
                <dd>
                  {playing.title}{' '}
                  {previewTrackId ? <span className="soundtrack-lab-flag">manual</span> : null}
                  {usingFallback ? <span className="soundtrack-lab-flag">fallback</span> : null}
                </dd>
              </div>
              <div>
                <dt>Composer</dt>
                <dd>{playing.history.composer ?? playing.history.tradition ?? playing.artist}</dd>
              </div>
              <div>
                <dt>Period</dt>
                <dd>
                  {yearLabel(
                    playing.history.usableFromYear,
                    playing.history.usableToYear,
                    playing.history.earliestAttestationYear,
                  )}
                </dd>
              </div>
              <div>
                <dt>Origin</dt>
                <dd>{playing.history.geographicOrigin}</dd>
              </div>
              <div>
                <dt>Authenticity</dt>
                <dd>{authenticityLabel(playing.history.authenticity)}</dd>
              </div>
              <div>
                <dt>Why</dt>
                <dd>{lastChoiceReason ?? '—'}</dd>
              </div>
            </dl>
          ) : (
            <p className="soundtrack-lab-meta">Nothing playing yet.</p>
          )}
        </section>

        <section className="soundtrack-lab-section">
          <strong>Automatic context</strong>
          {autoContext ? (
            <dl className="soundtrack-lab-diag">
              <div>
                <dt>Layer</dt>
                <dd>
                  {autoContext.explicit
                    ? 'description-panel override'
                    : autoContext.overview
                      ? 'base Atlas (History Documentary)'
                      : autoContext.precedence}
                </dd>
              </div>
              <div>
                <dt>Subject</dt>
                <dd>{autoContext.focusId ?? 'none (panel closed)'}</dd>
              </div>
              <div>
                <dt>Year</dt>
                <dd>
                  {autoContext.subjectYear ?? '—'}
                  {autoContext.yearSource ? (
                    <span className="soundtrack-lab-meta"> · {autoContext.yearSource}</span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>Region</dt>
                <dd>{autoContext.region ?? '—'}</dd>
              </div>
              <div>
                <dt>Match</dt>
                <dd>
                  {autoContext.precedence} · {autoContext.period ?? '—'} / {autoContext.mood}
                  {usingFallback ? ' · fallback' : ''}
                </dd>
              </div>
              <div>
                <dt>Atlas</dt>
                <dd>{autoContext.reason}</dd>
              </div>
            </dl>
          ) : (
            <p className="soundtrack-lab-meta">Waiting for Atlas context…</p>
          )}
        </section>

        <details className="soundtrack-lab-details">
          <summary>Engine diagnostics</summary>
          <dl className="soundtrack-lab-diag">
            <div>
              <dt>Resolved</dt>
              <dd>{resolvedTrackId ?? '—'}</dd>
            </div>
            <div>
              <dt>Desired</dt>
              <dd>{trackId}</dd>
            </div>
            <div>
              <dt>Audible</dt>
              <dd>{audibleTrack?.title ?? audibleTrackId ?? '—'}</dd>
            </div>
            <div>
              <dt>Base</dt>
              <dd>{MAIN_THEME_ID}</dd>
            </div>
            <div>
              <dt>Override</dt>
              <dd>{previewTrackId ? `manual:${previewTrackId}` : 'automatic'}</dd>
            </div>
            <div>
              <dt>Pending</dt>
              <dd>{pendingTrackId ?? 'none'}</dd>
            </div>
            <div>
              <dt>Context age</dt>
              <dd>{contextAgeMs != null ? `${contextAgeMs} ms` : '—'}</dd>
            </div>
            <div>
              <dt>Readiness</dt>
              <dd>
                {transition.readiness}
                {transition.coldLoad ? ' · cold load' : ' · warm'}
              </dd>
            </div>
            <div>
              <dt>Last latency</dt>
              <dd>
                {transition.selectionToAudibleMs != null
                  ? `${transition.selectionToAudibleMs} ms → audible`
                  : '—'}
                {transition.crossfadeSec != null ? ` · fade ${transition.crossfadeSec}s` : ''}
              </dd>
            </div>
            <div>
              <dt>Samples</dt>
              <dd>
                n={latencies.length}
                {medianLatency != null ? ` · median ${medianLatency} ms` : ''}
                {p95Latency != null ? ` · p95 ${p95Latency} ms` : ''}
              </dd>
            </div>
            <div>
              <dt>Cancel</dt>
              <dd>{transition.lastCancelReason ?? '—'}</dd>
            </div>
            <div>
              <dt>Eligible</dt>
              <dd>
                {lastEligibleCount}: {lastEligibleIds.length ? lastEligibleIds.join(', ') : '—'}
              </dd>
            </div>
          </dl>
          {lastRejected.length > 0 ? (
            <ul className="soundtrack-lab-reject-list">
              {lastRejected.map((entry) => (
                <li key={entry.id}>
                  <span className="soundtrack-lab-env-label">{entry.title}</span>
                  <span className="soundtrack-lab-env-meta">{entry.reason}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {gaps.length > 0 ? (
            <>
              <p className="soundtrack-lab-meta" style={{ marginTop: 10 }}>
                Catalog gaps
              </p>
              <ul className="soundtrack-lab-reject-list">
                {gaps.map((track) => (
                  <li key={track.id}>
                    <span className="soundtrack-lab-env-label">{track.title}</span>
                    <span className="soundtrack-lab-env-meta">{track.brief}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </details>

        <section className="soundtrack-lab-section">
          <div className="soundtrack-lab-section-head">
            <strong>Audition</strong>
            <button type="button" onClick={() => setPreviewTrack(null)} disabled={!previewTrackId}>
              Return to automatic
            </button>
          </div>
          <ul className="soundtrack-lab-list">
            {playable.map((track) => {
              const active = trackId === track.id
              return (
                <li key={track.id}>
                  <button
                    type="button"
                    className={`soundtrack-lab-env${active ? ' is-active' : ''}`}
                    onClick={() => setPreviewTrack(track.id)}
                  >
                    <span className="soundtrack-lab-env-label">{track.title}</span>
                    <span className="soundtrack-lab-env-track">
                      {track.history.composer ?? track.history.tradition ?? track.artist} ·{' '}
                      {formatDuration(track.rights.durationSec)}
                    </span>
                    <span className="soundtrack-lab-env-meta">
                      {yearLabel(
                        track.history.usableFromYear,
                        track.history.usableToYear,
                        track.history.earliestAttestationYear,
                      )}{' '}
                      · {track.history.authenticity} · {track.history.geographicOrigin}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )

  if (inline) return panel
  if (typeof document === 'undefined') return null
  return createPortal(panel, document.body)
}

/** @deprecated Floating entry removed — Lab opens from the header audio control. */
export function SoundtrackLab() {
  return null
}
