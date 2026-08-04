import { DocumentaryMapCanvas } from '../map/DocumentaryMapCanvas'
import { DocumentaryTextOverlays } from '../shared/DocumentaryTextOverlays'
import { SceneAtmosphere } from '../shared/SceneAtmosphere'
import type { SceneManifestEntry } from '../../types/manifest'

type MapStorySceneProps = {
  scene: SceneManifestEntry
  progress: number
}

export function MapStoryScene({ scene, progress }: MapStorySceneProps) {
  const map = scene.map
  if (!map) return null

  const elapsedMs = progress * (scene.narrationEndMs - scene.narrationStartMs)

  return (
    <div className="de-scene de-scene--map" data-branch={map.branch ?? ''}>
      <SceneAtmosphere variant="map" />
      <DocumentaryMapCanvas map={map} sceneId={scene.id} progress={progress} elapsedMs={elapsedMs} />
      <DocumentaryTextOverlays overlays={map.overlays} progress={progress} />
      {scene.caption ? (
        <p className="de-scene-caption de-scene-caption--map">{scene.caption}</p>
      ) : null}
    </div>
  )
}
