import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Home, Minus, Plus } from 'lucide-react'
import { useFamilyData } from '../../family-data/FamilyDataProvider'
import { useAppNavigation } from '../../context/AppNavigationContext'
import { useTimeline } from '../../context/TimelineContext'
import type { Person } from '../../types'
import {
  TREE_CARD_HEIGHT,
  TREE_CARD_WIDTH,
  type TreeBounds,
} from '../../utils/buildFamilyTree'
import {
  buildFocusTreeLayout,
  PARENTS_CONTROL_HEIGHT,
  PARENTS_CONTROL_WIDTH,
} from '../../utils/buildFocusTreeLayout'
import { BASE_DOWN_DEPTH, BASE_UP_DEPTH } from '../../utils/treeNeighborhood'
import { ParentsExpandControl } from '../tree/ParentsExpandControl'
import { TreeNodeCard, type TreeNodeDensity } from '../tree/TreeNodeCard'
import { TreePanHint } from '../tree/TreePanHint'
import { useMaxWidth } from '../../hooks/useMaxWidth'

type TreeViewProps = {
  active: boolean
}

type TreeCamera = {
  x: number
  y: number
  zoom: number
}

const PREFERRED_FOCUS_ZOOM_DESKTOP = 1.32
const PREFERRED_FOCUS_ZOOM_PHONE = 1.18
const ZOOM_MIN = 0.55
const ZOOM_MAX = 2.35
const ZOOM_BUTTON_STEP = 1.16
const WHEEL_ZOOM_GAIN = 0.0012
const PINCH_CTRL_GAIN = 0.00155
const TOUCH_PINCH_GAIN = 1
const CAMERA_MS = 420
const GRAPH_MS = 420
const EMPTY_REVEALED: ReadonlySet<string> = new Set()

type TreeAction = 'init' | 'expand' | 'focus' | 'home'

function logTreeTransition(payload: Record<string, unknown>) {
  if (import.meta.env.PROD) return
  console.debug('[tree-transition]', payload)
}

function canPanTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return !target.closest(
    '.tree-node-card, .tree-parents-control, .tree-chrome, button, a',
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}

function densityForZoom(zoom: number): TreeNodeDensity {
  if (zoom < 0.72) return 'far'
  if (zoom < 1.05) return 'medium'
  return 'near'
}

function cameraCss(camera: TreeCamera) {
  return `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`
}

function boundsCenter(bounds: TreeBounds) {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  }
}

