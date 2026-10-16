import { useAmbientSoundtrack } from '../soundtrack/AmbientSoundtrackContext'

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

/** Row for the phone Explore menu, where the header has no room for the toggle. */
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

/** Unobtrusive on/off control; volume is fixed at a quiet atmospheric level. */
export function AmbientSoundControl() {
  const { supported, wantsSound, audible, toggleSound } = useAmbientSoundtrack()
  if (!supported) return null

  const label = wantsSound ? 'Turn off background music' : 'Turn on background music'
  return (
    <div className={`ambient-sound${wantsSound ? ' is-on' : ''}${audible ? ' is-audible' : ''}`}>
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
    </div>
  )
}
