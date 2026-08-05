import { useEffect, type RefObject } from 'react'

function touchDistance(touches: TouchList): number | null {
  if (touches.length < 2) return null
  const a = touches[0]
  const b = touches[1]
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

type PinchZoomArgs = {
  centerX: number
  delta: number
  width: number
}

const PINCH_STEP_PX = 5

/** Map two-finger pinch on a container to zoom callbacks (delta > 0 = zoom out). */
export function usePinchZoom(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  onPinch: (args: PinchZoomArgs) => void,
) {
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return

    let lastDistance: number | null = null
    let carry = 0

    const reset = () => {
      lastDistance = null
      carry = 0
    }

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        lastDistance = touchDistance(event.touches)
        carry = 0
      }
    }

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || lastDistance == null) return
      const distance = touchDistance(event.touches)
      if (distance == null) return

      event.preventDefault()

      const rect = el.getBoundingClientRect()
      const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left
      carry += lastDistance - distance
      lastDistance = distance

      while (carry >= PINCH_STEP_PX) {
        onPinch({ centerX, delta: PINCH_STEP_PX, width: rect.width })
        carry -= PINCH_STEP_PX
      }
      while (carry <= -PINCH_STEP_PX) {
        onPinch({ centerX, delta: -PINCH_STEP_PX, width: rect.width })
        carry += PINCH_STEP_PX
      }
    }

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) reset()
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [ref, enabled, onPinch])
}
