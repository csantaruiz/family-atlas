import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useMapExploration } from '../../context/MapExplorationContext'
import type { FamilyRegion, FamilyRegionId } from '../../utils/mapRegions'
import type { MapSubregion } from '../../utils/mapSubregions'
import type { RegionalRoute, SubregionRoute } from '../../utils/mapRoutes'
import { curvedRoutePath } from '../../utils/mapRoutes'
import { MAP_CAMERA_TRANSITION_MS } from '../../utils/mapCamera'
import {
  cameraTransform,
  heatIntensity,
  regionVisibleAtLevel,
  subregionVisibleAtLevel,
  visibleLayers,
} from '../../utils/mapSemanticZoom'
import type { PlaceRecord } from '../../utils/placeIndex'
import { MAP_VIEW_BOX } from '../../utils/mapProjection'
import { MapDebugOverlay } from './MapDebugOverlay'
import { MapOverlay } from './MapOverlay'
import { WorldMapBackground } from './WorldMapBackground'

export type { MapSelection } from '../../context/MapExplorationContext'

type FamilyMapProps = {
  regions: FamilyRegion[]
  subregions: MapSubregion[]
  routes: RegionalRoute[]
  subroutes: SubregionRoute[]
  unresolved: PlaceRecord[]
  showRoutes: boolean
  filterKey: string
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
  unresolved,
  showRoutes,
  filterKey,
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
    timelineBridge,
    viewportLayout,
    setViewportLayout,
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
  const layers = visibleLayers(level)
  const maxPlaceCount = useMemo(
    () => Math.max(1, ...regions.map((r) => r.placeCount)),
    [regions],
  )

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

  const activeRoutes = layers.showMajorRoutes ? routes : layers.showLocalRoutes ? subroutes : []
  const routeKind = layers.showMajorRoutes ? 'route' : 'subroute'

  const handleRouteHover = useCallback(
    (route: RegionalRoute | SubregionRoute) => {
      if (route.yearMin == null || route.yearMax == null) return
      hoverRoute({
        routeId: route.id,
        yearStart: route.yearMin,
        yearEnd: route.yearMax,
        fromName: route.fromName,
        toName: route.toName,
        moveCount: route.moveCount,
      })
    },
    [hoverRoute],
  )

  const transitionDuration = prefersReducedMotion ? 0.01 : MAP_CAMERA_TRANSITION_MS / 1000

  return (
    <div className="map-atlas-frame" ref={frameRef} onWheel={onWheel}>
      {timelineBridge && (
        <div className="map-timeline-bridge" aria-hidden="true">
          <span className="map-timeline-bridge-label">
            {timelineBridge.fromName} → {timelineBridge.toName}
          </span>
          <span className="map-timeline-bridge-years">
            {timelineBridge.yearStart}–{timelineBridge.yearEnd}
          </span>
        </div>
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
        <svg
          className="map-atlas-svg"
          viewBox={`0 0 ${VB.width} ${VB.height}`}
          preserveAspectRatio="xMidYMid meet"
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
                    rx={rx * 1.15}
                    ry={ry * 1.15}
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
            <g className="map-routes-layer">
              <AnimatePresence mode="sync">
                {activeRoutes.map((route) => {
                  const isSelected = selectedRouteId === route.id
                  const isHovered = hoveredRouteId === route.id
                  const dimmed =
                    focusRegionId != null &&
                    routeKind === 'route' &&
                    (route as RegionalRoute).fromRegionId !== focusRegionId &&
                    (route as RegionalRoute).toRegionId !== focusRegionId &&
                    !isSelected

                  if (routeKind === 'route' && focusRegionId) {
                    const rr = route as RegionalRoute
                    if (
                      rr.fromRegionId !== focusRegionId &&
                      rr.toRegionId !== focusRegionId &&
                      !isSelected
                    ) {
                      return null
                    }
                  }

                  return (
                    <motion.g
                      key={`${routeKind}-${route.id}-${filterKey}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: dimmed ? 0.2 : 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: transitionDuration, ease: motionEase }}
                    >
                      <path
                        d={curvedRoutePath(route.from, route.to)}
                        className="map-route-hit"
                        fill="none"
                        stroke="transparent"
                        strokeWidth={2.8}
                        vectorEffect="non-scaling-stroke"
                        tabIndex={0}
                        role="button"
                        aria-label={`Migration corridor ${route.fromName} to ${route.toName}, ${route.moveCount} documented moves`}
                        onMouseEnter={() => handleRouteHover(route)}
                        onMouseLeave={clearHoverRoute}
                        onFocus={() => handleRouteHover(route)}
                        onBlur={clearHoverRoute}
                        onClick={(e) => {
                          e.stopPropagation()
                          selectRoute(route, routeKind)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            selectRoute(route, routeKind)
                          }
                        }}
                      />
                      <path
                        d={curvedRoutePath(route.from, route.to)}
                        className={`map-route map-route--${route.confidence}${prefersReducedMotion ? '' : ' map-route--draw'}${isSelected ? ' map-route--selected' : ''}${isHovered ? ' map-route--hovered' : ''}`}
                        fill="none"
                        vectorEffect="non-scaling-stroke"
                        pointerEvents="none"
                        aria-hidden="true"
                      />
                      {isHovered && !prefersReducedMotion && (
                        <path
                          d={curvedRoutePath(route.from, route.to)}
                          className="map-route-pulse"
                          fill="none"
                          vectorEffect="non-scaling-stroke"
                          pointerEvents="none"
                          aria-hidden="true"
                        />
                      )}
                    </motion.g>
                  )
                })}
              </AnimatePresence>
            </g>
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
                      animate={{ opacity: dimmed ? 0.3 : faded ? 0.55 : isSelected ? 1 : 0.85 }}
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
      </motion.div>

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

      {selection && (
        <button type="button" className="map-clear-selection pill" onClick={clearSelection}>
          Clear selection
        </button>
      )}

      {unresolved.length > 0 && level === 'family' && (
        <div className="map-unresolved">
          <div className="eyebrow">Unresolved places</div>
          <p>{unresolved.length} records lack coordinates and are not mapped.</p>
        </div>
      )}

      <div className="map-hint">
        {level === 'family'
          ? 'Click a region to explore · Scroll to zoom deeper'
          : 'Scroll out to widen · Click places for records'}
      </div>
    </div>
  )
}
