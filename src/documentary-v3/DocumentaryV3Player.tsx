import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Map } from 'maplibre-gl'
import { DebugPanel } from './components/DebugPanel'
import { MapStage } from './components/MapStage'
import { NarrativeOverlay } from './components/NarrativeOverlay'
import { PlaybackControls } from './components/PlaybackControls'
import { SubtitleLayer } from './components/SubtitleLayer'
import { TimeIndicator } from './components/TimeIndicator'
import { findActiveNarrativeCue } from './data/narrativeCues'
import { findActiveCameraCue } from './data/cameraCues'
import { useCameraDirector } from './hooks/useCameraDirector'
import { useDocumentaryClock } from './hooks/useDocumentaryClock'
import type { DebugState } from './types'
import './styles/documentary-v3.css'

const INITIAL_DEBUG: DebugState = {
  currentTime: 0,
  activeCueId: 'world',
  requestedCenter: [-35, 52],
  requestedZoom: 2.2,
  mapCenter: [-35, 52],
  mapZoom: 2.2,
  markerCoords: null,
}

export function DocumentaryV3Player() {
  const { audioRef, currentTime, duration, isPlaying, play, pause, seek, restart, seekVersion } =
    useDocumentaryClock()
  const [map, setMap] = useState<Map | null>(null)
  const [debug, setDebug] = useState<DebugState>(INITIAL_DEBUG)

  const narrativeCue = useMemo(() => findActiveNarrativeCue(currentTime), [currentTime])

  const onDebugUpdate = useCallback((partial: Partial<DebugState>) => {
    setDebug((prev) => ({ ...prev, ...partial, currentTime }))
  }, [currentTime])

  useCameraDirector({ map, currentTime, seekVersion, onDebugUpdate })

  useEffect(() => {
    setDebug((prev) => ({ ...prev, currentTime, activeCueId: findActiveCameraCue(currentTime).id }))
  }, [currentTime])

  return (
    <div className="dv3-root">
      <MapStage onMapReady={setMap} />

      <div className="dv3-ui">
        <NarrativeOverlay cue={narrativeCue} />
        <SubtitleLayer />
        <div className="dv3-ui__footer">
          <TimeIndicator />
          <PlaybackControls
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            onPlay={() => void play()}
            onPause={pause}
            onSeek={seek}
            onRestart={() => void restart()}
          />
        </div>
      </div>

      <DebugPanel debug={debug} />

      <audio ref={audioRef} src="/documentary/santa-ruiz-story.mp3" preload="metadata" />
    </div>
  )
}
