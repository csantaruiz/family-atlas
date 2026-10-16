import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useAmbientSoundtrack } from '../AmbientSoundtrackContext'
import { AMBIENT_TRACKS, isActiveTrack } from '../ambientManifest'
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

type SoundtrackLabPanelProps = {
  open: boolean
  onClose: () => void
  /** Anchor for positioning; when omitted the panel uses fixed placement. */
  anchorRef?: RefObject<HTMLElement | null>
}

/** Compact Soundtrack Lab flyout — opened from the header audio controls. */
export function SoundtrackLabPanel({ open, onClose, anchorRef }: SoundtrackLabPanelProps) {
  const enabled = useMemo(() => isSoundtrackLabEnabled(), [])
  const panelRef = useRef<HTMLDivElement>(null)
  const {
    wantsSound,
    trackId,
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
  } = useAmbientSoundtrack()

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
  const playable = AMBIENT_TRACKS.filter(isActiveTrack)
  const gaps = AMBIENT_TRACKS.filter((track) => track.status === 'placeholder')
  const mode = previewTrackId ? 'manual' : 'automatic'

  return (
    <div
      ref={panelRef}
      className="soundtrack-lab-panel"
      role="dialog"
      aria-label="Soundtrack Lab"
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
                <dt>Subject</dt>
                <dd>{autoContext.focusId ?? (autoContext.overview ? 'Atlas overview' : 'timeline')}</dd>
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
          <summary>Diagnostics</summary>
          <dl className="soundtrack-lab-diag">
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
          ) : (
            <p className="soundtrack-lab-meta">No rejections recorded.</p>
          )}
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
}

/** @deprecated Floating entry removed — Lab opens from the header audio control. */
export function SoundtrackLab() {
  return null
}
