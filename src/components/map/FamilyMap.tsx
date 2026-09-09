import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useMapExploration } from '../../context/MapExplorationContext'
import { useMapCameraGestures } from '../../hooks/useMapCameraGestures'
import { useMaxWidth } from '../../hooks/useMaxWidth'
import {
  cameraHasLeftOverview,
  clampCameraToContent,
  panLimitsForCamera,
  zoomCameraAt,
} from '../../utils/mapCameraGestures'
import { MAP_BOTTOM_CHROME_PX, MAP_CAMERA_TRANSITION_MS, MAP_PEEK_INSET_PX } from '../../utils/mapCamera'
import type { Person } from '../../types'
import type { LineagePalette } from '../../utils/lineageColors'
import type { FamilyRegion, FamilyRegionId } from '../../utils/mapRegions'
import type { MapSubregion } from '../../utils/mapSubregions'
import type { RegionalRoute, SubregionRoute } from '../../utils/mapRoutes'
import {
  DEFAULT_CAMERA,
  heatIntensity,
  regionVisibleAtLevel,
  subregionVisibleAtLevel,
  viewBoxCameraForContainer,
  visibleLayers,
} from '../../utils/mapSemanticZoom'
import { boundsFromRegionGeography, boundsFromResolvedPlaces } from '../../utils/mapRegionGeometry'
import { MAP_CAMERA_DEBUG } from '../../utils/mapDebug'
import { MAP_VIEW_BOX } from '../../utils/mapProjection'
import { formatRouteTravelers, formatRouteYearLabel } from '../../utils/mapMigrationMotion'
import { MigrationRouteLayer, MigrationRouteTooltip } from './MigrationRouteLayer'
import { MapDebugOverlay } from './MapDebugOverlay'
import { MapOverlay } from './MapOverlay'
import { WorldMapBackground } from './WorldMapBackground'

export type { MapSelection } from '../../context/MapExplorationContext'

type FamilyMapProps = {
  regions: FamilyRegion[]
  subregions: MapSubregion[]
  routes: RegionalRoute[]
  subroutes: SubregionRoute[]
  showRoutes: boolean
  filterKey: string
  lineagePalette: LineagePalette | null
  people: Person[]
  onOpenFilters?: () => void
}

const VB = MAP_VIEW_BOX
const motionEase = [0.22, 0.8, 0.2, 1] as const

const ZOOM_LEVEL_LABELS: Record<string, string> = {
  family: 'Entire family',
  regional: 'Regional view',
  local: 'Local chapters',
  place: 'Known places',
  record: 'Individual records',
}

