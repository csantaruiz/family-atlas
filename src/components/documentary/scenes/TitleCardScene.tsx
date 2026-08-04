import { motion } from 'framer-motion'
import { sceneProgress } from '../../../data/openingScript'
import { sceneOpacity } from '../../../utils/kenBurns'
import type { DocumentaryScene } from '../../../types/documentary'

const EASE = [0.22, 0.8, 0.2, 1] as const

type TitleCardSceneProps = {
  scene: DocumentaryScene
  sceneElapsedMs: number
}

export function TitleCardScene({ scene, sceneElapsedMs }: TitleCardSceneProps) {
  const ratio = sceneProgress(sceneElapsedMs, scene.durationMs)
  const opacity = sceneOpacity(ratio)
  const activeLines = scene.lines?.length ? scene.lines : scene.narration ? [scene.narration] : []
  const activeIndex = scene.lines?.length
    ? Math.min(activeLines.length - 1, Math.floor(sceneElapsedMs / (scene.lineIntervalMs ?? 1800)))
    : 0
  const displayText = activeLines[activeIndex] ?? ''

  if (!displayText || opacity <= 0.01) return null

  return (
    <div className="film-scene film-scene--title" style={{ opacity }}>
      {scene.sectionTitle ? (
        <p className="film-scene__section-label">{scene.sectionTitle}</p>
      ) : null}
      <motion.h1
        key={`${scene.id}-${displayText}`}
        className="film-scene__title"
        initial={{ opacity: 0, y: 18, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 1.2, ease: EASE }}
      >
        {displayText}
      </motion.h1>
    </div>
  )
}
