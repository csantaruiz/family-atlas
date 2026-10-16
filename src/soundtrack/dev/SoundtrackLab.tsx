import { useMemo, useState } from 'react'
import { useAmbientSoundtrack } from '../AmbientSoundtrackContext'
import { AMBIENT_TRACKS, isActiveTrack } from '../ambientManifest'
import { SOUNDTRACK_ENVIRONMENTS, type SoundtrackEnvironmentId } from '../context/environments'
import { isSoundtrackLabEnabled } from './soundtrackLabEnabled'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Development / Preview-only panel to audition environments and inspect auto selection. */
export function SoundtrackLab() {
  const enabled = useMemo(() => isSoundtrackLabEnabled(), [])
  const [open, setOpen] = useState(false)
  const {
    wantsSound,
    toggleSound,
    trackId,
    audible,
    previewEnvironment,
    setPreviewEnvironment,
    autoContext,
    schedulerStatus,
    pendingTrackId,
    usingFallback,
  } = useAmbientSoundtrack()

  if (!enabled) return null

  const playing = AMBIENT_TRACKS.find((track) => track.id === trackId)
  const environments = SOUNDTRACK_ENVIRONMENTS.map((environment) => {
    const track = AMBIENT_TRACKS.find(
      (candidate) => candidate.environment === environment.id && isActiveTrack(candidate),
    )
    return { environment, track: track && isActiveTrack(track) ? track : null }
  })

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

          <div className="soundtrack-lab-row">
            <strong>Now playing</strong>
            <span>
              {playing && isActiveTrack(playing)
                ? `${playing.title} — ${playing.artist}`
                : trackId || '—'}
            </span>
            {usingFallback ? <span className="soundtrack-lab-flag">fallback</span> : null}
            {previewEnvironment ? <span className="soundtrack-lab-flag">manual preview</span> : null}
          </div>

          <div className="soundtrack-lab-section">
            <div className="soundtrack-lab-section-head">
              <strong>Environments</strong>
              <button type="button" onClick={() => setPreviewEnvironment(null)} disabled={!previewEnvironment}>
                Return to automatic
              </button>
            </div>
            <ul className="soundtrack-lab-list">
              {environments.map(({ environment, track }) => {
                const active =
                  previewEnvironment === environment.id ||
                  (!previewEnvironment && playing?.environment === environment.id)
                return (
                  <li key={environment.id}>
                    <button
                      type="button"
                      className={`soundtrack-lab-env${active ? ' is-active' : ''}`}
                      disabled={!track}
                      onClick={() => {
                        if (!wantsSound) toggleSound()
                        setPreviewEnvironment(environment.id as SoundtrackEnvironmentId)
                      }}
                    >
                      <span className="soundtrack-lab-env-label">{environment.label}</span>
                      <span className="soundtrack-lab-env-track">
                        {track
                          ? `${track.title} · ${formatDuration(track.rights.durationSec)}`
                          : 'No playable track'}
                      </span>
                      <span className="soundtrack-lab-env-meta">
                        {environment.regions === 'any' ? 'any region' : environment.regions.join(', ')}
                        {' · '}
                        {environment.periods === 'any' ? 'any period' : environment.periods.join(', ')}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="soundtrack-lab-section">
            <strong>Auto context</strong>
            {autoContext ? (
              <dl className="soundtrack-lab-diag">
                <div>
                  <dt>Environment</dt>
                  <dd>{autoContext.environment}</dd>
                </div>
                <div>
                  <dt>Mood</dt>
                  <dd>{autoContext.mood}</dd>
                </div>
                <div>
                  <dt>Period</dt>
                  <dd>{autoContext.period ?? '—'}</dd>
                </div>
                <div>
                  <dt>Region</dt>
                  <dd>{autoContext.region ?? '—'}</dd>
                </div>
                <div>
                  <dt>Reason</dt>
                  <dd>{autoContext.reason}</dd>
                </div>
                <div>
                  <dt>Mode</dt>
                  <dd>
                    {autoContext.overview ? 'overview' : autoContext.explicit ? 'explicit' : 'browse'}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="soundtrack-lab-meta">Waiting for Atlas context…</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
