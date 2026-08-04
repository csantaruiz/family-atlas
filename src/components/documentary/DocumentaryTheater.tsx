import { useDocumentaryMode } from '../../context/DocumentaryModeContext'
import { TitleCardScene } from './scenes/TitleCardScene'
import { MapScene } from './scenes/MapScene'
import { DocumentScene } from './scenes/DocumentScene'
import { PortraitScene } from './scenes/PortraitScene'

function FilmGrain() {
  return (
    <div className="film-theater__grain" aria-hidden="true">
      <div className="film-theater__vignette" />
    </div>
  )
}

export function DocumentaryTheater() {
  const { phase, currentScene, sceneElapsedMs } = useDocumentaryMode()

  if (phase !== 'playing' || !currentScene) return null
  if (currentScene.visual === 'atlas-orientation') return null

  return (
    <div className="film-theater" data-scene-type={currentScene.visual}>
      <FilmGrain />
      {currentScene.visual === 'title-card' ? (
        <TitleCardScene scene={currentScene} sceneElapsedMs={sceneElapsedMs} />
      ) : null}
      {currentScene.visual === 'historical-map' ? (
        <MapScene scene={currentScene} sceneElapsedMs={sceneElapsedMs} />
      ) : null}
      {currentScene.visual === 'document' ? (
        <DocumentScene scene={currentScene} sceneElapsedMs={sceneElapsedMs} />
      ) : null}
      {currentScene.visual === 'portrait' ? (
        <PortraitScene scene={currentScene} sceneElapsedMs={sceneElapsedMs} />
      ) : null}
    </div>
  )
}
