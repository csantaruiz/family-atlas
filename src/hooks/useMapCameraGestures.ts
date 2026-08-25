import { useEffect, useRef, type RefObject } from 'react'
import type { MapBounds } from '../utils/mapRegionGeometry'
import {
  clampCameraToContent,
  panCamera,
  zoomCameraAt,
} from '../utils/mapCameraGestures'
import type { MapCamera } from '../utils/mapSemanticZoom'

const PAN_THRESHOLD_PX = 8

type GestureOptions = {
  getCamera: () => MapCamera
  applyCamera: (camera: MapCamera) => void
  bounds: MapBounds | null
  onGestureStart?: () => void
  onGestureEnd?: () => void
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('button, a, input, select, textarea, [role="button"]'))
}

function pinchDistance(points: { x: number; y: number }[]): number {
  const [a, b] = points
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function pinchMidpoint(points: { x: number; y: number }[]): { x: number; y: number } {
  return {
    x: (points[0].x + points[1].x) / 2,
    y: (points[0].y + points[1].y) / 2,
  }
}

/** One-finger pan and two-finger pinch around the finger midpoint. */
export function useMapCameraGestures(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  options: GestureOptions,
) {
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    const node = ref.current
    if (!node || !enabled) return

    const pointers = new Map<number, { x: number; y: number }>()
    let lastPinchDistance: number | null = null
    let lastPan: { x: number; y: number } | null = null
    let panning = false
    let startedOnControl = false
    let active = false

    const commit = (next: MapCamera) => {
      const { bounds, applyCamera } = optionsRef.current
      applyCamera(clampCameraToContent(next, bounds))
    }

    const begin = () => {
      if (active) return
      active = true
      optionsRef.current.onGestureStart?.()
    }

    const finish = () => {
      if (!active) return
      active = false
      optionsRef.current.onGestureEnd?.()
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pointers.size === 1) {
        startedOnControl = isInteractiveTarget(event.target)
        lastPan = { x: event.clientX, y: event.clientY }
        panning = false
      }
      if (pointers.size === 2) {
        startedOnControl = false
        panning = false
        lastPinchDistance = pinchDistance([...pointers.values()])
        begin()
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      const rect = node.getBoundingClientRect()
      const camera = optionsRef.current.getCamera()

      if (pointers.size >= 2 && lastPinchDistance != null) {
        event.preventDefault()
        const points = [...pointers.values()]
        const distance = pinchDistance(points)
        if (distance < 4 || lastPinchDistance < 4) {
          lastPinchDistance = distance
          return
        }
        const mid = pinchMidpoint(points)
        const originLeft = ((mid.x - rect.left) / rect.width) * 100
        const originTop = ((mid.y - rect.top) / rect.height) * 100
        const factor = distance / lastPinchDistance
        lastPinchDistance = distance
        commit(zoomCameraAt(camera, factor, originLeft, originTop))
        return
      }

      if (pointers.size !== 1 || startedOnControl || lastPan == null) return
      const dx = event.clientX - lastPan.x
      const dy = event.clientY - lastPan.y
      if (!panning) {
        if (Math.hypot(dx, dy) < PAN_THRESHOLD_PX) return
        panning = true
        begin()
      }
      event.preventDefault()
      lastPan = { x: event.clientX, y: event.clientY }
      commit(panCamera(camera, dx, dy, rect.width, rect.height))
    }

    const onPointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId)
      if (pointers.size < 2) {
        lastPinchDistance = null
      }
      if (pointers.size === 1) {
        const remaining = [...pointers.values()][0]
        lastPan = remaining ? { x: remaining.x, y: remaining.y } : null
        panning = false
      }
      if (pointers.size === 0) {
        lastPan = null
        panning = false
        startedOnControl = false
        finish()
      }
    }

    node.addEventListener('pointerdown', onPointerDown)
    node.addEventListener('pointermove', onPointerMove, { passive: false })
    node.addEventListener('pointerup', onPointerUp)
    node.addEventListener('pointercancel', onPointerUp)
    node.addEventListener('pointerleave', onPointerUp)

    return () => {
      node.removeEventListener('pointerdown', onPointerDown)
      node.removeEventListener('pointermove', onPointerMove)
      node.removeEventListener('pointerup', onPointerUp)
      node.removeEventListener('pointercancel', onPointerUp)
      node.removeEventListener('pointerleave', onPointerUp)
    }
  }, [enabled, ref])
}
