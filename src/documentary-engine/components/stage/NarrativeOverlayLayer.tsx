import { useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  consumeAllPendingNarrativeSpecs,
  isNarrativeRevealed,
  narrativeOverlaySignature,
} from '../../core/displayRevealRegistry'
import {
  NARRATIVE_FADE_IN_MS,
  NARRATIVE_FADE_OUT_MS,
} from '../../data/playbackConfig'
import type { NarrativeOverlayState } from '../../core/narrativeOverlayDirector'

const NARRATIVE_DRIFT_S = 28
const narrativeEaseIn = [0.4, 0, 0.2, 1] as const
const narrativeEaseOut = [0.4, 0, 1, 1] as const

type NarrativeOverlayLayerProps = {
  overlay: NarrativeOverlayState | null
  sceneId: string
  /** When the timeline band is visible, year context lives there — avoid duplicate dates. */
  suppressDate?: boolean
}

/** Single screen-space narrative overlay — one line at a time, no stacked cross-scene text. */
export function NarrativeOverlayLayer({
  overlay,
  sceneId,
  suppressDate = false,
}: NarrativeOverlayLayerProps) {
  const prevSceneId = useRef(sceneId)

  useEffect(() => {
    if (prevSceneId.current === sceneId) return
    consumeAllPendingNarrativeSpecs()
    prevSceneId.current = sceneId
  }, [sceneId])

  const overlayKey = overlay
    ? `${sceneId}:${narrativeOverlaySignature(overlay)}`
    : `${sceneId}:empty`
  const skipEnterMotion = overlay ? isNarrativeRevealed(overlay) : false
  const prefersReducedMotion = useReducedMotion()
  const enterMotionS = prefersReducedMotion ? 0.01 : NARRATIVE_FADE_IN_MS / 1000
  const exitMotionS = prefersReducedMotion ? 0.01 : NARRATIVE_FADE_OUT_MS / 1000

  const isCaptionLine = Boolean(
    overlay?.title && !overlay.date && !overlay.subtitle && !overlay.eyebrow,
  )

  return (
    <div className="de-narrative-layer" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {overlay ? (
          <motion.div
            key={overlayKey}
            className={[
              'de-narrative-state',
              isCaptionLine ? 'de-narrative-state--caption' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ opacity: overlay.opacity }}
            initial={skipEnterMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: overlay.opacity, y: 0 }}
            exit={{
              opacity: 0,
              y: -6,
              transition: {
                opacity: { duration: exitMotionS * 0.55, ease: narrativeEaseOut },
                y: { duration: exitMotionS * 0.45, ease: narrativeEaseOut },
              },
            }}
            transition={{
              opacity: { duration: enterMotionS, ease: narrativeEaseIn },
              y: { duration: enterMotionS, ease: narrativeEaseIn },
            }}
          >
            <motion.div
              className="de-narrative-state__content"
              animate={{ x: prefersReducedMotion ? 0 : [-3, 3] }}
              transition={
                prefersReducedMotion
                  ? { duration: 0.01 }
                  : {
                      duration: NARRATIVE_DRIFT_S,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      repeatType: 'mirror',
                    }
              }
            >
              {overlay.eyebrow ? (
                <p className="de-narrative-eyebrow">{overlay.eyebrow}</p>
              ) : null}
              {overlay.title ? <h2 className="de-narrative-primary">{overlay.title}</h2> : null}
              {overlay.date && !suppressDate ? (
                <p className="de-narrative-date">{overlay.date}</p>
              ) : null}
              {overlay.subtitle ? (
                <p className="de-narrative-subtitle">{overlay.subtitle}</p>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
