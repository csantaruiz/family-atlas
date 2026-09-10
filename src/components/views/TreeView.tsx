import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus, Scan } from 'lucide-react'
import { useFamilyData } from '../../family-data/FamilyDataProvider'
import { useAppNavigation } from '../../context/AppNavigationContext'
import { useTimeline } from '../../context/TimelineContext'
import {
  buildFamilyTreeLayout,
  TREE_CARD_HEIGHT,
  TREE_CARD_WIDTH,
  type TreeBounds,
} from '../../utils/buildFamilyTree'
import { buildLineagePalette, type LineageId } from '../../utils/lineageColors'
import { TreeNodeCard, type TreeNodeDensity } from '../tree/TreeNodeCard'
import { TreePanHint } from '../tree/TreePanHint'
import { useMaxWidth } from '../../hooks/useMaxWidth'

type TreeViewProps = {
  active: boolean
}

type BranchFilter = 'all' | LineageId

type TreeCamera = {
  x: number
  y: number
  zoom: number
}

const ZOOM_MIN = 0.42
const ZOOM_MAX = 2.35
const ZOOM_BUTTON_STEP = 1.16
const WHEEL_ZOOM_GAIN = 0.0012
const PINCH_CTRL_GAIN = 0.00155
const TOUCH_PINCH_GAIN = 1
const ZOOM_ANIM_MS = 380
const ZOOM_FIT_MS = 520

function canPanTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return !target.closest('.tree-node-card, .tree-chrome, .tree-branch-nav, button, a')
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}

function densityForZoom(zoom: number): TreeNodeDensity {
  if (zoom < 0.62) return 'far'
  if (zoom < 0.95) return 'medium'
  return 'near'
}

function expandBounds(bounds: TreeBounds, margin: number): TreeBounds {
  return {
    minX: bounds.minX - margin,
    minY: bounds.minY - margin,
    maxX: bounds.maxX + margin,
    maxY: bounds.maxY + margin,
  }
}

function cameraCss(camera: TreeCamera) {
  return `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`
}

