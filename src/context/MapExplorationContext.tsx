import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useTimeline } from './TimelineContext'
import type { FamilyRegion, FamilyRegionId } from '../utils/mapRegions'
import type { MapSubregion } from '../utils/mapSubregions'
import type { RegionalRoute, SubregionRoute } from '../utils/mapRoutes'
import {
  DEFAULT_OVERVIEW_CAMERA,
  fitCameraForRegion,
  fitCameraToBounds,
  fitOverviewCamera,
  MAP_CAMERA_TRANSITION_MS,
  MAP_PEEK_INSET_PX,
  type MapViewportLayout,
} from '../utils/mapCamera'
import { boundsFromEllipse, type MapBounds } from '../utils/mapRegionGeometry'
import {
  advanceLevel,
  retreatLevel,
  type MapCamera,
  type MapZoomLevel,
} from '../utils/mapSemanticZoom'
import type { PlaceRecord } from '../utils/placeIndex'

export type MapSelection =
  | { type: 'region'; region: FamilyRegion }
  | { type: 'subregion'; subregion: MapSubregion }
  | { type: 'place'; place: PlaceRecord }
  | { type: 'route'; route: RegionalRoute }
  | { type: 'subroute'; route: SubregionRoute }
  | null

export type MapTimelineBridge = {
  routeId: string
  yearStart: number | null
  yearEnd: number | null
  fromName: string
  toName: string
  moveCount: number
  people: { id: string; name: string }[]
} | null

type MapExplorationContextValue = {
  level: MapZoomLevel
  camera: MapCamera
  focusRegionId: FamilyRegionId | null
  focusSubregionId: string | null
  selection: MapSelection
  hoveredRouteId: string | null
  timelineBridge: MapTimelineBridge
  isTransitioning: boolean
  viewportLayout: MapViewportLayout | null
  setViewportLayout: (layout: MapViewportLayout) => void
  familyContentBounds: MapBounds | null
  setFamilyContentBounds: (bounds: MapBounds | null) => void
  exploreRegion: (region: FamilyRegion) => void
  exploreSubregion: (sub: MapSubregion) => void
  explorePlace: (place: PlaceRecord) => void
  selectRoute: (route: RegionalRoute | SubregionRoute, kind: 'route' | 'subroute') => void
  setSelection: (sel: MapSelection) => void
  hoverRoute: (bridge: MapTimelineBridge) => void
  clearHoverRoute: () => void
  zoomIn: () => void
  zoomOut: () => void
  resetExploration: () => void
  clearSelection: () => void
  refitFilteredView: () => void
  updateCameraLive: (camera: MapCamera) => void
  manualCamera: boolean
  beginManualCamera: () => void
}

const MapExplorationContext = createContext<MapExplorationContextValue | null>(null)

function layoutWithPanel(layout: MapViewportLayout): MapViewportLayout {
  if (layout.frameWidthPx < 760) {
    return { ...layout, panelOpen: true, bottomInsetPx: MAP_PEEK_INSET_PX }
  }
  return { ...layout, panelOpen: true }
}


function overviewCamera(
  layout: MapViewportLayout,
  bounds: MapBounds | null,
  panelOpen: boolean,
): MapCamera {
  if (!bounds) return DEFAULT_OVERVIEW_CAMERA
  return fitOverviewCamera(bounds, { ...layout, panelOpen })
}

function cameraForSelection(
  selection: MapSelection,
  level: MapZoomLevel,
  layout: MapViewportLayout | null,
  familyBounds: MapBounds | null,
): MapCamera {
  if (!layout || layout.frameWidthPx <= 0) {
    return DEFAULT_OVERVIEW_CAMERA
  }

  if (selection?.type === 'region') {
    return fitCameraForRegion(selection.region.bounds, layout, level)
  }
  if (selection?.type === 'subregion') {
    return fitCameraToBounds(boundsFromEllipse(selection.subregion.ellipse), layout, level)
  }
  if (selection?.type === 'place') {
    const { x, y } = selection.place.coordinate
    const pad = 3
    return fitCameraToBounds(
      { minX: x - pad, maxX: x + pad, minY: y - pad, maxY: y + pad },
      layout,
      level,
    )
  }
  if (level === 'family' && familyBounds) {
    return fitOverviewCamera(familyBounds, layout)
  }

  return familyBounds ? fitOverviewCamera(familyBounds, layout) : DEFAULT_OVERVIEW_CAMERA
}

