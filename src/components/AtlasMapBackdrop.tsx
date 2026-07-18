import { useMemo } from 'react'
import worldLand from '../data/worldLand110m.json'
import {
  createAtlasPathGenerator,
  MAP_VIEW_BOX,
  WORLD_MAP_WATER_FILL,
} from '../utils/mapProjection'

type LandFeature = {
  type: 'Feature'
  geometry: { type: string; coordinates: unknown }
  properties?: Record<string, unknown>
}

export function AtlasMapBackdrop() {
  const landPaths = useMemo(() => {
    const collection = worldLand as { type: string; features: LandFeature[] }
    if (collection.type !== 'FeatureCollection') return []
    const pathGen = createAtlasPathGenerator()
    return collection.features
      .map((feature, index) => {
        const d = pathGen(feature as never)
        return d ? { id: `backdrop-land-${index}`, d } : null
      })
      .filter((entry): entry is { id: string; d: string } => entry !== null)
  }, [])

  const { width, height } = MAP_VIEW_BOX

  return (
    <div className="app-map-backdrop" aria-hidden="true">
      <svg
        className="app-map-backdrop-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <rect width={width} height={height} fill={WORLD_MAP_WATER_FILL} />
        <g className="app-map-backdrop-land">
          {landPaths.map((path) => (
            <path key={path.id} d={path.d} />
          ))}
        </g>
      </svg>
      <div className="app-map-backdrop-vignette" />
    </div>
  )
}
