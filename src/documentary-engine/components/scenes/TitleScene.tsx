import { DocumentaryMapCanvas } from '../map/DocumentaryMapCanvas'
import { DocumentaryTextOverlays } from '../shared/DocumentaryTextOverlays'
import { SceneAtmosphere } from '../shared/SceneAtmosphere'
import type { SceneManifestEntry } from '../../types/manifest'

type TitleSceneProps = {
  scene: SceneManifestEntry
  progress: number
}

export function TitleScene({ scene, progress }: TitleSceneProps) {
  const map = scene.map ?? {
    camera: { cxStart: 50, cyStart: 50, scaleStart: 1, cxEnd: 48, cyEnd: 49, scaleEnd: 1.06 },
    overlays: [{ kind: 'emotional' as const, text: scene.caption ?? scene.title, start: 0.15, end: 0.92 }],
  }

  const elapsedMs = progress * (scene.narrationEndMs - scene.narrationStartMs)
  const titleOpacity = Math.min(1, Math.max(0, (progress - 0.08) / 0.35))

  return (
    <div className="de-scene de-scene--title">
      <SceneAtmosphere variant="map" />
      <DocumentaryMapCanvas map={map} sceneId={scene.id} progress={progress} elapsedMs={elapsedMs} />
      <DocumentaryTextOverlays overlays={map.overlays} progress={progress} />
      <div className="de-title-copy" style={{ opacity: titleOpacity }}>
        <p className="de-scene__chapter">{scene.chapter}</p>
        <h1 className="de-scene__title">{scene.caption ?? scene.title}</h1>
      </div>
    </div>
  )
}
