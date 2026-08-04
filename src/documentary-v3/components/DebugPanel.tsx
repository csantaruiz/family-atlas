import { useState } from 'react'
import type { DebugState } from '../types'

type DebugPanelProps = {
  debug: DebugState
}

export function DebugPanel({ debug }: DebugPanelProps) {
  const [open, setOpen] = useState(true)

  if (!import.meta.env.DEV) return null

  return (
    <aside className="dv3-debug">
      <button type="button" className="dv3-debug__toggle" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide debug' : 'Show debug'}
      </button>
      {open ? (
        <div className="dv3-debug__body">
          <p>audio: {debug.currentTime.toFixed(2)}s</p>
          <p>cue: {debug.activeCueId}</p>
          <p>
            req center: [{debug.requestedCenter[0].toFixed(3)}, {debug.requestedCenter[1].toFixed(3)}]
          </p>
          <p>
            map center: [{debug.mapCenter[0].toFixed(3)}, {debug.mapCenter[1].toFixed(3)}]
          </p>
          <p>req zoom: {debug.requestedZoom.toFixed(2)}</p>
          <p>map zoom: {debug.mapZoom.toFixed(2)}</p>
          <p>
            marker:{' '}
            {debug.markerCoords
              ? `[${debug.markerCoords[0].toFixed(3)}, ${debug.markerCoords[1].toFixed(3)}]`
              : 'none'}
          </p>
        </div>
      ) : null}
    </aside>
  )
}
