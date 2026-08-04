import { useMemo } from 'react'
import { buildBackdropMigrationArcs } from '../utils/backdropMigrationPaths'
import { MAP_VIEW_BOX } from '../utils/mapProjection'
import { WorldMapBackground } from './map/WorldMapBackground'

export function AtlasMapBackdropInner() {
  const migrationArcs = useMemo(() => buildBackdropMigrationArcs(), [])
  const { width, height } = MAP_VIEW_BOX

  return (
    <>
      <svg
        className="app-map-backdrop-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <g className="app-map-backdrop-world">
          <WorldMapBackground idPrefix="backdrop-" fadeIn={false} />
        </g>

        <g className="app-map-backdrop-routes">
          {migrationArcs.map((route) => (
            <path
              key={route.id}
              d={route.d}
              className={`app-map-backdrop-route app-map-backdrop-route--${route.confidence}`}
            />
          ))}
        </g>
      </svg>
      <div className="app-map-backdrop-vignette" />
    </>
  )
}
