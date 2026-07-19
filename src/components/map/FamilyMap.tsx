import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useMapExploration } from '../../context/MapExplorationContext'
import { usePinchZoom } from '../../hooks/usePinchZoom'
import type { Person } from '../../types'
import type { LineagePalette } from '../../utils/lineageColors'
import type { FamilyRegion, FamilyRegionId } from '../../utils/mapRegions'
import type { MapSubregion } from '../../utils/mapSubregions'
import type { RegionalRoute, SubregionRoute } from '../../utils/mapRoutes'
import { MAP_CAMERA_TRANSITION_MS } from '../../utils/mapCamera'
import {
  cameraTransform,
  heatIntensity,
  regionVisibleAtLevel,
  subregionVisibleAtLevel,
  visibleLayers,
} from '../../utils/mapSemanticZoom'
import { boundsFromRegionAnchors } from '../../utils/mapRegionGeometry'
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
  } = useMapExploration()

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

  const familyContentBounds = useMemo(
    () => boundsFromRegionAnchors(regions),
    [regions],
  )

  useEffect(() => {
    setFamilyContentBounds(familyContentBounds)
  }, [familyContentBounds, setFamilyContentBounds])

  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) setFrameSize({ width: rect.width, height: rect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (frameSize.width <= 0 || frameSize.height <= 0) return
    setViewportLayout({
      frameWidthPx: frameSize.width,
      frameHeightPx: frameSize.height,
      panelOpen: selection !== null,
    })
  }, [frameSize, selection, setViewportLayout])

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
      if (e.deltaY > 0) zoomOut()
      else zoomIn()
    },
    [zoomIn, zoomOut],
  )

  const handleMapPinch = useCallback(
    ({ delta }: { centerX: number; delta: number; width: number }) => {
      if (delta > 0) zoomOut()
      else zoomIn()
    },
    [zoomIn, zoomOut],
  )

  usePinchZoom(frameRef, true, handleMapPinch)

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

  return (
    <div className="map-atlas-frame" ref={frameRef} onWheel={onWheel}>
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

      <motion.div
        className="map-atlas-zoom"
        animate={{ transform: cameraTransform(camera) }}
        transition={{ duration: transitionDuration, ease: motionEase }}
      >
        <div className="map-atlas-plate">
          <svg
            className="map-atlas-svg"
            viewBox={`0 0 ${VB.width} ${VB.height}`}
            preserveAspectRatio="xMidYMid slice"
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

          <MapOverlay
            level={level}
            layers={layers}
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
          />
        </div>
      </motion.div>

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

      {selection && (
        <button type="button" className="map-clear-selection pill" onClick={clearSelection}>
          Clear selection
        </button>
      )}

      <div className="map-hint">
        {level === 'family'
          ? 'Click a region to explore · Scroll to zoom deeper'
          : 'Scroll out to widen · Click places for records'}
      </div>
    </div>
  )
}
