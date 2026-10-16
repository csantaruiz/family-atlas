import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useAmbientSoundtrack } from '../AmbientSoundtrackContext'
import { AMBIENT_TRACKS, isActiveTrack } from '../ambientManifest'
import { isSoundtrackLabEnabled } from './soundtrackLabEnabled'
import { connectionSentence, shortStyleDescriptor } from './connectionSentence'

type SoundtrackLabPanelProps = {
  open: boolean
  onClose: () => void
  anchorRef?: RefObject<HTMLElement | null>
  inline?: boolean
}

type PopoverPos = { top: number; left: number; width: number; maxHeight: number }

function measurePopover(anchor: HTMLElement | null): PopoverPos {
  const width = Math.min(360, window.innerWidth - 24)
  const gap = 10
  const padding = 12
  if (!anchor) {
    return {
      top: padding,
      left: Math.max(padding, window.innerWidth - width - padding),
      width,
      maxHeight: Math.min(window.innerHeight - padding * 2, 480),
    }
  }
  const rect = anchor.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom - gap - padding
  const spaceAbove = rect.top - gap - padding
  const preferBelow = spaceBelow >= 220 || spaceBelow >= spaceAbove
  const maxHeight = Math.min(480, preferBelow ? Math.max(200, spaceBelow) : Math.max(200, spaceAbove))
  let left = rect.right - width
  left = Math.min(Math.max(padding, left), window.innerWidth - width - padding)
  const top = preferBelow ? rect.bottom + gap : Math.max(padding, rect.top - gap - maxHeight)
  return { top, left, width, maxHeight }
}

function debugModeEnabled(): boolean {
  try {
    return localStorage.getItem('atlas-soundtrack-debug') === '1'
  } catch {
    return false
  }
}

function MusicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 18V6l12-2v12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="19" cy="16" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/** Visitor-facing soundtrack popover — "The Atlas Soundtrack". */
export function SoundtrackLabPanel({ open, onClose, anchorRef, inline = false }: SoundtrackLabPanelProps) {
  const enabled = useMemo(() => isSoundtrackLabEnabled(), [])
  const showDebug = useMemo(() => debugModeEnabled(), [])
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<PopoverPos | null>(null)
  const [browseOpen, setBrowseOpen] = useState(false)
  const {
    trackId,
    audibleTrackId,
    previewTrackId,
    setPreviewTrack,
    autoContext,
    usingFallback,
    matchKind,
    transition,
    lastChoiceReason,
    schedulerStatus,
    pendingTrackId,
    resolvedTrackId,
    lastEligibleIds,
    lastRejected,
    wantsSound,
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
    if (!open) {
      setBrowseOpen(false)
      return
    }
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
  const connection = connectionSentence(
    playing && isActiveTrack(playing) ? playing : undefined,
    autoContext,
    usingFallback,
  )

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
      className={`atlas-soundtrack-popover${inline ? ' is-inline' : ' is-anchored'}`}
      role="dialog"
      aria-label="The Atlas Soundtrack"
      style={panelStyle}
    >
      <header className="atlas-soundtrack-popover-head">
        <div className="atlas-soundtrack-popover-brand">
          <span className="atlas-soundtrack-popover-icon">
            <MusicIcon />
          </span>
          <h2 className="atlas-soundtrack-popover-title">The Atlas Soundtrack</h2>
        </div>
        <button type="button" className="atlas-soundtrack-popover-close" onClick={onClose} aria-label="Close">
          Close
        </button>
      </header>

      <div className="atlas-soundtrack-popover-body">
        <section className="atlas-soundtrack-block">
          <p className="atlas-soundtrack-kicker">Now playing</p>
          {playing && isActiveTrack(playing) ? (
            <>
              <h3 className="atlas-soundtrack-track-title">{playing.title}</h3>
              <p className="atlas-soundtrack-track-meta">
                {playing.history.composer ?? playing.history.tradition ?? playing.artist}
              </p>
              <p className="atlas-soundtrack-track-style">{shortStyleDescriptor(playing)}</p>
              {previewTrackId ? <p className="atlas-soundtrack-note">Manual audition</p> : null}
            </>
          ) : (
            <p className="atlas-soundtrack-track-meta">Nothing playing yet.</p>
          )}
        </section>

        <section className="atlas-soundtrack-block">
          <p className="atlas-soundtrack-kicker">Historical connection</p>
          <p className="atlas-soundtrack-connection">{connection}</p>
        </section>

        <section className="atlas-soundtrack-block atlas-soundtrack-browse">
          <button
            type="button"
            className="atlas-soundtrack-browse-toggle"
            aria-expanded={browseOpen}
            onClick={() => setBrowseOpen((value) => !value)}
          >
            <span>Explore the Music</span>
            <span className={`atlas-soundtrack-chevron${browseOpen ? ' is-open' : ''}`} aria-hidden="true">
              ▾
            </span>
          </button>
          {browseOpen ? (
            <div className="atlas-soundtrack-browse-panel">
              {previewTrackId ? (
                <button
                  type="button"
                  className="atlas-soundtrack-return"
                  onClick={() => setPreviewTrack(null)}
                >
                  Return to Automatic
                </button>
              ) : null}
              <ul className="atlas-soundtrack-track-list">
                {playable.map((track) => {
                  const active = trackId === track.id
                  return (
                    <li key={track.id}>
                      <button
                        type="button"
                        className={`atlas-soundtrack-track-btn${active ? ' is-active' : ''}`}
                        onClick={() => setPreviewTrack(track.id)}
                      >
                        <span className="atlas-soundtrack-track-btn-title">{track.title}</span>
                        <span className="atlas-soundtrack-track-btn-meta">{shortStyleDescriptor(track)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </section>

        {showDebug ? (
          <details className="atlas-soundtrack-debug">
            <summary>Developer diagnostics</summary>
            <dl>
              <div>
                <dt>Match</dt>
                <dd>
                  {previewTrackId
                    ? 'Manual audition'
                    : !wantsSound
                      ? 'Muted (user preference)'
                      : matchKind === 'exact_historical'
                        ? 'Exact historical match'
                        : matchKind === 'broader_historical'
                          ? 'Broader regional/period match'
                          : matchKind === 'documentary_fallback'
                            ? 'Documentary fallback'
                            : matchKind === 'overview'
                              ? 'Overview documentary'
                              : transition.lastCancelReason?.includes('playback error')
                                ? 'Playback error'
                                : '—'}
                </dd>
              </div>
              <div>
                <dt>Resolved</dt>
                <dd>{resolvedTrackId ?? '—'}</dd>
              </div>
              <div>
                <dt>Audible</dt>
                <dd>{audibleTrackId ?? '—'}</dd>
              </div>
              <div>
                <dt>Context</dt>
                <dd>
                  {autoContext?.precedence ?? '—'} / {autoContext?.focusId ?? 'none'}
                </dd>
              </div>
              <div>
                <dt>Scheduler</dt>
                <dd>
                  {schedulerStatus}
                  {pendingTrackId ? ` → ${pendingTrackId}` : ''}
                </dd>
              </div>
              <div>
                <dt>Latency</dt>
                <dd>
                  {transition.selectionToAudibleMs != null
                    ? `${transition.selectionToAudibleMs} ms`
                    : '—'}
                  {transition.coldLoad ? ' · cold' : ' · warm'} · fade {transition.crossfadeSec ?? '—'}s
                </dd>
              </div>
              <div>
                <dt>Why</dt>
                <dd>{lastChoiceReason ?? '—'}</dd>
              </div>
              <div>
                <dt>Eligible</dt>
                <dd>{lastEligibleIds.join(', ') || '—'}</dd>
              </div>
              {transition.lastCancelReason ? (
                <div>
                  <dt>Engine</dt>
                  <dd>{transition.lastCancelReason}</dd>
                </div>
              ) : null}
            </dl>
            {lastRejected.length > 0 ? (
              <ul>
                {lastRejected.slice(0, 6).map((entry) => (
                  <li key={entry.id}>
                    {entry.title}: {entry.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </details>
        ) : null}
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