export function FamilyMap({
  regions,
  subregions,
  routes,
  subroutes,
  showRoutes,
  filterKey,
  lineagePalette,
  people,
  onOpenFilters,
}: FamilyMapProps) {
  const prefersReducedMotion = useReducedMotion()
  const frameRef = useRef<HTMLDivElement>(null)
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 })

  const {
    level,
    camera,
    focusRegionId,
    focusSubregionId,
    selection,
    hoveredRouteId,
    viewportLayout,
    setViewportLayout,
    setFamilyContentBounds,
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
    updateCameraLive,
    beginManualCamera,
    isTransitioning,
  } = useMapExploration()
  const phone = useMaxWidth(760)
  const [liveCamera, setLiveCamera] = useState(false)
  const [gestureMoved, setGestureMoved] = useState(false)
  const [gestureMode, setGestureMode] = useState<'idle' | 'pan' | 'pinch' | 'auto-focus'>('idle')
  const cameraRef = useRef(camera)
  cameraRef.current = camera

  const [hoveredRegionId, setHoveredRegionId] = useState<FamilyRegionId | null>(null)
  const [routeTooltipPos, setRouteTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const [routeTooltipRoute, setRouteTooltipRoute] = useState<RegionalRoute | SubregionRoute | null>(
    null,
  )
  const layers = visibleLayers(level)
  const maxPlaceCount = useMemo(
    () => Math.max(1, ...regions.map((r) => r.placeCount)),
    [regions],
  )

  const familyContentBounds = useMemo(() => {
    const fromPlaces = boundsFromResolvedPlaces(
      regions.flatMap((region) => region.places),
      8,
    )
    return fromPlaces ?? boundsFromRegionGeography(regions)
  }, [regions])

  useEffect(() => {
    setFamilyContentBounds(familyContentBounds)
  }, [familyContentBounds, setFamilyContentBounds])

  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const applySize = (width: number, height: number) => {
      if (width <= 0 || height <= 0) return
      setFrameSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      )
    }
    const fromBox = () => {
      const rect = el.getBoundingClientRect()
      applySize(rect.width, rect.height)
    }
    fromBox()
    const raf = window.requestAnimationFrame(fromBox)
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) applySize(rect.width, rect.height)
    })
    ro.observe(el)
    return () => {
      window.cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  useEffect(() => {
    if (frameSize.width <= 0 || frameSize.height <= 0) return
    setViewportLayout({
      frameWidthPx: frameSize.width,
      frameHeightPx: frameSize.height,
      panelOpen: selection !== null,
      bottomInsetPx: phone
        ? selection
          ? MAP_PEEK_INSET_PX
          : 0
        : MAP_BOTTOM_CHROME_PX,
    })
  }, [frameSize, selection, phone, setViewportLayout])

  const selectedRegionId =
    selection?.type === 'region' ? selection.region.id : focusRegionId
  const selectedRouteId =
    selection?.type === 'route'
      ? selection.route.id
      : selection?.type === 'subroute'
        ? selection.route.id
        : null
  const selectedPlaceId =
    selection?.type === 'place' ? selection.place.id : null

  const visiblePlaces = useMemo(() => {
    if (!layers.showPlaces) return []
    if (focusSubregionId) {
      const sub = subregions.find((s) => s.id === focusSubregionId)
      return sub?.places.filter((p) => p.coordinate.resolved) ?? []
    }
    if (focusRegionId) {
      return subregions
        .filter((s) => s.parentRegionId === focusRegionId)
        .flatMap((s) => s.places.filter((p) => p.coordinate.resolved))
    }
    return []
  }, [layers.showPlaces, focusRegionId, focusSubregionId, subregions])

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      if (phone) {
        const rect = frameRef.current?.getBoundingClientRect()
        if (!rect) return
        const originLeft = ((e.clientX - rect.left) / rect.width) * 100
        const originTop = ((e.clientY - rect.top) / rect.height) * 100
        const factor = e.deltaY > 0 ? 0.94 : 1.06
        beginManualCamera()
        updateCameraLive(
          clampCameraToContent(
            zoomCameraAt(cameraRef.current, factor, originLeft, originTop, rect),
            familyContentBounds,
            rect,
          ),
        )
        setGestureMoved(true)
        return
      }
      if (e.deltaY > 0) zoomOut()
      else zoomIn()
    },
    [phone, zoomIn, zoomOut, updateCameraLive, beginManualCamera, familyContentBounds],
  )

  useMapCameraGestures(frameRef, phone, {
    getCamera: () => cameraRef.current,
    applyCamera: (next) => {
      updateCameraLive(next)
      setGestureMoved(true)
    },
    bounds: familyContentBounds,
    onGestureStart: (mode) => {
      beginManualCamera()
      setLiveCamera(true)
      setGestureMode(mode)
    },
    onGestureEnd: () => {
      setLiveCamera(false)
      setGestureMode('idle')
    },
  })

  const activeRoutes = layers.showMajorRoutes ? routes : layers.showLocalRoutes ? subroutes : []
  const routeKind = layers.showMajorRoutes ? 'route' : 'subroute'

  const handleRouteHover = useCallback(
    (route: RegionalRoute | SubregionRoute) => {
      setRouteTooltipRoute(route)
      hoverRoute({
        routeId: route.id,
        yearStart: route.yearMin,
        yearEnd: route.yearMax,
        fromName: route.fromName,
        toName: route.toName,
        moveCount: route.moveCount,
        people: route.people,
      })
    },
    [hoverRoute],
  )

  const handleRouteMove = useCallback(
    (route: RegionalRoute | SubregionRoute, position: { x: number; y: number }) => {
      const frame = frameRef.current
      if (!frame) return
      const rect = frame.getBoundingClientRect()
      setRouteTooltipRoute(route)
      setRouteTooltipPos({
        x: position.x - rect.left + 14,
        y: position.y - rect.top + 14,
      })
    },
    [],
  )

  const handleRouteLeave = useCallback(() => {
    setRouteTooltipPos(null)
    setRouteTooltipRoute(null)
    clearHoverRoute()
  }, [clearHoverRoute])

  const transitionDuration = prefersReducedMotion ? 0.01 : MAP_CAMERA_TRANSITION_MS / 1000
  const outlineWidth = 1.15
  const viewBox = viewBoxCameraForContainer(camera, frameSize.width, frameSize.height)
  const viewBoxAttr =
    frameSize.width > 0 && frameSize.height > 0
      ? `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`
      : `0 0 ${VB.width} ${VB.height}`
  const panLimits = familyContentBounds
    ? panLimitsForCamera(camera, familyContentBounds, frameSize)
    : null
  const exclusionRects =
    frameSize.width > 0
      ? phone
        ? [
            { left: 8, top: 8, w: 96, h: 40 },
            ...(gestureMoved || cameraHasLeftOverview(camera, DEFAULT_CAMERA)
              ? [{ left: 108, top: 8, w: 108, h: 40 }]
              : []),
            ...(!selection
              ? [{ left: 12, top: frameSize.height - 52, w: frameSize.width - 24, h: 40 }]
              : []),
            ...(selection
              ? [{ left: 0, top: frameSize.height - 148, w: frameSize.width, h: 148 }]
              : []),
          ]
        : (() => {
            const introW = Math.min(328, frameSize.width * 0.26)
            const introH = Math.min(310, frameSize.height * 0.4)
            const filterW = Math.min(268, frameSize.width * 0.22)
            const filterH = Math.min(200, frameSize.height * 0.3)
            const insightW = Math.min(680, frameSize.width * 0.52)
            const insightH = Math.min(150, frameSize.height * 0.22)
            const edge = 16
            const insightLeft = Math.max(edge, (frameSize.width - insightW) * 0.42)
            return [
              { left: edge, top: edge, w: introW + 12, h: introH },
              {
                left: frameSize.width - filterW - edge - 12,
                top: edge,
                w: filterW + 12,
                h: filterH,
              },
              {
                left: insightLeft,
                top: frameSize.height - insightH - edge,
                w: insightW,
                h: insightH,
              },
            ]
          })()
      : []

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    ;(window as Window & { __ATLAS_MAP_CAMERA?: unknown }).__ATLAS_MAP_CAMERA = {
      scale: camera.scale,
      viewBox,
      cx: camera.cx,
      cy: camera.cy,
      minPan: panLimits ? { x: panLimits.minCx, y: panLimits.minCy } : null,
      maxPan: panLimits ? { x: panLimits.maxCx, y: panLimits.maxCy } : null,
      selectedRegion: focusRegionId,
      gestureMode: liveCamera ? gestureMode : 'idle',
    }
  }

  return (
    <div
      className={`map-atlas-frame${phone ? ' map-atlas-frame--touch' : ''}`}
      ref={frameRef}
      onWheel={onWheel}
    >
      {routeTooltipRoute && routeTooltipPos && (
        <MigrationRouteTooltip
          fromName={routeTooltipRoute.fromName}
          toName={routeTooltipRoute.toName}
          travelers={formatRouteTravelers(routeTooltipRoute)}
          yearLabel={formatRouteYearLabel(routeTooltipRoute)}
          moveCount={routeTooltipRoute.moveCount}
          x={routeTooltipPos.x}
          y={routeTooltipPos.y}
        />
      )}

      {level !== 'family' && (
        <button
          type="button"
          className="map-back-overview pill"
          onClick={resetExploration}
          aria-label="Back to overview"
        >
          ← Back to overview
        </button>
      )}

      <div className="map-atlas-zoom">
        <div className="map-atlas-plate">
          <svg
            className="map-atlas-svg"
            viewBox={viewBoxAttr}
            preserveAspectRatio="none"
            role="img"
            aria-label="Interactive family migration map"
          >
          <WorldMapBackground />

          <g className="map-heat-layer" aria-hidden="true">
            <AnimatePresence mode="sync">
              {regions.map((region) => {
                if (!regionVisibleAtLevel(region.id, level, focusRegionId)) return null
                const intensity = heatIntensity(region.placeCount, maxPlaceCount)
                const { cx, cy, rx, ry } = region.ellipse
                const faded = layers.fadeMajorRegions && focusRegionId !== region.id
                return (
                  <motion.ellipse
                    key={`heat-${region.id}-${filterKey}`}
                    cx={cx}
                    cy={cy}
                    rx={rx}
                    ry={ry}
                    className="map-heat-haze"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: faded ? intensity * 0.35 : intensity }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: transitionDuration, ease: motionEase }}
                    style={{ '--heat-intensity': intensity } as React.CSSProperties}
                  />
                )
              })}
            </AnimatePresence>
          </g>

          {showRoutes && activeRoutes.length > 0 && (
            <MigrationRouteLayer
              routes={activeRoutes}
              routeKind={routeKind}
              filterKey={filterKey}
              focusRegionId={focusRegionId}
              selectedRouteId={selectedRouteId}
              hoveredRouteId={hoveredRouteId}
              transitionDuration={transitionDuration}
              onRouteHover={handleRouteHover}
              onRouteMove={handleRouteMove}
              onRouteLeave={handleRouteLeave}
              onRouteSelect={(route, kind) => {
                handleRouteLeave()
                selectRoute(route, kind)
              }}
              lineagePalette={lineagePalette}
              people={people}
            />
          )}

          {layers.showMajorHalos && (
            <g className="map-regions-layer" aria-hidden="true">
              <AnimatePresence mode="sync">
                {regions.map((region) => {
                  if (!regionVisibleAtLevel(region.id, level, focusRegionId)) return null
                  const { cx, cy, rx, ry } = region.ellipse
                  const isSelected = selectedRegionId === region.id
                  const dimmed =
                    focusRegionId != null && region.id !== focusRegionId && !isSelected
                  const faded = layers.fadeMajorRegions && !isSelected

                  return (
                    <motion.ellipse
                      key={`region-halo-${region.id}-${filterKey}`}
                      cx={cx}
                      cy={cy}
                      rx={rx}
                      ry={ry}
                      className={`map-region-oval map-region-oval--major${isSelected ? ' map-region-group--selected' : ''}${dimmed ? ' map-layer-dimmed' : ''}${faded ? ' map-region-group--faded' : ''}`}
                      vectorEffect="non-scaling-stroke"
                      strokeWidth={outlineWidth}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: dimmed ? 0.22 : faded ? 0.38 : isSelected ? 0.72 : 0.58 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: transitionDuration, ease: motionEase }}
                      pointerEvents="none"
                    />
                  )
                })}
              </AnimatePresence>
            </g>
          )}

          {layers.showSubregions && (
            <g className="map-subregions-layer" aria-hidden="true">
              <AnimatePresence mode="sync">
                {subregions.map((sub) => {
                  if (!subregionVisibleAtLevel(sub, level, focusRegionId, focusSubregionId)) {
                    return null
                  }
                  const { cx, cy, rx, ry } = sub.ellipse
                  const isSelected =
                    selection?.type === 'subregion' && selection.subregion.id === sub.id
                  const dimmed = focusSubregionId != null && sub.id !== focusSubregionId && !isSelected

                  return (
                    <motion.ellipse
                      key={`sub-halo-${sub.id}-${filterKey}`}
                      cx={cx}
                      cy={cy}
                      rx={rx}
                      ry={ry}
                      className={`map-region-oval map-region-oval--sub${isSelected ? ' map-region-group--selected' : ''}${dimmed ? ' map-layer-dimmed' : ''}`}
                      vectorEffect="non-scaling-stroke"
                      strokeWidth={outlineWidth}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: dimmed ? 0.35 : 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: transitionDuration, ease: motionEase }}
                      pointerEvents="none"
                    />
                  )
                })}
              </AnimatePresence>
            </g>
          )}
        </svg>
        </div>
      </div>

          <MapOverlay
            level={level}
            layers={layers}
            camera={camera}
            frameWidth={frameSize.width}
            frameHeight={frameSize.height}
            regions={regions}
            subregions={subregions}
            places={visiblePlaces}
            focusRegionId={focusRegionId}
            focusSubregionId={focusSubregionId}
            selectedPlaceId={selectedPlaceId}
            hoveredRegionId={hoveredRegionId}
            filterKey={filterKey}
            onRegionClick={exploreRegion}
            onSubregionClick={exploreSubregion}
            onPlaceClick={explorePlace}
            onRegionHover={setHoveredRegionId}
            instant={liveCamera || isTransitioning}
            zoomScale={camera.scale}
            exclusionRects={exclusionRects}
          />

      <MapDebugOverlay
        regions={regions}
        subregions={subregions}
        camera={camera}
        level={level}
        layout={viewportLayout}
        focusRegionId={focusRegionId}
      />

      <div className="map-zoom-indicator">
        <span className="map-zoom-level">{ZOOM_LEVEL_LABELS[level]}</span>
      </div>

      {phone && onOpenFilters ? (
        <button
          type="button"
          className="map-filters-chip"
          onClick={onOpenFilters}
        >
          Filters
        </button>
      ) : null}

      {phone && (gestureMoved || cameraHasLeftOverview(camera, DEFAULT_CAMERA)) ? (
        <button
          type="button"
          className="map-reset-view"
          onClick={() => {
            resetExploration()
            setGestureMoved(false)
            setGestureMode('idle')
          }}
        >
          Reset view
        </button>
      ) : null}

      {selection && (
        <button type="button" className="map-clear-selection pill" onClick={clearSelection}>
          Clear selection
        </button>
      )}

      {MAP_CAMERA_DEBUG ? (
        <div className="map-camera-hud" aria-hidden="true">
          <div>scale {camera.scale.toFixed(3)}</div>
          <div>
            vb {viewBox.minX.toFixed(1)} {viewBox.minY.toFixed(1)} {viewBox.width.toFixed(1)}×
            {viewBox.height.toFixed(1)}
          </div>
          <div>cx {camera.cx.toFixed(2)} cy {camera.cy.toFixed(2)}</div>
          {panLimits ? (
            <div>
              pan {panLimits.minCx.toFixed(1)}–{panLimits.maxCx.toFixed(1)} / {panLimits.minCy.toFixed(1)}–{panLimits.maxCy.toFixed(1)}
            </div>
          ) : null}
          <div>sel {focusRegionId ?? 'none'}</div>
          <div>gesture {liveCamera ? gestureMode : 'idle'}</div>
        </div>
      ) : null}

      {!(phone && selection) ? (
      <div className="map-hint">
        {level === 'family' ? (
          <>
            <span className="hint-item-fine">Click a region to explore · Scroll to zoom deeper</span>
            <span className="hint-item-coarse">Tap a region to explore · Pinch to zoom deeper</span>
          </>
        ) : (
          <>
            <span className="hint-item-fine">Scroll out to widen · Click places for records</span>
            <span className="hint-item-coarse">Pinch out to widen · Tap places for records</span>
          </>
        )}
      </div>
      ) : null}
    </div>
  )
}
