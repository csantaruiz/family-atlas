import { useMemo, useState } from 'react'
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

/** Development / Preview-only panel for auditioning and historical transparency. */
export function SoundtrackLab() {
  const enabled = useMemo(() => isSoundtrackLabEnabled(), [])
  const [open, setOpen] = useState(false)
  const {
    wantsSound,
    toggleSound,
    trackId,
    audible,
    previewTrackId,
    setPreviewTrack,
    autoContext,
    lastChoiceReason,
    lastEligibleCount,
    schedulerStatus,
    pendingTrackId,
    usingFallback,
  } = useAmbientSoundtrack()

  if (!enabled) return null

  const playing = AMBIENT_TRACKS.find((track) => track.id === trackId)
  const playable = AMBIENT_TRACKS.filter(isActiveTrack)
  const gaps = AMBIENT_TRACKS.filter((track) => track.status === 'placeholder')

  return (
    <div className={`soundtrack-lab${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="soundtrack-lab-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Soundtrack Lab
      </button>
      {open ? (
        <div className="soundtrack-lab-panel" role="region" aria-label="Soundtrack preview">
          <div className="soundtrack-lab-row">
            <strong>Playback</strong>
            <button type="button" onClick={toggleSound}>
              {wantsSound ? 'Mute' : 'Enable sound'}
            </button>
            <span className="soundtrack-lab-meta">
              {audible ? 'audible' : wantsSound ? 'armed' : 'off'} · {schedulerStatus}
              {pendingTrackId ? ` → ${pendingTrackId}` : ''}
            </span>
          </div>

          <div className="soundtrack-lab-section">
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
                  <dt>Composer / tradition</dt>
                  <dd>{playing.history.composer ?? playing.history.tradition ?? playing.artist}</dd>
                </div>
                <div>
                  <dt>Historical dates</dt>
                  <dd>
                    {yearLabel(
                      playing.history.usableFromYear,
                      playing.history.usableToYear,
                      playing.history.earliestAttestationYear,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Geographic origin</dt>
                  <dd>{playing.history.geographicOrigin}</dd>
                </div>
                <div>
                  <dt>Authenticity</dt>
                  <dd>{authenticityLabel(playing.history.authenticity)}</dd>
                </div>
                <div>
                  <dt>Confidence</dt>
                  <dd>{playing.history.confidence}</dd>
                </div>
                <div>
                  <dt>Why selected</dt>
                  <dd>{lastChoiceReason ?? '—'}</dd>
                </div>
                <div>
                  <dt>Eligible alternatives</dt>
                  <dd>{lastEligibleCount}</dd>
                </div>
              </dl>
            ) : (
              <p className="soundtrack-lab-meta">Nothing playing yet.</p>
            )}
          </div>

          <div className="soundtrack-lab-section">
            <strong>Auto context</strong>
            {autoContext ? (
              <dl className="soundtrack-lab-diag">
                <div>
                  <dt>Subject year</dt>
                  <dd>{autoContext.subjectYear ?? '—'}</dd>
                </div>
                <div>
                  <dt>Region</dt>
                  <dd>{autoContext.region ?? '—'}</dd>
                </div>
                <div>
                  <dt>Period / mood</dt>
                  <dd>
                    {autoContext.period ?? '—'} / {autoContext.mood}
                  </dd>
                </div>
                <div>
                  <dt>Precedence</dt>
                  <dd>{autoContext.precedence}</dd>
                </div>
                <div>
                  <dt>Atlas reason</dt>
                  <dd>{autoContext.reason}</dd>
                </div>
              </dl>
            ) : (
              <p className="soundtrack-lab-meta">Waiting for Atlas context…</p>
            )}
          </div>

          <div className="soundtrack-lab-section">
            <div className="soundtrack-lab-section-head">
              <strong>Audition ({playable.length} playable)</strong>
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
                      onClick={() => {
                        if (!wantsSound) toggleSound()
                        setPreviewTrack(track.id)
                      }}
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
                        · {track.history.authenticity} · {track.history.confidence} ·{' '}
                        {track.history.geographicOrigin}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          {gaps.length > 0 ? (
            <div className="soundtrack-lab-section">
              <strong>Documented coverage gaps</strong>
              <ul className="soundtrack-lab-list">
                {gaps.map((track) => (
                  <li key={track.id}>
                    <div className="soundtrack-lab-env">
                      <span className="soundtrack-lab-env-label">{track.title}</span>
                      <span className="soundtrack-lab-env-track">{track.brief}</span>
                      <span className="soundtrack-lab-env-meta">
                        {yearLabel(
                          track.history.usableFromYear,
                          track.history.usableToYear,
                          track.history.earliestAttestationYear,
                        )}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
