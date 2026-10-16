import { useMemo, useRef } from 'react'
import { useAmbientSoundtrack } from '../soundtrack/AmbientSoundtrackContext'
import { SoundtrackLabPanel } from '../soundtrack/dev/SoundtrackLab'
import { isSoundtrackLabEnabled } from '../soundtrack/dev/soundtrackLabEnabled'

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg
      className="ambient-sound-icon"
      viewBox="0 0 24 24"
      width="17"
      height="17"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 9.5h3l4-3.5v12l-4-3.5h-3z" fill="currentColor" fillOpacity="0.18" />
      {on ? (
        <>
          <path className="ambient-sound-wave" d="M15 9.2a4 4 0 0 1 0 5.6" />
          <path className="ambient-sound-wave ambient-sound-wave--outer" d="M17.6 6.8a7.4 7.4 0 0 1 0 10.4" />
        </>
      ) : (
        <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />
      )}
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`ambient-sound-chevron${open ? ' is-open' : ''}`}
      viewBox="0 0 12 12"
      width="10"
      height="10"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 4.5 L6 8 L9.5 4.5" />
    </svg>
  )
}

/** Row for the phone Explore menu — mute only; Lab opens from the header chevron. */
export function AmbientSoundMenuItem() {
  const { supported, wantsSound, toggleSound } = useAmbientSoundtrack()
  if (!supported) return null
  return (
    <div className="explore-sound-block">
      <p className="explore-menu-kicker">Sound</p>
      <button type="button" className="explore-sound-item" aria-pressed={wantsSound} onClick={toggleSound}>
        <SpeakerIcon on={wantsSound} />
        <span>Background music</span>
        <span className="explore-sound-state">{wantsSound ? 'On' : 'Off'}</span>
      </button>
    </div>
  )
}

/**
 * Unified header audio control: speaker toggles mute; adjacent chevron opens Soundtrack Lab.
 * Separate click targets so opening Lab never mutes and mute never opens Lab.
 * Lab is portaled and positioned from this cluster's bounding box (never bottom-of-screen).
 */
export function AmbientSoundControl() {
  const { supported, wantsSound, audible, toggleSound, labOpen, setLabOpen } = useAmbientSoundtrack()
  const labEnabled = useMemo(() => isSoundtrackLabEnabled(), [])
  const groupRef = useRef<HTMLDivElement>(null)

  if (!supported) return null

  const label = wantsSound ? 'Turn off background music' : 'Turn on background music'
  return (
    <div
      ref={groupRef}
      className={`ambient-sound${wantsSound ? ' is-on' : ''}${audible ? ' is-audible' : ''}${labOpen ? ' is-lab-open' : ''}`}
    >
      <div className="ambient-sound-group" role="group" aria-label="Background music">
        <button
          type="button"
          className="ambient-sound-toggle"
          aria-pressed={wantsSound}
          aria-label={label}
          title={label}
          onClick={toggleSound}
        >
          <SpeakerIcon on={wantsSound} />
        </button>
        {labEnabled ? (
          <button
            type="button"
            className="ambient-sound-lab-toggle"
            aria-expanded={labOpen}
            aria-haspopup="dialog"
            aria-controls="atlas-soundtrack-lab"
            aria-label={labOpen ? 'Close The Atlas Soundtrack' : 'Open The Atlas Soundtrack'}
            title="The Atlas Soundtrack"
            onClick={() => setLabOpen(!labOpen)}
          >
            <ChevronIcon open={labOpen} />
          </button>
        ) : null}
      </div>
      {labEnabled ? (
        <SoundtrackLabPanel
          open={labOpen}
          onClose={() => setLabOpen(false)}
          anchorRef={groupRef}
        />
      ) : null}
    </div>
  )
}
