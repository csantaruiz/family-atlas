import { useMemo } from 'react'
import { WorldMapBackground } from '../../../components/map/WorldMapBackground'
import { MAP_VIEW_BOX } from '../../../utils/mapProjection'
import { cameraTransform } from '../../../utils/mapSemanticZoom'
import { resolveMapLocations } from '../../data/documentaryPlaces'
import type { MapSceneConfig, MapLocation } from '../../types/manifest'
import { documentaryCameraDrift, interpolateDocumentaryCamera } from '../../utils/documentaryCamera'
import { hashPhase, routeEnvelope } from '../../utils/camera'
import { resolveMigrationRoutes } from '../../utils/migrationPaths'

type DocumentaryMapCanvasProps = {
  map: MapSceneConfig
  sceneId: string
  progress: number
  elapsedMs: number
}

function markerOpacity(elapsedMs: number, delayMs = 600): number {
  return Math.min(1, Math.max(0, (elapsedMs - delayMs) / 1200))
}

function branchMarkerClass(branch?: MapLocation['branch']): string {
  if (!branch) return ''
  return ` de-map-marker--${branch}`
}

export function DocumentaryMapCanvas({ map, sceneId, progress, elapsedMs }: DocumentaryMapCanvasProps) {
  const locations = useMemo(
    () => (map.places ? resolveMapLocations(map.places) : []),
    [map.places],
  )

  const camera = useMemo(() => {
    const base = interpolateDocumentaryCamera(map.camera, progress)
    const drift = documentaryCameraDrift(progress, hashPhase(sceneId))
    return { cx: base.cx + drift.dx, cy: base.cy + drift.dy, scale: base.scale }
  }, [map.camera, progress, sceneId])

  const routes = useMemo(
    () => resolveMigrationRoutes(locations, map.migrations),
    [locations, map.migrations],
  )

  const routeOpacity = routeEnvelope(progress)
  const routeDraw = Math.min(1, Math.max(0, (progress - 0.08) / 0.45))

  return (
    <div className="de-map-canvas">
      <div className="de-map-camera" style={{ transform: cameraTransform(camera) }}>
        <svg
          className="de-map-svg"
          viewBox={`0 0 ${MAP_VIEW_BOX.width} ${MAP_VIEW_BOX.height}`}
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <WorldMapBackground idPrefix="de-" fadeIn={false} />

          {routes.length > 0 && (
            <g className="de-map-routes" style={{ opacity: routeOpacity }}>
              {routes.map(({ d, generational }) => (
                <path
                  key={d}
                  className={`de-map-route${generational ? ' de-map-route--generational' : ''}`}
                  d={d}
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - routeDraw}
                />
              ))}
            </g>
          )}

          {locations.map((loc) => {
            if (loc.resolved === false) return null
            const opacity = markerOpacity(elapsedMs, loc.delayMs ?? 500)
            if (opacity <= 0.02) return null

            return (
              <g
                key={loc.id}
                className={`de-map-marker${branchMarkerClass(loc.branch)}`}
                transform={`translate(${loc.x} ${loc.y})`}
                opacity={opacity}
              >
                <circle className="de-map-marker-dot" r={0.55} />
                {loc.label ? (
                  <text className="de-map-marker-label" y={2.8} textAnchor="middle">
                    {loc.label}
                  </text>
                ) : null}
                {loc.subtitle ? (
                  <text className="de-map-marker-subtitle" y={4.2} textAnchor="middle">
                    {loc.subtitle}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
