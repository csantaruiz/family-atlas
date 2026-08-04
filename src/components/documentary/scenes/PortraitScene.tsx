import { familyDatabase } from '../../../data/familyDatabase'
import { portraitPlaceholderForSex } from '../../../data/portraitPlaceholder'
import { sceneProgress } from '../../../data/openingScript'
import { kenBurnsStyle, sceneOpacity } from '../../../utils/kenBurns'
import { resolvePersonPortrait } from '../../../utils/resolvePersonPortrait'
import type { DocumentaryScene } from '../../../types/documentary'

type PortraitSceneProps = {
  scene: DocumentaryScene
  sceneElapsedMs: number
}

export function PortraitScene({ scene, sceneElapsedMs }: PortraitSceneProps) {
  const config = scene.visualConfig
  const ratio = sceneProgress(sceneElapsedMs, scene.durationMs)
  const opacity = sceneOpacity(ratio)
  const nameDelay = config?.revealNameAfterMs ?? 2800
  const showName = sceneElapsedMs >= nameDelay
  const showNarration = sceneElapsedMs >= 1800 && scene.narration
  const person = config?.portraitPersonId
    ? familyDatabase.people.find((entry) => entry.id === config.portraitPersonId)
    : undefined
  const portrait = person
    ? resolvePersonPortrait(person).image
    : portraitPlaceholderForSex(undefined)

  if (opacity <= 0.01) return null

  return (
    <div className="film-scene film-scene--portrait" style={{ opacity }}>
      <figure
        className="film-scene__portrait-frame"
        style={kenBurnsStyle(ratio, config?.kenBurns)}
      >
        <img
          className="film-scene__portrait-image"
          src={portrait.src}
          alt={config?.portraitCaption ?? portrait.alt}
        />
        <div className="film-scene__portrait-paper" aria-hidden="true" />
        {showName ? (
          <figcaption className="film-scene__portrait-caption">
            <strong>{config?.portraitCaption}</strong>
            {config?.portraitSubcaption ? <span>{config.portraitSubcaption}</span> : null}
          </figcaption>
        ) : null}
      </figure>
      {showNarration ? (
        <p className="film-scene__portrait-narration">{scene.narration}</p>
      ) : null}
    </div>
  )
}
