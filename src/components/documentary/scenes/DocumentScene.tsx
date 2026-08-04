import { sceneProgress } from '../../../data/openingScript'
import { kenBurnsStyle, sceneOpacity } from '../../../utils/kenBurns'
import type { DocumentaryScene } from '../../../types/documentary'

type DocumentSceneProps = {
  scene: DocumentaryScene
  sceneElapsedMs: number
}

export function DocumentScene({ scene, sceneElapsedMs }: DocumentSceneProps) {
  const config = scene.visualConfig
  const ratio = sceneProgress(sceneElapsedMs, scene.durationMs)
  const opacity = sceneOpacity(ratio)

  if (opacity <= 0.01) return null

  return (
    <div className="film-scene film-scene--document" style={{ opacity }}>
      <div
        className="film-scene__document-frame"
        style={kenBurnsStyle(ratio, config?.kenBurns)}
      >
        <article className="film-scene__document">
          <header className="film-scene__document-header">
            <span className="film-scene__document-seal" aria-hidden="true" />
            <h2>{config?.documentTitle ?? 'Archival Record'}</h2>
          </header>
          <div className="film-scene__document-body">
            {(config?.documentLines ?? []).map((line, index) => {
              const lineOpacity = Math.min(1, Math.max(0, (ratio - 0.12 - index * 0.08) / 0.18))
              return (
                <p key={line} style={{ opacity: lineOpacity }}>
                  {line}
                </p>
              )
            })}
          </div>
          <footer className="film-scene__document-footer">Parish register · surviving ink</footer>
          <div className="film-scene__document-crease" aria-hidden="true" />
          <div className="film-scene__document-shadow" aria-hidden="true" />
        </article>
      </div>
    </div>
  )
}
