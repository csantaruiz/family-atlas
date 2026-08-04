import { DocumentaryMapCanvas } from '../map/DocumentaryMapCanvas'
import { DocumentaryTextOverlays } from '../shared/DocumentaryTextOverlays'
import { SceneAtmosphere } from '../shared/SceneAtmosphere'
import type { SceneManifestEntry } from '../../types/manifest'

type ClosingSceneProps = {
  scene: SceneManifestEntry
  progress: number
}

export function ClosingScene({ scene, progress }: ClosingSceneProps) {
  const map = scene.map ?? {
    camera: { cxStart: 22, cyStart: 38, scaleStart: 1.6, cxEnd: 50, cyEnd: 50, scaleEnd: 1.05 },
    overlays: [{ kind: 'insight' as const, text: 'Enter the Atlas', start: 0.2, end: 0.88 }],
  }

  const elapsedMs = progress * (scene.narrationEndMs - scene.narrationStartMs)
  const copyOpacity = Math.min(1, Math.max(0, (progress - 0.1) / 0.3))

  return (
    <div className="de-scene de-scene--closing">
      <SceneAtmosphere variant="map" />
      <DocumentaryMapCanvas map={map} sceneId={scene.id} progress={progress} elapsedMs={elapsedMs} />
      <DocumentaryTextOverlays overlays={map.overlays} progress={progress} />
      <div className="de-title-copy" style={{ opacity: copyOpacity }}>
        <p className="de-scene__chapter">{scene.chapter}</p>
        <h2 className="de-scene__title de-scene__title--closing">{scene.caption ?? scene.title}</h2>
      </div>
    </div>
  )
}
