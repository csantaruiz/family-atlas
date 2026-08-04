type PlaybackControlsProps = {
  currentTime: number
  duration: number
  isPlaying: boolean
  onPlay: () => void
  onPause: () => void
  onSeek: (seconds: number) => void
  onRestart: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function PlaybackControls({
  currentTime,
  duration,
  isPlaying,
  onPlay,
  onPause,
  onSeek,
  onRestart,
}: PlaybackControlsProps) {
  return (
    <div className="dv3-controls">
      <div className="dv3-controls__buttons">
        <button type="button" className="dv3-controls__btn" onClick={onRestart}>
          Restart
        </button>
        {isPlaying ? (
          <button type="button" className="dv3-controls__btn dv3-controls__btn--primary" onClick={onPause}>
            Pause
          </button>
        ) : (
          <button type="button" className="dv3-controls__btn dv3-controls__btn--primary" onClick={onPlay}>
            Play
          </button>
        )}
      </div>
      <label className="dv3-controls__scrub">
        <span className="dv3-controls__time">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration}
          step={0.05}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Documentary progress"
        />
        <span className="dv3-controls__time">{formatTime(duration)}</span>
      </label>
    </div>
  )
}
