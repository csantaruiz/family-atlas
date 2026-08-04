import { useMemo } from 'react'
import { useDocumentaryEngine } from '../context/DocumentaryEngineContext'
import { resolveDocumentaryFrame } from '../core/cameraDirector'
import { DocumentaryDebugOverlay } from './dev/DocumentaryDebugOverlay'
import { NarrativeOverlayLayer } from './stage/NarrativeOverlayLayer'
import { TimeLayer } from './stage/TimeLayer'
import { PersistentMapStage } from './stage/PersistentMapStage'
import { AuthenticEvidenceScene } from './scenes/AuthenticEvidenceScene'
function FilmGrain() {
  return (
    <div className="de-grain" aria-hidden="true">
      <div className="de-vignette" />
    </div>
  )
}

export function DocumentaryViewport() {
  const { phase, manifest, currentTimeMs, durationMs, resolved } = useDocumentaryEngine()

  const frame = useMemo(
    () => (phase === 'playing' ? resolveDocumentaryFrame(manifest, currentTimeMs, durationMs) : null),
    [currentTimeMs, durationMs, manifest, phase],
  )

  if (phase !== 'playing' || !resolved) return null

  const useChoreography = Boolean(resolved.scene.choreography)
  const isEvidence = resolved.scene.sceneType === 'authentic-evidence'
  const isClosing = resolved.scene.sceneType === 'closing'

  return (
    <div className="de-viewport" data-chapter={resolved.chapter} data-scene={resolved.scene.id}>
      <PersistentMapStage frame={frame} />

      {useChoreography ? (
        <NarrativeOverlayLayer
          overlay={frame?.narrativeOverlay ?? null}
          sceneId={resolved.scene.id}
          suppressDate={(frame?.timeLayer?.opacity ?? 0) > 0.2}
        />
      ) : null}

      {frame?.timeLayer ? <TimeLayer state={frame.timeLayer} /> : null}

      {isEvidence ? (
        <AuthenticEvidenceScene scene={resolved.scene} progress={resolved.progress} />
      ) : null}

      {isClosing && !useChoreography ? (
        <NarrativeOverlayLayer
          overlay={
            resolved.scene.caption
              ? { title: resolved.scene.caption, opacity: 1 }
              : null
          }
          sceneId={resolved.scene.id}
        />
      ) : null}

      <FilmGrain />
      <DocumentaryDebugOverlay frame={frame} />
    </div>
  )
}