export function TreeView({ active }: TreeViewProps) {
  const { database: familyDatabase } = useFamilyData()
  const { peopleById, openPerson } = useTimeline()
  const { focusedTreePersonId, setTreeFocus, treeFocusHome } = useAppNavigation()
  const phone = useMaxWidth(760)

  const canvasRef = useRef<HTMLDivElement>(null)
  const cameraElRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<TreeCamera>({ x: 0, y: 0, zoom: PREFERRED_FOCUS_ZOOM_DESKTOP })
  const panRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const pinchRef = useRef<{
    pointers: Map<number, { x: number; y: number }>
    startDistance: number
    startCamera: TreeCamera
    anchorX: number
    anchorY: number
  } | null>(null)
  const animRef = useRef<number | null>(null)
  const lodTimerRef = useRef<number | null>(null)
  const pendingCameraRef = useRef<
    | { kind: 'preferred'; behavior: 'instant' | 'smooth' }
    | { kind: 'reveal-parents'; parentIds: string[]; zoom: number }
    | null
  >(null)
  const prevFocusRef = useRef<string | null | undefined>(undefined)
  const transitionFromFocusRef = useRef<string | null | undefined>(undefined)
  const prevNodePosRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const nodeSlotRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const lastActionRef = useRef<TreeAction>('init')
  const flipTimerRef = useRef<number | null>(null)

  const [showPanHint, setShowPanHint] = useState(true)
  const [lodZoom, setLodZoom] = useState(PREFERRED_FOCUS_ZOOM_DESKTOP)
  const [didInitialCamera, setDidInitialCamera] = useState(false)
  const [enteringIds, setEnteringIds] = useState<Set<string>>(() => new Set())
  const [exitingNodes, setExitingNodes] = useState<
    { id: string; person: Person; x: number; y: number }[]
  >([])
  const [expandState, setExpandState] = useState<{
    focusKey: string | null
    ids: Set<string>
  }>(() => ({ focusKey: focusedTreePersonId, ids: new Set() }))

  const preferredZoom = phone ? PREFERRED_FOCUS_ZOOM_PHONE : PREFERRED_FOCUS_ZOOM_DESKTOP
  const revealedIds =
    expandState.focusKey === focusedTreePersonId ? expandState.ids : EMPTY_REVEALED

  const layout = useMemo(() => {
    if (!active) {
      return {
        nodes: [],
        connectors: [],
        parentsOverlays: [],
        width: 800,
        height: 600,
        focusIds: [familyDatabase.root],
        isHouseholdFocus: true,
        householdIds: [familyDatabase.root],
        coupleBounds: null,
        neighborhoodBounds: { minX: 0, minY: 0, maxX: 800, maxY: 600 },
        pathTowardHome: [familyDatabase.root],
      }
    }
    return buildFocusTreeLayout(
      peopleById,
      familyDatabase.root,
      focusedTreePersonId,
      BASE_UP_DEPTH,
      BASE_DOWN_DEPTH,
      revealedIds,
    )
  }, [active, peopleById, familyDatabase.root, focusedTreePersonId, revealedIds])

  const density = densityForZoom(lodZoom)
  const householdSet = useMemo(() => new Set(layout.householdIds), [layout.householdIds])
  const focusSet = useMemo(() => new Set(layout.focusIds), [layout.focusIds])
  const chromeReserve = phone ? 120 : 100

  const dismissPanHint = useCallback(() => setShowPanHint(false), [])

  const setGestureZooming = useCallback((on: boolean) => {
    canvasRef.current?.classList.toggle('is-gesture-zooming', on)
  }, [])

  const cancelAnim = useCallback(() => {
    if (animRef.current != null) {
      cancelAnimationFrame(animRef.current)
      animRef.current = null
    }
    setGestureZooming(false)
  }, [setGestureZooming])

  const paintCamera = useCallback((camera: TreeCamera) => {
    cameraRef.current = camera
    const el = cameraElRef.current
    if (el) el.style.transform = cameraCss(camera)
  }, [])

  const scheduleLod = useCallback(
    (zoom: number) => {
      if (lodTimerRef.current != null) window.clearTimeout(lodTimerRef.current)
      lodTimerRef.current = window.setTimeout(() => {
        lodTimerRef.current = null
        setLodZoom(zoom)
        setGestureZooming(false)
      }, 160)
    },
    [setGestureZooming],
  )

  const commitCamera = useCallback(
    (camera: TreeCamera) => {
      paintCamera(camera)
      setLodZoom(camera.zoom)
      setGestureZooming(false)
    },
    [paintCamera, setGestureZooming],
  )

  const zoomAtViewport = useCallback(
    (nextZoomRaw: number, clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const vx = clientX - rect.left
      const vy = clientY - rect.top
      const prev = cameraRef.current
      const nextZoom = clamp(nextZoomRaw, ZOOM_MIN, ZOOM_MAX)
      if (Math.abs(nextZoom - prev.zoom) < 0.0003) return
      const contentX = (vx - prev.x) / prev.zoom
      const contentY = (vy - prev.y) / prev.zoom
      paintCamera({
        zoom: nextZoom,
        x: vx - contentX * nextZoom,
        y: vy - contentY * nextZoom,
      })
    },
    [paintCamera],
  )

  const animateCameraTo = useCallback(
    (target: TreeCamera, duration = CAMERA_MS) => {
      cancelAnim()
      const from = { ...cameraRef.current }
      const to = {
        x: target.x,
        y: target.y,
        zoom: clamp(target.zoom, ZOOM_MIN, ZOOM_MAX),
      }
      if (
        Math.abs(to.x - from.x) < 0.4 &&
        Math.abs(to.y - from.y) < 0.4 &&
        Math.abs(to.zoom - from.zoom) < 0.002
      ) {
        commitCamera(to)
        return
      }
      const started = performance.now()
      // Do NOT toggle gesture-zooming here — that kills FLIP node transitions.
      const tick = (now: number) => {
        const t = clamp((now - started) / duration, 0, 1)
        const p = easeOutCubic(t)
        paintCamera({
          x: from.x + (to.x - from.x) * p,
          y: from.y + (to.y - from.y) * p,
          zoom: from.zoom + (to.zoom - from.zoom) * p,
        })
        if (t < 1) animRef.current = requestAnimationFrame(tick)
        else {
          animRef.current = null
          commitCamera(to)
        }
      }
      animRef.current = requestAnimationFrame(tick)
      dismissPanHint()
    },
    [cancelAnim, commitCamera, dismissPanHint, paintCamera],
  )

  const cameraAtPreferredFocus = useCallback(
    (bounds: TreeBounds, zoom = preferredZoom): TreeCamera | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const viewW = canvas.clientWidth
      const viewH = Math.max(160, canvas.clientHeight - chromeReserve)
      const center = boundsCenter(bounds)
      const z = clamp(zoom, ZOOM_MIN, ZOOM_MAX)
      // Safe inset so parents above focus aren't clipped under the top edge.
      const insetY = phone ? 18 : 24
      return {
        zoom: z,
        x: viewW / 2 - center.x * z,
        y: viewH / 2 + insetY - center.y * z,
      }
    },
    [chromeReserve, phone, preferredZoom],
  )

  const goCenter = useCallback(
    (behavior: 'instant' | 'smooth' = 'smooth') => {
      const bounds = layout.coupleBounds ?? layout.neighborhoodBounds
      const next = cameraAtPreferredFocus(bounds, preferredZoom)
      if (!next) return
      if (behavior === 'instant') {
        cancelAnim()
        commitCamera(next)
        return
      }
      animateCameraTo(next)
    },
    [
      animateCameraTo,
      cameraAtPreferredFocus,
      cancelAnim,
      commitCamera,
      layout.coupleBounds,
      layout.neighborhoodBounds,
      preferredZoom,
    ],
  )

  /** Pan to newly revealed parents; preserve zoom; slight downward bias for the child. */
  const cameraForParentReveal = useCallback(
    (parentIds: string[], zoom: number): TreeCamera | null => {
      const canvas = canvasRef.current
      if (!canvas || !parentIds.length) return null
      const nodes = layout.nodes.filter((n) => parentIds.includes(n.person.id))
      if (!nodes.length) return null

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const node of nodes) {
        minX = Math.min(minX, node.x)
        minY = Math.min(minY, node.y)
        maxX = Math.max(maxX, node.x + TREE_CARD_WIDTH)
        maxY = Math.max(maxY, node.y + TREE_CARD_HEIGHT)
      }

      const viewW = canvas.clientWidth
      const viewH = Math.max(160, canvas.clientHeight - chromeReserve)
      const z = clamp(zoom, ZOOM_MIN, ZOOM_MAX)
      const cx = (minX + maxX) / 2
      // Bias slightly below parent-group center so the child/focus stays in view.
      const cy = (minY + maxY) / 2 + TREE_CARD_HEIGHT * 0.35
      const insetY = phone ? 14 : 20
      return {
        zoom: z,
        x: viewW / 2 - cx * z,
        y: viewH / 2 + insetY - cy * z,
      }
    },
    [chromeReserve, layout.nodes, phone],
  )

  const handleSelectPerson = useCallback(
    (personId: string) => {
      openPerson(personId)
      if (focusSet.has(personId) && !layout.isHouseholdFocus && layout.focusIds.length === 1) {
        goCenter('smooth')
        return
      }
      lastActionRef.current = 'focus'
      setTreeFocus(personId)
    },
    [focusSet, goCenter, layout.focusIds.length, layout.isHouseholdFocus, openPerson, setTreeFocus],
  )

  const handleExpandParents = useCallback(
    (parentIds: string[]) => {
      lastActionRef.current = 'expand'
      pendingCameraRef.current = {
        kind: 'reveal-parents',
        parentIds: [...parentIds],
        zoom: cameraRef.current.zoom,
      }
      setExpandState((prev) => {
        const base =
          prev.focusKey === focusedTreePersonId ? prev.ids : new Set<string>()
        const next = new Set(base)
        for (const id of parentIds) next.add(id)
        return { focusKey: focusedTreePersonId, ids: next }
      })
    },
    [focusedTreePersonId],
  )

  const handleHome = useCallback(() => {
    lastActionRef.current = 'home'
    treeFocusHome()
  }, [treeFocusHome])

  // Focus change → preferred camera (expand state auto-clears via focusKey mismatch).
  useLayoutEffect(() => {
    if (!active) {
      setDidInitialCamera(false)
      prevFocusRef.current = undefined
      transitionFromFocusRef.current = undefined
      prevNodePosRef.current = new Map()
      cancelAnim()
      return
    }
    const focusChanged = prevFocusRef.current !== focusedTreePersonId
    const isFirst = !didInitialCamera
    if (isFirst || focusChanged) {
      transitionFromFocusRef.current = prevFocusRef.current
      if (lastActionRef.current !== 'home' && lastActionRef.current !== 'focus' && focusChanged) {
        lastActionRef.current = 'focus'
      }
      pendingCameraRef.current = {
        kind: 'preferred',
        behavior: isFirst ? 'instant' : 'smooth',
      }
      prevFocusRef.current = focusedTreePersonId
    }
  }, [active, cancelAnim, didInitialCamera, focusedTreePersonId])

  // FLIP: persist person-ID slots and tween old → new content positions.
  useLayoutEffect(() => {
    if (!active) return

    const prev = prevNodePosRef.current
    const next = new Map(layout.nodes.map((n) => [n.person.id, { x: n.x, y: n.y }]))
    const prevIds = [...prev.keys()]
    const nextIds = [...next.keys()]
    const prevSet = new Set(prevIds)
    const nextSet = new Set(nextIds)
    const persistent = nextIds.filter((id) => prevSet.has(id))
    const added = nextIds.filter((id) => !prevSet.has(id))
    const removed = prevIds.filter((id) => !nextSet.has(id))
    const hadPrior = prev.size > 0

    let flipped = 0
    if (hadPrior) {
      for (const id of persistent) {
        const el = nodeSlotRefs.current.get(id)
        const from = prev.get(id)
        const to = next.get(id)
        if (!el || !from || !to) continue
        const dx = from.x - to.x
        const dy = from.y - to.y
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
        el.style.transition = 'none'
        el.style.transform = `translate(${dx}px, ${dy}px)`
        void el.getBoundingClientRect()
        el.style.transition = `transform ${GRAPH_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
        el.style.transform = 'translate(0px, 0px)'
        flipped += 1
      }

      if (added.length) {
        setEnteringIds(new Set(added))
        window.setTimeout(() => setEnteringIds(new Set()), GRAPH_MS + 40)
      }

      if (removed.length) {
        const exit = removed
          .map((id) => {
            const person = peopleById[id]
            const pos = prev.get(id)
            if (!person || !pos) return null
            return { id, person, x: pos.x, y: pos.y }
          })
          .filter((n): n is { id: string; person: Person; x: number; y: number } => Boolean(n))
        if (exit.length) {
          setExitingNodes(exit)
          window.setTimeout(() => setExitingNodes([]), GRAPH_MS)
        }
      }
    } else if (added.length) {
      // First paint — no FLIP start positions.
      setEnteringIds(new Set())
    }

    const skippedReason = !hadPrior
      ? 'no-previous-positions'
      : flipped === 0 && added.length === 0 && removed.length === 0
        ? 'layout-unchanged'
        : flipped === 0 && persistent.length > 0
          ? 'persistent-nodes-unmoved'
          : null

    logTreeTransition({
      action: lastActionRef.current,
      previousFocusId: transitionFromFocusRef.current ?? prevFocusRef.current,
      nextFocusId: focusedTreePersonId,
      persistent: persistent.length,
      added: added.length,
      removed: removed.length,
      flipped,
      animationExecuted: hadPrior && (flipped > 0 || added.length > 0 || removed.length > 0),
      skipReason: skippedReason,
      visibleCount: next.size,
    })

    if (flipTimerRef.current != null) window.clearTimeout(flipTimerRef.current)
    flipTimerRef.current = window.setTimeout(() => {
      flipTimerRef.current = null
      // Clear inline FLIP styles so later CSS / transitions stay reliable.
      for (const el of nodeSlotRefs.current.values()) {
        el.style.transition = ''
        el.style.transform = ''
      }
    }, GRAPH_MS + 50)

    prevNodePosRef.current = next
  }, [active, focusedTreePersonId, layout.nodes, peopleById])

  // Apply camera after layout is valid.
  useLayoutEffect(() => {
    if (!active || !layout.coupleBounds) return
    if (!pendingCameraRef.current) return

    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const action = pendingCameraRef.current
        pendingCameraRef.current = null
        if (!action) return

        if (action.kind === 'preferred') {
          goCenter(action.behavior)
          setDidInitialCamera(true)
          return
        }

        if (action.kind === 'reveal-parents') {
          const next = cameraForParentReveal(action.parentIds, action.zoom)
          if (next) animateCameraTo(next, CAMERA_MS)
        }
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [
    active,
    animateCameraTo,
    cameraForParentReveal,
    goCenter,
    layout.coupleBounds,
    layout.nodes,
    revealedIds,
  ])

  useEffect(() => {
    if (!active) return
    setShowPanHint(true)
  }, [active])

  useEffect(() => {
    paintCamera(cameraRef.current)
  }, [layout.height, layout.width, paintCamera])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!active || !canvas) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      cancelAnim()
      setGestureZooming(true)
      const gain = event.ctrlKey || event.metaKey ? PINCH_CTRL_GAIN : WHEEL_ZOOM_GAIN
      zoomAtViewport(cameraRef.current.zoom * Math.exp(-event.deltaY * gain), event.clientX, event.clientY)
      scheduleLod(cameraRef.current.zoom)
      dismissPanHint()
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [active, cancelAnim, dismissPanHint, scheduleLod, setGestureZooming, zoomAtViewport])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!active || !canvas) return
    const distanceOf = (pointers: Map<number, { x: number; y: number }>) => {
      const pts = [...pointers.values()]
      if (pts.length < 2) return 0
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return
      if (!pinchRef.current) {
        pinchRef.current = {
          pointers: new Map(),
          startDistance: 0,
          startCamera: { ...cameraRef.current },
          anchorX: event.clientX,
          anchorY: event.clientY,
        }
      }
      pinchRef.current.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pinchRef.current.pointers.size === 2) {
        cancelAnim()
        panRef.current = null
        canvas.classList.remove('is-panning')
        setGestureZooming(true)
        pinchRef.current.startDistance = distanceOf(pinchRef.current.pointers)
        pinchRef.current.startCamera = { ...cameraRef.current }
        const pts = [...pinchRef.current.pointers.values()]
        pinchRef.current.anchorX = (pts[0].x + pts[1].x) / 2
        pinchRef.current.anchorY = (pts[0].y + pts[1].y) / 2
        dismissPanHint()
      }
    }
    const onPointerMove = (event: PointerEvent) => {
      const pinch = pinchRef.current
      if (!pinch?.pointers.has(event.pointerId)) return
      pinch.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pinch.pointers.size < 2 || pinch.startDistance < 8) return
      event.preventDefault()
      const ratio = distanceOf(pinch.pointers) / pinch.startDistance
      zoomAtViewport(
        pinch.startCamera.zoom * (1 + (ratio - 1) * TOUCH_PINCH_GAIN),
        pinch.anchorX,
        pinch.anchorY,
      )
    }
    const endPointer = (event: PointerEvent) => {
      const pinch = pinchRef.current
      if (!pinch) return
      pinch.pointers.delete(event.pointerId)
      if (pinch.pointers.size < 2) {
        pinchRef.current = pinch.pointers.size === 0 ? null : pinch
        commitCamera(cameraRef.current)
      }
    }
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove, { passive: false })
    canvas.addEventListener('pointerup', endPointer)
    canvas.addEventListener('pointercancel', endPointer)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', endPointer)
      canvas.removeEventListener('pointercancel', endPointer)
    }
  }, [active, cancelAnim, commitCamera, dismissPanHint, setGestureZooming, zoomAtViewport])

  const setNodeSlotRef = useCallback((personId: string, node: HTMLDivElement | null) => {
    if (node) nodeSlotRefs.current.set(personId, node)
    else nodeSlotRefs.current.delete(personId)
  }, [])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current
    if (!canvas || event.button !== 0 || !canPanTarget(event.target)) return
    if (pinchRef.current && pinchRef.current.pointers.size >= 2) return
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: cameraRef.current.x,
      originY: cameraRef.current.y,
    }
    if (event.pointerType !== 'touch') canvas.setPointerCapture(event.pointerId)
    canvas.classList.add('is-panning')
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId) return
    if (pinchRef.current && pinchRef.current.pointers.size >= 2) return
    paintCamera({
      ...cameraRef.current,
      x: pan.originX + (event.clientX - pan.startX),
      y: pan.originY + (event.clientY - pan.startY),
    })
  }

  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current
    const pan = panRef.current
    if (!canvas || !pan || pan.pointerId !== event.pointerId) return
    panRef.current = null
    canvas.classList.remove('is-panning')
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    dismissPanHint()
  }

  const cardDensity = (isFocus: boolean): TreeNodeDensity => {
    if (isFocus) return 'near'
    if (density === 'far') return 'medium'
    return density
  }

  return (
    <section id="tree" className={`view${active ? ' active' : ''}`} aria-hidden={!active}>
      <div className="tree-view">
        <header className="tree-view-header">
          <div className="eyebrow">Family tree</div>
          <h2>A household at the center of four lines.</h2>
          <p className="tree-view-lede">
            Click a person to focus. Use + Parents to open the generation above.
          </p>
        </header>

        <div className="tree-canvas-shell">
          <div
            className={`tree-canvas${phone ? ' tree-canvas--phone' : ''}`}
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
          >
            <div
              className={`tree-camera density-${density}`}
              ref={cameraElRef}
              style={{
                width: layout.width,
                height: layout.height,
                transform: cameraCss(cameraRef.current),
                transformOrigin: '0 0',
              }}
            >
              <svg
                className="tree-connectors"
                width={layout.width}
                height={layout.height}
                aria-hidden="true"
              >
                {layout.connectors.map((connector) => (
                  <path
                    key={connector.id}
                    d={connector.path}
                    className={`tree-connector tree-connector--${connector.kind}`}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>

              {layout.nodes.map((node) => {
                const isFocus = focusSet.has(node.person.id)
                const isHousehold = householdSet.has(node.person.id)
                const isEntering = enteringIds.has(node.person.id)
                return (
                  <div
                    key={node.person.id}
                    ref={(el) => setNodeSlotRef(node.person.id, el)}
                    className={`tree-node-slot is-visible${isFocus ? ' is-focus-slot' : ''}${isEntering ? ' is-parent-enter' : ''}`}
                    style={{ left: node.x, top: node.y }}
                  >
                    <TreeNodeCard
                      person={node.person}
                      isHousehold={isHousehold}
                      focused={isFocus}
                      density={cardDensity(isFocus)}
                      dimmed={false}
                      onSelect={handleSelectPerson}
                    />
                  </div>
                )
              })}

              {exitingNodes.map((node) => (
                <div
                  key={`exit-${node.id}`}
                  className="tree-node-slot is-exiting"
                  style={{ left: node.x, top: node.y }}
                >
                  <TreeNodeCard
                    person={node.person}
                    isHousehold={householdSet.has(node.id)}
                    focused={false}
                    density="medium"
                    dimmed
                    onSelect={() => {}}
                  />
                </div>
              ))}

              {layout.parentsOverlays.map((overlay) => (
                <div
                  key={`parents-${overlay.personId}`}
                  className="tree-parents-overlay"
                  style={{
                    left: overlay.x,
                    top: overlay.y,
                    width: PARENTS_CONTROL_WIDTH,
                    height: PARENTS_CONTROL_HEIGHT,
                  }}
                >
                  <ParentsExpandControl
                    deeperCount={overlay.deeperCount}
                    onExpand={() => handleExpandParents(overlay.parentIds)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="tree-vignette" aria-hidden="true" />

          <div className="tree-chrome" role="group" aria-label="Tree map controls">
            <TreePanHint visible={showPanHint && active && layout.nodes.length > 0} />
            <div className="tree-zoom-controls">
              <button
                type="button"
                className="tree-zoom-btn"
                aria-label="Zoom in"
                onClick={() => {
                  const canvas = canvasRef.current
                  if (!canvas) return
                  const rect = canvas.getBoundingClientRect()
                  const prev = cameraRef.current
                  const nextZoom = clamp(prev.zoom * ZOOM_BUTTON_STEP, ZOOM_MIN, ZOOM_MAX)
                  const cx = (rect.width / 2 - prev.x) / prev.zoom
                  const cy = (rect.height / 2 - prev.y) / prev.zoom
                  animateCameraTo({
                    zoom: nextZoom,
                    x: rect.width / 2 - cx * nextZoom,
                    y: rect.height / 2 - cy * nextZoom,
                  })
                }}
              >
                <Plus size={16} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                className="tree-zoom-btn"
                aria-label="Zoom out"
                onClick={() => {
                  const canvas = canvasRef.current
                  if (!canvas) return
                  const rect = canvas.getBoundingClientRect()
                  const prev = cameraRef.current
                  const nextZoom = clamp(prev.zoom / ZOOM_BUTTON_STEP, ZOOM_MIN, ZOOM_MAX)
                  const cx = (rect.width / 2 - prev.x) / prev.zoom
                  const cy = (rect.height / 2 - prev.y) / prev.zoom
                  animateCameraTo({
                    zoom: nextZoom,
                    x: rect.width / 2 - cx * nextZoom,
                    y: rect.height / 2 - cy * nextZoom,
                  })
                }}
              >
                <Minus size={16} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                className="tree-zoom-btn tree-zoom-btn--fit"
                aria-label="Center focus"
                title="Center"
                onClick={() => goCenter('smooth')}
              >
                <Crosshair size={15} strokeWidth={1.8} />
                <span>Center</span>
              </button>
              <button
                type="button"
                className="tree-zoom-btn tree-zoom-btn--fit tree-zoom-btn--family"
                aria-label="Home to Craig and Leah"
                title="Home"
                onClick={handleHome}
              >
                <Home size={14} strokeWidth={1.8} />
                <span>Home</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
