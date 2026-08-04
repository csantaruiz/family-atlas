import type { ReactNode } from 'react'
import type { SceneManifestEntry } from '../../types/manifest'
import { isMapSceneType } from '../../types/manifest'
import { sceneEnvelope } from '../../utils/camera'
import { TitleScene } from './TitleScene'
import { MapStoryScene } from './MapStoryScene'
import { TimelineOrientationScene } from './TimelineOrientationScene'
import { AuthenticEvidenceScene } from './AuthenticEvidenceScene'
import { ClosingScene } from './ClosingScene'

type SceneRendererProps = {
  scene: SceneManifestEntry
  progress: number
}

export function SceneRenderer({ scene, progress }: SceneRendererProps) {
  const opacity = sceneEnvelope(progress, 0.08)

  const body = renderScene(scene, progress)
  if (!body) return null

  return (
    <div className="de-scene-layer" style={{ opacity }} data-scene-type={scene.sceneType}>
      {body}
    </div>
  )
}

function renderScene(scene: SceneManifestEntry, progress: number): ReactNode {
  switch (scene.sceneType) {
    case 'title':
      return <TitleScene scene={scene} progress={progress} />
    case 'timeline-orientation':
      return <TimelineOrientationScene scene={scene} progress={progress} />
    case 'authentic-evidence':
      return <AuthenticEvidenceScene scene={scene} progress={progress} />
    case 'closing':
      return <ClosingScene scene={scene} progress={progress} />
    default:
      if (isMapSceneType(scene.sceneType)) {
        return <MapStoryScene scene={scene} progress={progress} />
      }
      return null
  }
}
