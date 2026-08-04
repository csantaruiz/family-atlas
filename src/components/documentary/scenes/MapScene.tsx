import { sceneProgress } from '../../../data/openingScript'
import { kenBurnsStyle, sceneOpacity } from '../../../utils/kenBurns'
import type { DocumentaryScene } from '../../../types/documentary'

type MapSceneProps = {
  scene: DocumentaryScene
  sceneElapsedMs: number
}

const DEFAULT_ROUTES = [
  'M120 420 C 260 340, 380 300, 520 270 S 720 230, 860 210',
  'M240 520 C 380 460, 520 410, 680 380',
]

export function MapScene({ scene, sceneElapsedMs }: MapSceneProps) {
  const config = scene.visualConfig
  const ratio = sceneProgress(sceneElapsedMs, scene.durationMs)
  const opacity = sceneOpacity(ratio)
  const routes = config?.migrationRoutes ?? DEFAULT_ROUTES
  const locations = config?.mapLocations ?? []

  if (opacity <= 0.01 || !config?.mapImage) return null

  return (
    <div className="film-scene film-scene--map" style={{ opacity }}>
      <div className="film-scene__ken-burns-frame">
        <img
          className="film-scene__ken-burns-image"
          src={config.mapImage}
          alt={config.mapImageAlt ?? 'Historical map'}
          style={{
            objectPosition: config.mapPosition ?? 'center',
            ...kenBurnsStyle(ratio, config.kenBurns),
          }}
        />
      </div>

      <svg className="film-scene__map-overlay" viewBox="0 0 960 640" aria-hidden="true">
        {routes.map((d, index) => {
          const routeProgress = Math.min(1, Math.max(0, (ratio - 0.08 - index * 0.06) / 0.55))
          return (
            <path
              key={d}
              className={`film-scene__route${index === routes.length - 1 ? ' film-scene__route--migration' : ''}`}
              d={d}
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - routeProgress}
            />
          )
        })}
      </svg>

      {locations.map((loc) => {
        const locOpacity = Math.min(
          1,
          Math.max(0, (sceneElapsedMs - (loc.delayMs ?? 800)) / 1400),
        )
        if (locOpacity <= 0.02) return null
        return (
          <div
            key={`${loc.x}-${loc.y}`}
            className="film-scene__map-location"
            style={{
              left: `${loc.x}%`,
              top: `${loc.y}%`,
              opacity: locOpacity * opacity,
            }}
          >
            <span className="film-scene__map-location-glow" aria-hidden="true" />
            <span className="film-scene__map-location-core" aria-hidden="true" />
            {loc.label ? <span className="film-scene__map-location-label">{loc.label}</span> : null}
          </div>
        )
      })}

      {config.mapCredit ? (
        <p className="film-scene__map-credit">{config.mapCredit}</p>
      ) : null}
    </div>
  )
}
