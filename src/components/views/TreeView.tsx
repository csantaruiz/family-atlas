import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus, Scan } from 'lucide-react'
import { useFamilyData } from '../../family-data/FamilyDataProvider'
import { useAppNavigation } from '../../context/AppNavigationContext'
import { useTimeline } from '../../context/TimelineContext'
import {
  buildFamilyTreeLayout,
  TREE_CARD_HEIGHT,
  TREE_CARD_WIDTH,
} from '../../utils/buildFamilyTree'
import { buildLineagePalette, type LineageId } from '../../utils/lineageColors'
import { TreeNodeCard, type TreeNodeDensity } from '../tree/TreeNodeCard'
import { TreePanHint } from '../tree/TreePanHint'
import { useMaxWidth } from '../../hooks/useMaxWidth'

type TreeViewProps = {
  active: boolean
}

type BranchFilter = 'all' | LineageId

const ZOOM_MIN = 0.38
const ZOOM_MAX = 2.15
const ZOOM_STEP = 1.12

function canPanTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return !target.closest('.tree-node-card, .tree-zoom-controls, .tree-branch-nav, button, a')
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function densityForZoom(zoom: number): TreeNodeDensity {
  if (zoom < 0.58) return 'far'
  if (zoom < 0.88) return 'medium'
  return 'near'
}