export function MapExplorationProvider({ children }: { children: ReactNode }) {
  const { setMapHighlightYears } = useTimeline()
  const [level, setLevel] = useState<MapZoomLevel>('family')
  const [camera, setCamera] = useState<MapCamera>(DEFAULT_OVERVIEW_CAMERA)
  const [focusRegionId, setFocusRegionId] = useState<FamilyRegionId | null>(null)
  const [focusSubregionId, setFocusSubregionId] = useState<string | null>(null)
  const [selection, setSelection] = useState<MapSelection>(null)
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null)
  const [timelineBridge, setTimelineBridge] = useState<MapTimelineBridge>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [viewportLayout, setViewportLayout] = useState<MapViewportLayout | null>(null)
  const [familyContentBounds, setFamilyContentBounds] = useState<MapBounds | null>(null)
  const [manualCamera, setManualCamera] = useState(false)
  const cameraRef = useRef(camera)
  cameraRef.current = camera
  const animFrameRef = useRef<number | null>(null)

  const stopCameraAnimation = useCallback(() => {
    if (animFrameRef.current != null) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    setIsTransitioning(false)
  }, [])

  const animateCamera = useCallback((next: MapCamera) => {
    stopCameraAnimation()
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setCamera(next)
      return
    }
    const from = cameraRef.current
    const start = performance.now()
    setIsTransitioning(true)
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / MAP_CAMERA_TRANSITION_MS)
      const e = 1 - (1 - t) ** 3
      setCamera({
        cx: from.cx + (next.cx - from.cx) * e,
        cy: from.cy + (next.cy - from.cy) * e,
        scale: from.scale + (next.scale - from.scale) * e,
      })
      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(tick)
        return
      }
      setCamera(next)
      setIsTransitioning(false)
      animFrameRef.current = null
    }
    animFrameRef.current = requestAnimationFrame(tick)
  }, [stopCameraAnimation])

  const updateCameraLive = useCallback((next: MapCamera) => {
    stopCameraAnimation()
    setManualCamera(true)
    setCamera(next)
  }, [stopCameraAnimation])

  const beginManualCamera = useCallback(() => {
    stopCameraAnimation()
    setManualCamera(true)
  }, [stopCameraAnimation])

  useEffect(() => () => stopCameraAnimation(), [stopCameraAnimation])

  const familyBoundsKey = familyContentBounds
    ? `${familyContentBounds.minX}:${familyContentBounds.maxX}:${familyContentBounds.minY}:${familyContentBounds.maxY}`
    : ''

  useEffect(() => {
    if (manualCamera) return
    if (level === 'family' || !selection || !viewportLayout) return
    animateCamera(cameraForSelection(selection, level, viewportLayout, familyContentBounds))
    // Refit when viewport dimensions or panel visibility change — not on duplicate selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    manualCamera,
    viewportLayout?.frameWidthPx,
    viewportLayout?.frameHeightPx,
    viewportLayout?.panelOpen,
  ])

  useEffect(() => {
    if (manualCamera) return
    if (level !== 'family' || !viewportLayout) return
    animateCamera(
      overviewCamera(viewportLayout, familyContentBounds, viewportLayout.panelOpen),
    )
    // Refit family overview when content bounds or chrome layout change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    manualCamera,
    level,
    familyBoundsKey,
    viewportLayout?.frameWidthPx,
    viewportLayout?.frameHeightPx,
    viewportLayout?.panelOpen,
  ])

  const exploreRegion = useCallback(
    (region: FamilyRegion) => {
      setManualCamera(false)
      setFocusRegionId(region.id)
      setFocusSubregionId(null)
      setLevel('regional')
      setSelection({ type: 'region', region })
      const next = viewportLayout
        ? fitCameraForRegion(region.bounds, layoutWithPanel(viewportLayout), 'regional')
        : DEFAULT_OVERVIEW_CAMERA
      animateCamera(next)
    },
    [animateCamera, viewportLayout],
  )

  const exploreSubregion = useCallback(
    (sub: MapSubregion) => {
      setManualCamera(false)
      setFocusRegionId(sub.parentRegionId)
      setFocusSubregionId(sub.id)
      setLevel('local')
      setSelection({ type: 'subregion', subregion: sub })
      const next = viewportLayout
        ? fitCameraToBounds(boundsFromEllipse(sub.ellipse), layoutWithPanel(viewportLayout), 'local')
        : DEFAULT_OVERVIEW_CAMERA
      animateCamera(next)
    },
    [animateCamera, viewportLayout],
  )

  const explorePlace = useCallback(
    (place: PlaceRecord) => {
      setManualCamera(false)
      setLevel('place')
      setSelection({ type: 'place', place })
      const { x, y } = place.coordinate
      const next = viewportLayout
        ? fitCameraToBounds(
            { minX: x - 3, maxX: x + 3, minY: y - 3, maxY: y + 3 },
            layoutWithPanel(viewportLayout),
            'place',
          )
        : DEFAULT_OVERVIEW_CAMERA
      animateCamera(next)
    },
    [animateCamera, viewportLayout],
  )

  const selectRoute = useCallback(
    (route: RegionalRoute | SubregionRoute, kind: 'route' | 'subroute') => {
      if (kind === 'route') {
        setSelection({ type: 'route', route: route as RegionalRoute })
      } else {
        setSelection({ type: 'subroute', route: route as SubregionRoute })
      }
      if (route.yearMin != null && route.yearMax != null) {
        setMapHighlightYears({ start: route.yearMin, end: route.yearMax })
      }
    },
    [setMapHighlightYears],
  )

  const hoverRoute = useCallback(
    (bridge: MapTimelineBridge) => {
      setTimelineBridge(bridge)
      setHoveredRouteId(bridge?.routeId ?? null)
      if (bridge?.yearStart != null && bridge.yearEnd != null) {
        setMapHighlightYears({ start: bridge.yearStart, end: bridge.yearEnd })
      }
    },
    [setMapHighlightYears],
  )

  const clearHoverRoute = useCallback(() => {
    setTimelineBridge(null)
    setHoveredRouteId(null)
    setMapHighlightYears(null)
  }, [setMapHighlightYears])

  const zoomIn = useCallback(() => {
    setLevel((prev) => {
      const next = advanceLevel(prev)
      if (next === prev) return prev
      if (selection && viewportLayout) {
        animateCamera(cameraForSelection(selection, next, viewportLayout, familyContentBounds))
      }
      return next
    })
  }, [selection, viewportLayout, animateCamera])

  const zoomOut = useCallback(() => {
    setLevel((prev) => {
      const next = retreatLevel(prev)
      if (next === 'family') {
        setFocusRegionId(null)
        setFocusSubregionId(null)
        animateCamera(
          viewportLayout
            ? overviewCamera(viewportLayout, familyContentBounds, viewportLayout.panelOpen)
            : DEFAULT_OVERVIEW_CAMERA,
        )
      } else if (selection && viewportLayout) {
        animateCamera(cameraForSelection(selection, next, viewportLayout, familyContentBounds))
      }
      return next
    })
  }, [selection, viewportLayout, familyContentBounds, animateCamera])

  const resetExploration = useCallback(() => {
    setManualCamera(false)
    setLevel('family')
    setFocusRegionId(null)
    setFocusSubregionId(null)
    setSelection(null)
    setTimelineBridge(null)
    setHoveredRouteId(null)
    setMapHighlightYears(null)
    animateCamera(
      viewportLayout
        ? overviewCamera(viewportLayout, familyContentBounds, false)
        : DEFAULT_OVERVIEW_CAMERA,
    )
  }, [animateCamera, setMapHighlightYears, viewportLayout, familyContentBounds])

  const refitFilteredView = useCallback(() => {
    if (!viewportLayout) return

    if (level === 'family') {
      animateCamera(
        overviewCamera(viewportLayout, familyContentBounds, viewportLayout.panelOpen),
      )
      return
    }

    if (selection) {
      animateCamera(cameraForSelection(selection, level, viewportLayout, familyContentBounds))
    }
  }, [viewportLayout, level, selection, familyContentBounds, animateCamera])

  const clearSelection = useCallback(() => {
    setSelection(null)
    if (level === 'place' || level === 'record') {
      setLevel('local')
    } else if (level === 'local') {
      setLevel('regional')
      setFocusSubregionId(null)
    } else if (level === 'regional') {
      resetExploration()
    }
  }, [level, resetExploration])

  const value = useMemo(
    (): MapExplorationContextValue => ({
      level,
      camera,
      focusRegionId,
      focusSubregionId,
      selection,
      hoveredRouteId,
      timelineBridge,
      isTransitioning,
      viewportLayout,
      setViewportLayout,
      familyContentBounds,
      setFamilyContentBounds,
      exploreRegion,
      exploreSubregion,
      explorePlace,
      selectRoute,
      setSelection,
      hoverRoute,
      clearHoverRoute,
      zoomIn,
      zoomOut,
      resetExploration,
      clearSelection,
      refitFilteredView,
      updateCameraLive,
      manualCamera,
      beginManualCamera,
    }),
    [
      level,
      camera,
      focusRegionId,
      focusSubregionId,
      selection,
      hoveredRouteId,
      timelineBridge,
      isTransitioning,
      viewportLayout,
      familyContentBounds,
      exploreRegion,
      exploreSubregion,
      explorePlace,
      selectRoute,
      hoverRoute,
      clearHoverRoute,
      zoomIn,
      zoomOut,
      resetExploration,
      clearSelection,
      refitFilteredView,
      updateCameraLive,
      manualCamera,
      beginManualCamera,
    ],
  )

  return (
    <MapExplorationContext.Provider value={value}>{children}</MapExplorationContext.Provider>
  )
}

export function useMapExploration() {
  const ctx = useContext(MapExplorationContext)
  if (!ctx) throw new Error('useMapExploration must be used within MapExplorationProvider')
  return ctx
}

/** Optional hook for components outside the provider */
export function useMapExplorationOptional() {
  return useContext(MapExplorationContext)
}
