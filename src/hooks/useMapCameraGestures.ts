import { useEffect, useRef, type RefObject } from 'react'
import type { MapBounds } from '../utils/mapRegionGeometry'
import {
  clampCameraToContent,
  panCamera,
  zoomCameraAt,
} from '../utils/mapCameraGestures'
import type { MapCamera } from '../utils/mapSemanticZoom'

const PAN_THRESHOLD_PX = 8

export type MapGestureMode = 'idle' | 'pan' | 'pinch'

type GestureOptions = {
  getCamera: () => MapCamera
  applyCamera: (camera: MapCamera) => void
  bounds: MapBounds | null
  onGestureStart?: (mode: MapGestureMode) => void
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
    let pinching = false
    let startedOnControl = false
    let active = false
    let suppressClick = false
    let suppressTimer: number | null = null

    const viewport = () => {
      const rect = node.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    }

    const commit = (next: MapCamera) => {
      const { bounds, applyCamera } = optionsRef.current
      applyCamera(clampCameraToContent(next, bounds, viewport()))
    }

    const begin = (mode: MapGestureMode) => {
      if (!active) {
        active = true
        optionsRef.current.onGestureStart?.(mode)
      }
    }

    const finish = () => {
      if (!active) return
      active = false
      if (panning || pinching) {
        suppressClick = true
        if (suppressTimer != null) window.clearTimeout(suppressTimer)
        suppressTimer = window.setTimeout(() => {
          suppressClick = false
          suppressTimer = null
        }, 400)
      }
      panning = false
      pinching = false
      optionsRef.current.onGestureEnd?.()
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      try {
        node.setPointerCapture(event.pointerId)
      } catch {
        /* Safari may throw if the target is gone */
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pointers.size === 1) {
        startedOnControl = isInteractiveTarget(event.target)
        lastPan = { x: event.clientX, y: event.clientY }
        panning = false
      }
      if (pointers.size === 2) {
        startedOnControl = false
        panning = false
        pinching = true
        lastPinchDistance = pinchDistance([...pointers.values()])
        begin('pinch')
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      const rect = node.getBoundingClientRect()
      const camera = optionsRef.current.getCamera()
      const size = { width: rect.width, height: rect.height }

      if (pointers.size >= 2 && lastPinchDistance != null) {
        event.preventDefault()
        pinching = true
        panning = false
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
        begin('pinch')
        commit(zoomCameraAt(camera, factor, originLeft, originTop, size))
        return
      }

      if (pointers.size !== 1 || startedOnControl || lastPan == null) return
      const dx = event.clientX - lastPan.x
      const dy = event.clientY - lastPan.y
      if (!panning) {
        if (Math.hypot(dx, dy) < PAN_THRESHOLD_PX) return
        panning = true
        begin('pan')
      }
      event.preventDefault()
      lastPan = { x: event.clientX, y: event.clientY }
      commit(panCamera(camera, dx, dy, rect.width, rect.height))
    }

    const onPointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId)
      if (pointers.size < 2) {
        lastPinchDistance = null
        pinching = false
      }
      if (pointers.size === 1) {
        const remaining = [...pointers.values()][0]
        lastPan = remaining ? { x: remaining.x, y: remaining.y } : null
        panning = false
      }
      if (pointers.size === 0) {
        lastPan = null
        startedOnControl = false
        finish()
      }
    }

    const onClickCapture = (event: Event) => {
      if (!suppressClick) return
      event.preventDefault()
      event.stopPropagation()
    }

    const preventGesture = (event: Event) => {
      event.preventDefault()
    }

    const onTouchMove = (event: TouchEvent) => {
      if (active || pointers.size > 0) event.preventDefault()
    }

    node.addEventListener('pointerdown', onPointerDown)
    node.addEventListener('pointermove', onPointerMove, { passive: false })
    node.addEventListener('pointerup', onPointerUp)
    node.addEventListener('pointercancel', onPointerUp)
    node.addEventListener('click', onClickCapture, true)
    node.addEventListener('gesturestart', preventGesture)
    node.addEventListener('gesturechange', preventGesture)
    node.addEventListener('gestureend', preventGesture)
    node.addEventListener('touchmove', onTouchMove, { passive: false })

    return () => {
      if (suppressTimer != null) window.clearTimeout(suppressTimer)
      node.removeEventListener('pointerdown', onPointerDown)
      node.removeEventListener('pointermove', onPointerMove)
      node.removeEventListener('pointerup', onPointerUp)
      node.removeEventListener('pointercancel', onPointerUp)
      node.removeEventListener('click', onClickCapture, true)
      node.removeEventListener('gesturestart', preventGesture)
      node.removeEventListener('gesturechange', preventGesture)
      node.removeEventListener('gestureend', preventGesture)
      node.removeEventListener('touchmove', onTouchMove)
    }
  }, [enabled, ref])
}
