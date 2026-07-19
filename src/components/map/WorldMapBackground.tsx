import { useMemo } from 'react'
import { useReducedMotion } from 'framer-motion'
import worldLand from '../../data/worldLand110m.json'
import {
  createAtlasGraticulePath,
  createAtlasPathGenerator,
  MAP_VIEW_BOX,
  WORLD_MAP_COASTLINE_STROKE,
  WORLD_MAP_COASTLINE_WIDTH,
  WORLD_MAP_GRATICULE_STROKE,
  WORLD_MAP_GRATICULE_WIDTH,
  WORLD_MAP_LAND_FILL,
  WORLD_MAP_WATER_DEEP,
  WORLD_MAP_WATER_FILL,
  WORLD_MAP_WATER_SHALLOW,
  WORLD_MAP_WATER_TINT,
} from '../../utils/mapProjection'

type LandFeature = {
  type: 'Feature'
  geometry: { type: string; coordinates: unknown }
  properties?: Record<string, unknown>
}

type WorldMapBackgroundProps = {
  idPrefix?: string
  fadeIn?: boolean
}

export function WorldMapBackground({ idPrefix = '', fadeIn = true }: WorldMapBackgroundProps) {
  const prefersReducedMotion = useReducedMotion()
  const oceanDepthId = `${idPrefix}atlasOceanDepth`
  const oceanHorizonId = `${idPrefix}atlasOceanHorizon`
  const landBaseId = `${idPrefix}atlasLandBase`
  const landPaperId = `${idPrefix}atlasLandPaper`
  const coastSoftnessId = `${idPrefix}atlasCoastSoftness`

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
    <g
      className={`world-map-layer${fadeIn && !prefersReducedMotion ? ' world-map-layer--fade-in' : ''}`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={oceanDepthId} cx="44%" cy="40%" r="72%">
          <stop offset="0%" stopColor={WORLD_MAP_WATER_SHALLOW} />
          <stop offset="42%" stopColor={WORLD_MAP_WATER_TINT} />
          <stop offset="100%" stopColor={WORLD_MAP_WATER_DEEP} />
        </radialGradient>

        <linearGradient id={oceanHorizonId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(72, 98, 104, 0.08)" />
          <stop offset="48%" stopColor="rgba(0, 0, 0, 0)" />
          <stop offset="100%" stopColor="rgba(28, 44, 48, 0.16)" />
        </linearGradient>

        <linearGradient id={landBaseId} x1="18%" y1="8%" x2="82%" y2="92%">
          <stop offset="0%" stopColor="rgba(176, 152, 112, 0.14)" />
          <stop offset="46%" stopColor={WORLD_MAP_LAND_FILL} />
          <stop offset="100%" stopColor="rgba(118, 102, 78, 0.16)" />
        </linearGradient>

        <filter id={landPaperId} x="-4%" y="-4%" width="108%" height="108%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.92"
            numOctaves="2"
            seed="8"
            result="noise"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.68  0 0 0 0 0.62  0 0 0 0 0.54  0 0 0 0.028 0"
            in="noise"
            result="grain"
          />
          <feBlend in="SourceGraphic" in2="grain" mode="multiply" />
        </filter>

        <filter id={coastSoftnessId} x="-2%" y="-2%" width="104%" height="104%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.08" />
        </filter>
      </defs>

      <rect width={MAP_VIEW_BOX.width} height={MAP_VIEW_BOX.height} fill={WORLD_MAP_WATER_FILL} />
      <rect width={MAP_VIEW_BOX.width} height={MAP_VIEW_BOX.height} fill={`url(#${oceanDepthId})`} />
      <rect width={MAP_VIEW_BOX.width} height={MAP_VIEW_BOX.height} fill={`url(#${oceanHorizonId})`} />

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

      <g className="world-map-landmasses" filter={`url(#${landPaperId})`}>
        {landPaths.map((path) => (
          <path
            key={path.id}
            d={path.d}
            fill={`url(#${landBaseId})`}
            stroke={WORLD_MAP_COASTLINE_STROKE}
            strokeWidth={WORLD_MAP_COASTLINE_WIDTH}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      <g className="world-map-coastline-wash" filter={`url(#${coastSoftnessId})`} pointerEvents="none">
        {landPaths.map((path) => (
          <path
            key={`coast-${path.id}`}
            d={path.d}
            fill="none"
            stroke="rgba(210, 192, 152, 0.06)"
            strokeWidth={WORLD_MAP_COASTLINE_WIDTH * 1.6}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      <rect
        className="world-map-ocean-vignette"
        width={MAP_VIEW_BOX.width}
        height={MAP_VIEW_BOX.height}
        fill={`url(#${oceanDepthId})`}
        opacity="0.48"
        pointerEvents="none"
      />
    </g>
  )
}
