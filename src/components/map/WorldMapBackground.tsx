import { useMemo } from 'react'
import { useReducedMotion } from 'framer-motion'
import worldLand from '../../data/worldLand110m.json'
import {
  createAtlasPathGenerator,
  createAtlasGraticulePath,
  MAP_VIEW_BOX,
  WORLD_MAP_COASTLINE_STROKE,
  WORLD_MAP_COASTLINE_WIDTH,
  WORLD_MAP_GRATICULE_STROKE,
  WORLD_MAP_GRATICULE_WIDTH,
  WORLD_MAP_LAND_FILL,
} from '../../utils/mapProjection'

type LandFeature = {
  type: 'Feature'
  geometry: { type: string; coordinates: unknown }
  properties?: Record<string, unknown>
}

export function WorldMapBackground() {
  const prefersReducedMotion = useReducedMotion()

  const landPaths = useMemo(() => {
    const collection = worldLand as { type: string; features: LandFeature[] }
    if (collection.type !== 'FeatureCollection') return []
    const pathGen = createAtlasPathGenerator()
    return collection.features
      .map((feature, index) => {
        const d = pathGen(feature as never)
        return d ? { id: `land-${index}`, d } : null
      })
      .filter((entry): entry is { id: string; d: string } => entry !== null)
  }, [])

  const graticulePath = useMemo(() => createAtlasGraticulePath(), [])

  return (
    <g className={`world-map-layer${prefersReducedMotion ? '' : ' world-map-layer--fade-in'}`} aria-hidden="true">
      <defs>
        <linearGradient id="atlasMapEdgeFadeX" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(9, 11, 13, 0.55)" />
          <stop offset="8%" stopColor="rgba(9, 11, 13, 0)" />
          <stop offset="92%" stopColor="rgba(9, 11, 13, 0)" />
          <stop offset="100%" stopColor="rgba(9, 11, 13, 0.55)" />
        </linearGradient>
        <radialGradient id="atlasMapSoftVignette" cx="50%" cy="48%" r="58%">
          <stop offset="0%" stopColor="rgba(191, 165, 110, 0.035)" />
          <stop offset="55%" stopColor="rgba(0, 0, 0, 0)" />
          <stop offset="100%" stopColor="rgba(0, 0, 0, 0.14)" />
        </radialGradient>
      </defs>
      <rect width={MAP_VIEW_BOX.width} height={MAP_VIEW_BOX.height} fill="transparent" />
      {graticulePath && (
        <path
          className="world-map-graticule"
          d={graticulePath}
          fill="none"
          stroke={WORLD_MAP_GRATICULE_STROKE}
          strokeWidth={WORLD_MAP_GRATICULE_WIDTH}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      )}
      <g className="world-map-landmasses">
        {landPaths.map((path) => (
          <path
            key={path.id}
            d={path.d}
            fill={WORLD_MAP_LAND_FILL}
            stroke={WORLD_MAP_COASTLINE_STROKE}
            strokeWidth={WORLD_MAP_COASTLINE_WIDTH}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
      <rect
        width={MAP_VIEW_BOX.width}
        height={MAP_VIEW_BOX.height}
        fill="url(#atlasMapSoftVignette)"
        pointerEvents="none"
      />
      <rect
        width={MAP_VIEW_BOX.width}
        height={MAP_VIEW_BOX.height}
        fill="url(#atlasMapEdgeFadeX)"
        pointerEvents="none"
      />
    </g>
  )
}
