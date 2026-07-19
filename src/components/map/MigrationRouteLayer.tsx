import { useMemo } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { Person } from '../../types'
import type { LineagePalette } from '../../utils/lineageColors'
import {
  lineageFlowColor,
  lineageStrokeColor,
  lineageTravelerColor,
  routeDominantLineage,
} from '../../utils/lineageColors'
import type { RegionalRoute, SubregionRoute } from '../../utils/mapRoutes'
import { curvedRoutePath } from '../../utils/mapRoutes'
import {
  formatRouteTravelers,
  formatRouteYearLabel,
  routeMotionDuration,
} from '../../utils/mapMigrationMotion'

type MigrationRouteLayerProps = {
  routes: (RegionalRoute | SubregionRoute)[]
  routeKind: 'route' | 'subroute'
  filterKey: string
  focusRegionId: string | null
  selectedRouteId: string | null
  hoveredRouteId: string | null
  transitionDuration: number
  lineagePalette: LineagePalette | null
  people: Person[]
  onRouteHover: (route: RegionalRoute | SubregionRoute) => void
  onRouteMove: (
    route: RegionalRoute | SubregionRoute,
    position: { x: number; y: number },
  ) => void
  onRouteLeave: () => void
  onRouteSelect: (route: RegionalRoute | SubregionRoute, kind: 'route' | 'subroute') => void
}

const motionEase = [0.22, 0.8, 0.2, 1] as const
const ROUTE_HIT_STROKE = 6
const ROUTE_TRAVELER_HIT_RADIUS = 1.35

export function MigrationRouteLayer({
  routes,
  routeKind,
  filterKey,
  focusRegionId,
  selectedRouteId,
  hoveredRouteId,
  transitionDuration,
  onRouteHover,
  onRouteMove,
  onRouteLeave,
  onRouteSelect,
  lineagePalette,
  people,
}: MigrationRouteLayerProps) {
  const prefersReducedMotion = useReducedMotion()
  const peopleById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people])

  return (
    <g className="map-routes-layer">
      <AnimatePresence mode="sync">
        {routes.map((route) => {
          if (routeKind === 'route' && focusRegionId) {
            const rr = route as RegionalRoute
            if (
              rr.fromRegionId !== focusRegionId &&
              rr.toRegionId !== focusRegionId &&
              selectedRouteId !== route.id
            ) {
              return null
            }
          }

          const isSelected = selectedRouteId === route.id
          const isHovered = hoveredRouteId === route.id
          const dimmed =
            focusRegionId != null &&
            routeKind === 'route' &&
            (route as RegionalRoute).fromRegionId !== focusRegionId &&
            (route as RegionalRoute).toRegionId !== focusRegionId &&
            !isSelected

          const pathD = curvedRoutePath(route.from, route.to)
          const motionDur = routeMotionDuration(route.from, route.to)
          const travelers = formatRouteTravelers(route)
          const yearLabel = formatRouteYearLabel(route)
          const lineageSide =
            lineagePalette != null
              ? routeDominantLineage(route.segments, lineagePalette, peopleById)
              : 'other'
          const routeStroke =
            lineagePalette != null
              ? lineageStrokeColor(lineageSide, lineagePalette, route.confidence)
              : undefined
          const flowStroke =
            lineagePalette != null
              ? lineageFlowColor(lineageSide, lineagePalette)
              : undefined
          const travelerFill =
            lineagePalette != null
              ? lineageTravelerColor(lineageSide, lineagePalette)
              : 'rgba(214, 181, 108, 0.88)'

          const routeHitHandlers = {
            onMouseEnter: () => onRouteHover(route),
            onMouseMove: (e: React.MouseEvent) => {
              onRouteMove(route, { x: e.clientX, y: e.clientY })
            },
            onMouseLeave: onRouteLeave,
            onFocus: () => onRouteHover(route),
            onBlur: onRouteLeave,
            onClick: (e: React.MouseEvent) => {
              e.stopPropagation()
              onRouteSelect(route, routeKind)
            },
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onRouteSelect(route, routeKind)
              }
            },
          }

          return (
            <motion.g
              key={`${routeKind}-${route.id}-${filterKey}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: dimmed ? 0.22 : 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: transitionDuration, ease: motionEase }}
            >
              <path
                d={pathD}
                className="map-route-hit"
                fill="none"
                stroke="transparent"
                strokeWidth={ROUTE_HIT_STROKE}
                vectorEffect="non-scaling-stroke"
                tabIndex={0}
                role="button"
                aria-label={`Migration ${route.fromName} to ${route.toName}. ${travelers}. ${yearLabel}.`}
                {...routeHitHandlers}
              />
              <path
                d={pathD}
                className={`map-route map-route--${route.confidence}${lineageSide !== 'other' ? ` map-route--lineage-${lineageSide}` : ''}${prefersReducedMotion ? '' : ' map-route--draw'}${isSelected ? ' map-route--selected' : ''}${isHovered ? ' map-route--hovered' : ''}`}
                fill="none"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
                aria-hidden="true"
                style={routeStroke ? { stroke: routeStroke } : undefined}
              />
              {!prefersReducedMotion && (
                <>
                  <path
                    d={pathD}
                    className={`map-route-flow map-route-flow--${route.confidence}${lineageSide !== 'other' ? ` map-route-flow--lineage-${lineageSide}` : ''}${isHovered ? ' map-route-flow--hovered' : ''}${isSelected ? ' map-route-flow--selected' : ''}`}
                    fill="none"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                    aria-hidden="true"
                    style={{
                      animationDuration: `${motionDur}s`,
                      ...(flowStroke ? { stroke: flowStroke } : {}),
                    }}
                  />
                  <circle
                    r={ROUTE_TRAVELER_HIT_RADIUS}
                    className="map-route-hit-marker"
                    fill="transparent"
                    stroke="transparent"
                    aria-hidden="true"
                    {...routeHitHandlers}
                  >
                    <animateMotion
                      dur={`${motionDur}s`}
                      repeatCount="indefinite"
                      path={pathD}
                      calcMode="linear"
                    />
                  </circle>
                  <circle
                    r={0.4}
                    className={`map-route-traveler${lineageSide !== 'other' ? ` map-route-traveler--${lineageSide}` : ''}`}
                    fill={travelerFill}
                    pointerEvents="none"
                    aria-hidden="true"
                  >
                    <animateMotion
                      dur={`${motionDur}s`}
                      repeatCount="indefinite"
                      path={pathD}
                      calcMode="linear"
                    />
                  </circle>
                </>
              )}
            </motion.g>
          )
        })}
      </AnimatePresence>
    </g>
  )
}

export function MigrationRouteTooltip({
  fromName,
  toName,
  travelers,
  yearLabel,
  moveCount,
  x,
  y,
}: {
  fromName: string
  toName: string
  travelers: string
  yearLabel: string
  moveCount: number
  x: number
  y: number
}) {
  return (
    <div
      className="map-route-tooltip"
      style={{ left: x, top: y }}
      role="tooltip"
    >
      <div className="map-route-tooltip-corridor">
        {fromName} → {toName}
      </div>
      <div className="map-route-tooltip-who">{travelers}</div>
      <div className="map-route-tooltip-when">{yearLabel}</div>
      {moveCount > 0 && (
        <div className="map-route-tooltip-meta">Click for corridor detail</div>
      )}
    </div>
  )
}
