import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { familyDatabase } from '../../data'
import { useAppNavigation } from '../../context/AppNavigationContext'
import { useTimeline } from '../../context/TimelineContext'
import { buildFamilyTreeLayout, TREE_CARD_HEIGHT, TREE_CARD_WIDTH } from '../../utils/buildFamilyTree'
import { TreeNodeCard } from '../tree/TreeNodeCard'
import { TreePanHint } from '../tree/TreePanHint'

type TreeViewProps = {
  active: boolean
}

type ScrollEdges = {
  top: boolean
  right: boolean
  bottom: boolean
  left: boolean
}

const SCROLL_EDGE_THRESHOLD = 12

function canPanTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return !target.closest('.tree-node-card')
}

export function TreeView({ active }: TreeViewProps) {
  const { peopleById, filteredFamilyEvents, openPerson } = useTimeline()
  const { focusedTreePersonId } = useAppNavigation()
  const canvasRef = useRef<HTMLDivElement>(null)
  const nodeSlotRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const panRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    scrollLeft: number
    scrollTop: number
  } | null>(null)
  const [showPanHint, setShowPanHint] = useState(true)
  const [scrollEdges, setScrollEdges] = useState<ScrollEdges>({
    top: false,
    right: false,
    bottom: false,
    left: false,
  })
  const root = peopleById[familyDatabase.root]

  const timelinePersonIds = useMemo(
    () => new Set(filteredFamilyEvents.map((event) => event.person.id)),
    [filteredFamilyEvents],
  )

  const layout = useMemo(() => {
    if (!active) {
      return { nodes: [], connectors: [], width: 800, height: 600, rootId: familyDatabase.root }
    }
    return buildFamilyTreeLayout(peopleById, timelinePersonIds)
  }, [active, peopleById, timelinePersonIds])

  const dismissPanHint = useCallback(() => {
    setShowPanHint(false)
  }, [])

  const updateScrollEdges = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    setScrollEdges({
      left: canvas.scrollLeft > SCROLL_EDGE_THRESHOLD,
      right: canvas.scrollLeft < canvas.scrollWidth - canvas.clientWidth - SCROLL_EDGE_THRESHOLD,
      top: canvas.scrollTop > SCROLL_EDGE_THRESHOLD,
      bottom: canvas.scrollTop < canvas.scrollHeight - canvas.clientHeight - SCROLL_EDGE_THRESHOLD,
    })
  }, [])

  useEffect(() => {
    if (!active || !layout.nodes.length) return
    const canvas = canvasRef.current
    if (!canvas) return

    const targetId = focusedTreePersonId ?? layout.rootId
    const targetNode =
      layout.nodes.find((node) => node.person.id === targetId) ??
      layout.nodes.find((node) => node.person.id === layout.rootId)
    if (!targetNode) return

    const frame = requestAnimationFrame(() => {
      canvas.scrollTo({
        left: Math.max(0, targetNode.x + TREE_CARD_WIDTH / 2 - canvas.clientWidth / 2),
        top: Math.max(0, targetNode.y + TREE_CARD_HEIGHT / 2 - canvas.clientHeight / 2),
        behavior: focusedTreePersonId ? 'smooth' : 'auto',
      })
      updateScrollEdges()
    })
    return () => cancelAnimationFrame(frame)
  }, [active, focusedTreePersonId, layout.nodes, layout.rootId, updateScrollEdges])

  useEffect(() => {
    if (!active) return
    setShowPanHint(true)
  }, [active])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!active || !canvas) return

    updateScrollEdges()

    const onScroll = () => {
      updateScrollEdges()
      dismissPanHint()
    }

    canvas.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', updateScrollEdges)

    return () => {
      canvas.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', updateScrollEdges)
    }
  }, [active, layout.width, layout.height, dismissPanHint, updateScrollEdges])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!active || !canvas) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.classList.toggle('is-visible', entry.isIntersecting)
        }
      },
      { root: canvas, rootMargin: '48px', threshold: 0.12 },
    )

    for (const slot of nodeSlotRefs.current.values()) {
      observer.observe(slot)
    }

    return () => observer.disconnect()
  }, [active, layout.nodes])

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
    updateScrollEdges()
  }

  return (
    <section id="tree" className={`view${active ? ' active' : ''}`} aria-hidden={!active}>
      <div className="tree-view">
        <header className="tree-view-header">
          <div className="eyebrow">Family tree</div>
          <h2>{layout.nodes.length} lives in this branch.</h2>
          <p className="tree-view-lede">
            Ancestors rise above {root?.name?.split(' ')[0] ?? 'the root'}; descendants branch
            below. Drag or scroll to explore — names appear as you pan.
          </p>
        </header>

        <div className="tree-canvas-shell">
          <div
            className="tree-canvas"
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
          >
            <div
              className="tree-pedigree"
              style={{ width: layout.width, height: layout.height }}
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
                const focusId = focusedTreePersonId ?? layout.rootId
                const initiallyVisible = node.person.id === focusId
                return (
                  <div
                    key={node.person.id}
                    ref={(el) => setNodeSlotRef(node.person.id, el)}
                    className={`tree-node-slot${initiallyVisible ? ' is-visible' : ''}`}
                    style={{ left: node.x, top: node.y }}
                  >
                  <TreeNodeCard
                    person={node.person}
                    isRoot={node.person.id === layout.rootId}
                    focused={node.person.id === focusedTreePersonId}
                    onSelect={openPerson}
                  />
                </div>
                )
              })}
            </div>
          </div>

          <TreePanHint visible={showPanHint && active && layout.nodes.length > 0} />

          <div
            className={`tree-scroll-edge tree-scroll-edge--left${scrollEdges.left ? ' is-active' : ''}`}
            aria-hidden="true"
          >
            <ChevronLeft size={18} strokeWidth={1.6} />
          </div>
          <div
            className={`tree-scroll-edge tree-scroll-edge--right${scrollEdges.right ? ' is-active' : ''}`}
            aria-hidden="true"
          >
            <ChevronRight size={18} strokeWidth={1.6} />
          </div>
          <div
            className={`tree-scroll-edge tree-scroll-edge--top${scrollEdges.top ? ' is-active' : ''}`}
            aria-hidden="true"
          >
            <ChevronUp size={18} strokeWidth={1.6} />
          </div>
          <div
            className={`tree-scroll-edge tree-scroll-edge--bottom${scrollEdges.bottom ? ' is-active' : ''}`}
            aria-hidden="true"
          >
            <ChevronDown size={18} strokeWidth={1.6} />
          </div>
        </div>
      </div>
    </section>
  )
}