export function TreeView({ active }: TreeViewProps) {
  const { database: familyDatabase } = useFamilyData()
  const { peopleById, filteredFamilyEvents, openPerson } = useTimeline()
  const { focusedTreePersonId } = useAppNavigation()
  const phone = useMaxWidth(760)
  const canvasRef = useRef<HTMLDivElement>(null)
  const nodeSlotRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const panRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    scrollLeft: number
    scrollTop: number
  } | null>(null)
  const zoomRef = useRef(1)
  const [showPanHint, setShowPanHint] = useState(true)
  const [localFocusId, setLocalFocusId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [branchFilter, setBranchFilter] = useState<BranchFilter>('all')
  const [didInitialFit, setDidInitialFit] = useState(false)
  zoomRef.current = zoom

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

  const density = densityForZoom(zoom)
  const householdSet = useMemo(() => new Set(layout.householdIds), [layout.householdIds])

  const focusedBranchIds = useMemo(() => {
    if (branchFilter === 'all') return null
    const line = lineagePalette.lines.find((entry) => entry.id === branchFilter)
    return line?.personIds ?? null
  }, [branchFilter, lineagePalette.lines])

  const dismissPanHint = useCallback(() => {
    setShowPanHint(false)
  }, [])

  const scrollContentPointIntoView = useCallback(
    (contentX: number, contentY: number, behavior: ScrollBehavior = 'auto') => {
      const canvas = canvasRef.current
      if (!canvas) return
      const nextZoom = zoomRef.current
      canvas.scrollTo({
        left: Math.max(0, contentX * nextZoom - canvas.clientWidth / 2),
        top: Math.max(0, contentY * nextZoom - canvas.clientHeight / 2),
        behavior,
      })
    },
    [],
  )

  const fitBounds = useCallback(
    (
      bounds: { minX: number; minY: number; maxX: number; maxY: number } | null,
      behavior: ScrollBehavior = 'smooth',
    ) => {
      const canvas = canvasRef.current
      if (!canvas || !bounds) return
      const pad = phone ? 36 : 64
      const width = Math.max(TREE_CARD_WIDTH, bounds.maxX - bounds.minX + pad * 2)
      const height = Math.max(TREE_CARD_HEIGHT, bounds.maxY - bounds.minY + pad * 2)
      const nextZoom = clamp(
        Math.min(canvas.clientWidth / width, canvas.clientHeight / height) * 0.92,
        ZOOM_MIN,
        phone ? 1.35 : 1.55,
      )
      setZoom(nextZoom)
      zoomRef.current = nextZoom
      const cx = (bounds.minX + bounds.maxX) / 2
      const cy = (bounds.minY + bounds.maxY) / 2
      requestAnimationFrame(() => {
        canvas.scrollTo({
          left: Math.max(0, cx * nextZoom - canvas.clientWidth / 2),
          top: Math.max(0, cy * nextZoom - canvas.clientHeight / 2),
          behavior,
        })
      })
    },
    [phone],
  )

  const fitHousehold = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      fitBounds(layout.householdBounds, behavior)
      setBranchFilter('all')
    },
    [fitBounds, layout.householdBounds],
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
      // Keep household in frame so branch focus stays oriented to the convergence point.
      if (layout.householdBounds) {
        minX = Math.min(minX, layout.householdBounds.minX)
        minY = Math.min(minY, layout.householdBounds.minY)
        maxX = Math.max(maxX, layout.householdBounds.maxX)
        maxY = Math.max(maxY, layout.householdBounds.maxY)
      }
      fitBounds({ minX, minY, maxX, maxY }, 'smooth')
    },
    [fitBounds, layout.householdBounds, layout.nodes, lineagePalette.lines],
  )

  const applyZoomAt = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const anchorX = clientX ?? rect.left + rect.width / 2
      const anchorY = clientY ?? rect.top + rect.height / 2
      const prev = zoomRef.current
      const next = clamp(prev * factor, ZOOM_MIN, ZOOM_MAX)
      if (Math.abs(next - prev) < 0.001) return

      const contentX = (anchorX - rect.left + canvas.scrollLeft) / prev
      const contentY = (anchorY - rect.top + canvas.scrollTop) / prev
      setZoom(next)
      zoomRef.current = next
      requestAnimationFrame(() => {
        canvas.scrollLeft = contentX * next - (anchorX - rect.left)
        canvas.scrollTop = contentY * next - (anchorY - rect.top)
      })
      dismissPanHint()
    },
    [dismissPanHint],
  )

  const handleSelectPerson = useCallback(
    (personId: string) => {
      openPerson(personId)
      setLocalFocusId(personId)
      const node = layout.nodes.find((entry) => entry.person.id === personId)
      if (!node) return
      scrollContentPointIntoView(
        node.x + TREE_CARD_WIDTH / 2,
        node.y + TREE_CARD_HEIGHT / 2,
        'smooth',
      )
    },
    [layout.nodes, openPerson, scrollContentPointIntoView],
  )

  useEffect(() => {
    if (!active) {
      setDidInitialFit(false)
      return
    }
    if (didInitialFit || !layout.householdBounds) return
    const frame = requestAnimationFrame(() => {
      if (focusedTreePersonId) {
        const node = layout.nodes.find((entry) => entry.person.id === focusedTreePersonId)
        if (node) {
          setZoom(phone ? 1.05 : 1.2)
          zoomRef.current = phone ? 1.05 : 1.2
          scrollContentPointIntoView(
            node.x + TREE_CARD_WIDTH / 2,
            node.y + TREE_CARD_HEIGHT / 2,
            'auto',
          )
        }
      } else {
        fitHousehold('auto')
      }
      setDidInitialFit(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [
    active,
    didInitialFit,
    fitHousehold,
    focusedTreePersonId,
    layout.householdBounds,
    layout.nodes,
    phone,
    scrollContentPointIntoView,
  ])

  useEffect(() => {
    if (!active || !focusedTreePersonId || !didInitialFit) return
    const node = layout.nodes.find((entry) => entry.person.id === focusedTreePersonId)
    if (!node) return
    scrollContentPointIntoView(
      node.x + TREE_CARD_WIDTH / 2,
      node.y + TREE_CARD_HEIGHT / 2,
      'smooth',
    )
  }, [active, didInitialFit, focusedTreePersonId, layout.nodes, scrollContentPointIntoView])

  useEffect(() => {
    if (!active) return
    setShowPanHint(true)
  }, [active])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!active || !canvas) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.classList.toggle('is-visible', entry.isIntersecting)
        }
      },
      { root: canvas, rootMargin: '64px', threshold: 0.08 },
    )

    for (const slot of nodeSlotRefs.current.values()) {
      observer.observe(slot)
    }

    return () => observer.disconnect()
  }, [active, layout.nodes, zoom])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!active || !canvas) return

    const onWheel = (event: WheelEvent) => {
      // Trackpad pinch often sends ctrlKey; treat wheel as zoom for tree exploration.
      event.preventDefault()
      const factor = event.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP
      applyZoomAt(factor, event.clientX, event.clientY)
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [active, applyZoomAt])

  const setNodeSlotRef = useCallback((personId: string, node: HTMLDivElement | null) => {
    if (node) nodeSlotRefs.current.set(personId, node)
    else nodeSlotRefs.current.delete(personId)
  }, [])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current
    if (!canvas || event.button !== 0 || !canPanTarget(event.target)) return

    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: canvas.scrollLeft,
      scrollTop: canvas.scrollTop,
    }
    canvas.setPointerCapture(event.pointerId)
    canvas.classList.add('is-panning')
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current
    const pan = panRef.current
    if (!canvas || !pan || pan.pointerId !== event.pointerId) return

    canvas.scrollLeft = pan.scrollLeft - (event.clientX - pan.startX)
    canvas.scrollTop = pan.scrollTop - (event.clientY - pan.startY)
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
                  if (option.id === 'all') fitHousehold('smooth')
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
              className="tree-pedigree-scale"
              style={{
                width: layout.width * zoom,
                height: layout.height * zoom,
              }}
            >
              <div
                className={`tree-pedigree density-${density}`}
                style={{
                  width: layout.width,
                  height: layout.height,
                  transform: `scale(${zoom})`,
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
          </div>

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

          <div className="tree-zoom-controls" role="group" aria-label="Tree zoom">
            <button
              type="button"
              className="tree-zoom-btn"
              aria-label="Zoom in"
              onClick={() => applyZoomAt(ZOOM_STEP)}
            >
              <Plus size={16} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className="tree-zoom-btn"
              aria-label="Zoom out"
              onClick={() => applyZoomAt(1 / ZOOM_STEP)}
            >
              <Minus size={16} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className="tree-zoom-btn tree-zoom-btn--fit"
              aria-label="Fit household"
              onClick={() => fitHousehold('smooth')}
            >
              <Scan size={15} strokeWidth={1.8} />
              <span>Fit family</span>
            </button>
          </div>

          <TreePanHint visible={showPanHint && active && layout.nodes.length > 0} />
        </div>
      </div>
    </section>
  )
}