export function TreeView({ active }: TreeViewProps) {
  const { database: familyDatabase } = useFamilyData()
  const { peopleById, filteredFamilyEvents, openPerson } = useTimeline()
  const { focusedTreePersonId } = useAppNavigation()
  const phone = useMaxWidth(760)
  const canvasRef = useRef<HTMLDivElement>(null)
  const cameraElRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<TreeCamera>({ x: 0, y: 0, zoom: 1 })
  const nodeSlotRefs = useRef<Map<string, HTMLDivElement>>(new Map())
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
  const [showPanHint, setShowPanHint] = useState(true)
  const [localFocusId, setLocalFocusId] = useState<string | null>(null)
  const [lodZoom, setLodZoom] = useState(1)
  const [branchFilter, setBranchFilter] = useState<BranchFilter>('all')
  const [didInitialFit, setDidInitialFit] = useState(false)

  const timelinePersonIds = useMemo(
    () => new Set(filteredFamilyEvents.map((event) => event.person.id)),
    [filteredFamilyEvents],
  )

  const layout = useMemo(() => {
    if (!active) {
      return {
        nodes: [],
        connectors: [],
        width: 800,
        height: 600,
        rootId: familyDatabase.root,
        householdIds: [familyDatabase.root],
        coupleBounds: null,
        householdBounds: null,
      }
    }
    return buildFamilyTreeLayout(peopleById, timelinePersonIds)
  }, [active, peopleById, timelinePersonIds, familyDatabase.root])

  const lineagePalette = useMemo(
    () => buildLineagePalette(familyDatabase.people, familyDatabase.root),
    [familyDatabase.people, familyDatabase.root],
  )

  const branchOptions = useMemo(
    () => [
      { id: 'all' as const, label: 'All', color: 'rgba(214, 181, 108, 0.9)' },
      ...lineagePalette.lines.map((line) => ({
        id: line.id,
        label: line.label,
        color: line.color,
      })),
    ],
    [lineagePalette.lines],
  )

  const density = densityForZoom(lodZoom)
  const householdSet = useMemo(() => new Set(layout.householdIds), [layout.householdIds])

  const focusedBranchIds = useMemo(() => {
    if (branchFilter === 'all') return null
    const line = lineagePalette.lines.find((entry) => entry.id === branchFilter)
    return line?.personIds ?? null
  }, [branchFilter, lineagePalette.lines])

  const dismissPanHint = useCallback(() => {
    setShowPanHint(false)
  }, [])

  const setZooming = useCallback((on: boolean) => {
    canvasRef.current?.classList.toggle('is-zooming', on)
  }, [])

  const cancelAnim = useCallback(() => {
    if (animRef.current != null) {
      cancelAnimationFrame(animRef.current)
      animRef.current = null
    }
    setZooming(false)
  }, [setZooming])

  const paintCamera = useCallback((camera: TreeCamera) => {
    cameraRef.current = camera
    const el = cameraElRef.current
    if (el) el.style.transform = cameraCss(camera)
  }, [])

  const scheduleLod = useCallback((zoom: number) => {
    if (lodTimerRef.current != null) window.clearTimeout(lodTimerRef.current)
    lodTimerRef.current = window.setTimeout(() => {
      lodTimerRef.current = null
      setLodZoom(zoom)
      setZooming(false)
    }, 160)
  }, [setZooming])

  const commitCamera = useCallback(
    (camera: TreeCamera) => {
      paintCamera(camera)
      setLodZoom(camera.zoom)
      setZooming(false)
    },
    [paintCamera, setZooming],
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
    (target: TreeCamera, duration = ZOOM_ANIM_MS) => {
      const canvas = canvasRef.current
      if (!canvas) return
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
      setZooming(true)

      const tick = (now: number) => {
        const t = clamp((now - started) / duration, 0, 1)
        const p = easeOutCubic(t)
        paintCamera({
          x: from.x + (to.x - from.x) * p,
          y: from.y + (to.y - from.y) * p,
          zoom: from.zoom + (to.zoom - from.zoom) * p,
        })
        if (t < 1) {
          animRef.current = requestAnimationFrame(tick)
        } else {
          animRef.current = null
          commitCamera(to)
        }
      }

      animRef.current = requestAnimationFrame(tick)
      dismissPanHint()
    },
    [cancelAnim, commitCamera, dismissPanHint, paintCamera, setZooming],
  )

  const cameraForBounds = useCallback(
    (
      bounds: TreeBounds,
      framing: 'couple' | 'household' | 'branch',
    ): TreeCamera | null => {
      const canvas = canvasRef.current
      if (!canvas) return null

      const framed =
        framing === 'couple'
          ? expandBounds(bounds, phone ? 72 : 110)
          : framing === 'branch'
            ? expandBounds(bounds, phone ? 24 : 40)
            : bounds
      const pad =
        framing === 'couple' ? (phone ? 44 : 64) : framing === 'branch' ? (phone ? 40 : 72) : phone ? 36 : 58
      const width = Math.max(TREE_CARD_WIDTH, framed.maxX - framed.minX + pad * 2)
      const height = Math.max(TREE_CARD_HEIGHT, framed.maxY - framed.minY + pad * 2)
      const fill =
        framing === 'couple' ? (phone ? 0.9 : 0.94) : framing === 'branch' ? 0.94 : phone ? 0.98 : 1.02
      const maxZoom =
        framing === 'couple' ? (phone ? 1.38 : 1.52) : framing === 'branch' ? (phone ? 1.2 : 1.4) : phone ? 1.4 : 1.62
      const chromeReserve = phone ? 96 : 84
      const viewW = canvas.clientWidth
      const viewH = Math.max(160, canvas.clientHeight - chromeReserve)
      const zoom = clamp(
        Math.min(viewW / width, viewH / height) * fill,
        ZOOM_MIN,
        maxZoom,
      )
      const cx = (framed.minX + framed.maxX) / 2
      const cy = (framed.minY + framed.maxY) / 2
      return {
        zoom,
        x: viewW / 2 - cx * zoom,
        y: (viewH / 2 + 8) - cy * zoom,
      }
    },
    [phone],
  )

  const fitBounds = useCallback(
    (
      bounds: TreeBounds | null,
      behavior: 'instant' | 'smooth' = 'smooth',
      framing: 'couple' | 'household' | 'branch' = 'household',
    ) => {
      if (!bounds) return
      const next = cameraForBounds(bounds, framing)
      if (!next) return
      if (behavior === 'instant') {
        cancelAnim()
        commitCamera(next)
        return
      }
      animateCameraTo(next, ZOOM_FIT_MS)
    },
    [animateCameraTo, cameraForBounds, cancelAnim, commitCamera],
  )

  const fitCouple = useCallback(
    (behavior: 'instant' | 'smooth' = 'smooth') => {
      fitBounds(layout.coupleBounds ?? layout.householdBounds, behavior, 'couple')
      setBranchFilter('all')
    },
    [fitBounds, layout.coupleBounds, layout.householdBounds],
  )

  const fitHousehold = useCallback(
    (behavior: 'instant' | 'smooth' = 'smooth') => {
      fitBounds(layout.householdBounds ?? layout.coupleBounds, behavior, 'household')
      setBranchFilter('all')
    },
    [fitBounds, layout.coupleBounds, layout.householdBounds],
  )

  const fitBranch = useCallback(
    (lineageId: LineageId) => {
      const line = lineagePalette.lines.find((entry) => entry.id === lineageId)
      if (!line) return
      const nodes = layout.nodes.filter((node) => line.personIds.has(node.person.id))
      if (!nodes.length) return
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
      if (layout.coupleBounds) {
        minX = Math.min(minX, layout.coupleBounds.minX)
        minY = Math.min(minY, layout.coupleBounds.minY)
        maxX = Math.max(maxX, layout.coupleBounds.maxX)
        maxY = Math.max(maxY, layout.coupleBounds.maxY)
      }
      fitBounds({ minX, minY, maxX, maxY }, 'smooth', 'branch')
    },
    [fitBounds, layout.coupleBounds, layout.nodes, lineagePalette.lines],
  )

  const focusContentPoint = useCallback(
    (contentX: number, contentY: number, zoom = cameraRef.current.zoom) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const nextZoom = clamp(zoom, ZOOM_MIN, ZOOM_MAX)
      animateCameraTo(
        {
          zoom: nextZoom,
          x: canvas.clientWidth / 2 - contentX * nextZoom,
          y: canvas.clientHeight / 2 - contentY * nextZoom,
        },
        ZOOM_FIT_MS,
      )
    },
    [animateCameraTo],
  )

  const handleSelectPerson = useCallback(
    (personId: string) => {
      openPerson(personId)
      setLocalFocusId(personId)
      const node = layout.nodes.find((entry) => entry.person.id === personId)
      if (!node) return
      focusContentPoint(
        node.x + TREE_CARD_WIDTH / 2,
        node.y + TREE_CARD_HEIGHT / 2,
        Math.max(cameraRef.current.zoom, phone ? 1.1 : 1.28),
      )
    },
    [focusContentPoint, layout.nodes, openPerson, phone],
  )

  useEffect(() => {
    if (!active) {
      setDidInitialFit(false)
      cancelAnim()
      return
    }
    if (didInitialFit || !(layout.coupleBounds || layout.householdBounds)) return
    const frame = requestAnimationFrame(() => {
      if (focusedTreePersonId) {
        const node = layout.nodes.find((entry) => entry.person.id === focusedTreePersonId)
        if (node) {
          const canvas = canvasRef.current
          const zoom = phone ? 1.15 : 1.32
          if (canvas) {
            commitCamera({
              zoom,
              x: canvas.clientWidth / 2 - (node.x + TREE_CARD_WIDTH / 2) * zoom,
              y: canvas.clientHeight / 2 - (node.y + TREE_CARD_HEIGHT / 2) * zoom,
            })
          }
        }
      } else {
        fitCouple('instant')
      }
      setDidInitialFit(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [
    active,
    cancelAnim,
    commitCamera,
    didInitialFit,
    fitCouple,
    focusedTreePersonId,
    layout.coupleBounds,
    layout.householdBounds,
    layout.nodes,
    phone,
  ])

  useEffect(() => {
    if (!active || !focusedTreePersonId || !didInitialFit) return
    const node = layout.nodes.find((entry) => entry.person.id === focusedTreePersonId)
    if (!node) return
    focusContentPoint(
      node.x + TREE_CARD_WIDTH / 2,
      node.y + TREE_CARD_HEIGHT / 2,
      Math.max(cameraRef.current.zoom, phone ? 1.1 : 1.28),
    )
  }, [active, didInitialFit, focusContentPoint, focusedTreePersonId, layout.nodes, phone])

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

    // With transform camera, all nodes stay mounted; keep household visible by default.
    for (const [id, slot] of nodeSlotRefs.current) {
      slot.classList.toggle('is-visible', householdSet.has(id) || id === focusedTreePersonId)
    }
    const reveal = window.setTimeout(() => {
      for (const slot of nodeSlotRefs.current.values()) {
        slot.classList.add('is-visible')
      }
    }, 40)
    return () => window.clearTimeout(reveal)
  }, [active, focusedTreePersonId, householdSet, layout.nodes])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!active || !canvas) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      cancelAnim()
      setZooming(true)
      const pinchLike = event.ctrlKey || event.metaKey
      const gain = pinchLike ? PINCH_CTRL_GAIN : WHEEL_ZOOM_GAIN
      const factor = Math.exp(-event.deltaY * gain)
      zoomAtViewport(cameraRef.current.zoom * factor, event.clientX, event.clientY)
      scheduleLod(cameraRef.current.zoom)
      dismissPanHint()
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [active, cancelAnim, dismissPanHint, scheduleLod, setZooming, zoomAtViewport])

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
        setZooming(true)
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
      const softened = 1 + (ratio - 1) * TOUCH_PINCH_GAIN
      zoomAtViewport(pinch.startCamera.zoom * softened, pinch.anchorX, pinch.anchorY)
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
  }, [active, cancelAnim, commitCamera, dismissPanHint, setZooming, zoomAtViewport])

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
    if (event.pointerType !== 'touch') {
      canvas.setPointerCapture(event.pointerId)
    }
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
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId)
    }
    dismissPanHint()
  }

  const branchSummaries = useMemo(() => {
    if (density !== 'far') return []
    return lineagePalette.lines.map((line) => {
      const people = familyDatabase.people.filter((person) => line.personIds.has(person.id))
      const years = people
        .map((person) => person.birthYear)
        .filter((year): year is number => year != null)
      const minYear = years.length ? Math.min(...years) : null
      const maxYear = years.length ? Math.max(...years) : null
      return {
        id: line.id,
        label: `${line.label.toUpperCase()} LINE`,
        meta: `${people.length} people${minYear != null ? ` · ${minYear}–${maxYear ?? 'present'}` : ''}`,
        color: line.color,
      }
    })
  }, [density, familyDatabase.people, lineagePalette.lines])

  return (
    <section id="tree" className={`view${active ? ' active' : ''}`} aria-hidden={!active}>
      <div className="tree-view">
        <header className="tree-view-header">
          <div className="eyebrow">Family tree</div>
          <h2>A household at the center of four lines.</h2>
          <p className="tree-view-lede">
            Craig and Leah form the living household. Ancestral branches rise above; Mateo and
            Joaquin continue below. Zoom for detail, or follow a genealogical line.
          </p>

          <div className="tree-branch-nav" role="toolbar" aria-label="Genealogical branches">
            {branchOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`tree-branch-chip${branchFilter === option.id ? ' is-active' : ''}`}
                style={{ '--tree-branch-color': option.color } as React.CSSProperties}
                onClick={() => {
                  setBranchFilter(option.id)
                  if (option.id === 'all') fitCouple('smooth')
                  else fitBranch(option.id)
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
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
                const inFocusBranch =
                  !focusedBranchIds || focusedBranchIds.has(node.person.id)
                const deep =
                  density === 'far' &&
                  Math.abs(node.generation) > 2 &&
                  !householdSet.has(node.person.id)
                const focusId = focusedTreePersonId ?? layout.rootId
                const initiallyVisible =
                  node.person.id === focusId || householdSet.has(node.person.id)
                return (
                  <div
                    key={node.person.id}
                    ref={(el) => setNodeSlotRef(node.person.id, el)}
                    className={`tree-node-slot${initiallyVisible ? ' is-visible' : ''}${deep ? ' is-distant' : ''}`}
                    style={{ left: node.x, top: node.y }}
                  >
                    <TreeNodeCard
                      person={node.person}
                      isHousehold={householdSet.has(node.person.id)}
                      focused={
                        node.person.id === focusedTreePersonId ||
                        node.person.id === localFocusId
                      }
                      density={density}
                      dimmed={!inFocusBranch}
                      onSelect={handleSelectPerson}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          <div className="tree-vignette" aria-hidden="true" />

          {density === 'far' && branchSummaries.length > 0 ? (
            <div className="tree-branch-summaries" aria-hidden="true">
              {branchSummaries.map((summary) => (
                <div
                  key={summary.id}
                  className="tree-branch-summary"
                  style={{ '--tree-branch-color': summary.color } as React.CSSProperties}
                >
                  <div className="tree-branch-summary-label">{summary.label}</div>
                  <div className="tree-branch-summary-meta">{summary.meta}</div>
                </div>
              ))}
            </div>
          ) : null}

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
                aria-label="Reset to Craig and Leah"
                title="Center on Craig and Leah"
                onClick={() => fitCouple('smooth')}
              >
                <Scan size={15} strokeWidth={1.8} />
                <span>{phone ? 'Couple' : 'Craig & Leah'}</span>
              </button>
              <button
                type="button"
                className="tree-zoom-btn tree-zoom-btn--fit tree-zoom-btn--family"
                aria-label="Fit household"
                title="Fit couple, children, and parents"
                onClick={() => fitHousehold('smooth')}
              >
                <span>Fit family</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
