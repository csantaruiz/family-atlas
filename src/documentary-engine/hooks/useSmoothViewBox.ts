import { useEffect, useRef, useState } from 'react'
import {
  DOCUMENTARY_CAMERA_SMOOTHNESS,
  DOCUMENTARY_CAMERA_MAX_SMOOTHNESS,
  DOCUMENTARY_VIEWBOX_ZOOM_LERP,
} from '../data/playbackConfig'
import type { ViewBoxCamera } from '../../utils/mapSemanticZoom'

function lerpViewBox(
  from: ViewBoxCamera,
  to: ViewBoxCamera,
  panAlpha: number,
  zoomAlpha: number,
): ViewBoxCamera {
  const pan = Math.min(1, Math.max(0, panAlpha))
  const zoom = Math.min(1, Math.max(0, zoomAlpha))
  return {
    minX: from.minX + (to.minX - from.minX) * pan,
    minY: from.minY + (to.minY - from.minY) * pan,
    width: from.width + (to.width - from.width) * zoom,
    height: from.height + (to.height - from.height) * zoom,
  }
}

function viewBoxDistance(a: ViewBoxCamera, b: ViewBoxCamera): { pan: number; zoom: number } {
  return {
    pan: Math.hypot(a.minX - b.minX, a.minY - b.minY),
    zoom: Math.abs(a.width - b.width) + Math.abs(a.height - b.height),
  }
}

/** Adaptive catch-up — larger deltas move faster but never snap. */
function smoothnessForDistance(panDistance: number, zoomDistance: number): number {
  const blended = panDistance + zoomDistance * 0.35
  return Math.min(
    DOCUMENTARY_CAMERA_MAX_SMOOTHNESS,
    DOCUMENTARY_CAMERA_SMOOTHNESS * (1 + blended * 0.08),
  )
}

/** Exponential smoothing so map pan/zoom never hard-cuts between frames. */
export function useSmoothViewBox(
  target: ViewBoxCamera | null,
  snapToken = 0,
): ViewBoxCamera | null {
  const targetRef = useRef(target)
  targetRef.current = target

  const smoothRef = useRef<ViewBoxCamera | null>(target)
  const snapTokenRef = useRef(snapToken)
  const [display, setDisplay] = useState<ViewBoxCamera | null>(target)

  useEffect(() => {
    if (snapToken !== snapTokenRef.current) {
      snapTokenRef.current = snapToken
      if (target) {
        smoothRef.current = target
        setDisplay(target)
      }
    }
  }, [snapToken, target])

  useEffect(() => {
    if (!target) {
      smoothRef.current = null
      setDisplay(null)
      return
    }

    if (!smoothRef.current) {
      smoothRef.current = target
      setDisplay(target)
    }

    let raf = 0
    let last = performance.now()

    const tick = (now: number) => {
      const nextTarget = targetRef.current
      if (!nextTarget) {
        raf = requestAnimationFrame(tick)
        return
      }

      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      const current = smoothRef.current ?? nextTarget
      const distance = viewBoxDistance(current, nextTarget)
      const alpha = 1 - Math.exp(-smoothnessForDistance(distance.pan, distance.zoom) * dt)
      const next = lerpViewBox(current, nextTarget, alpha, alpha * DOCUMENTARY_VIEWBOX_ZOOM_LERP)

      if (distance.pan + distance.zoom < 0.008) {
        smoothRef.current = nextTarget
        setDisplay(nextTarget)
      } else {
        smoothRef.current = next
        setDisplay(next)
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])

  return display
}
