import { useReducedMotion } from 'framer-motion'
import type { ResolvedRoute } from '../../types/choreography'

type ViewBoxMapRoutesProps = {
  routes: ResolvedRoute[]
  idPrefix?: string
}

const DEFAULT_FLOW_SEC = 14

/** Map-attached migration arcs — subtle curved paths with direction. */
export function ViewBoxMapRoutes({ routes, idPrefix = 'de' }: ViewBoxMapRoutesProps) {
  const visible = routes.filter((route) => route.drawProgress > 0.01 && route.opacity > 0.02)
  const prefersReducedMotion = useReducedMotion()
  if (visible.length === 0) return null

  const markerId = `${idPrefix}-route-arrow`
  const oceanMarkerId = `${idPrefix}-route-arrow-ocean`

  return (
    <g className="de-map-routes-svg" aria-hidden="true">
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 6 6"
          refX="5.2"
          refY="3"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M 0.5 0.5 L 5 3 L 0.5 5.5 Z" className="de-map-route-svg__arrow" />
        </marker>
        <marker
          id={oceanMarkerId}
          viewBox="0 0 6 6"
          refX="5.2"
          refY="3"
          markerWidth="5.5"
          markerHeight="5.5"
          orient="auto"
        >
          <path
            d="M 0.5 0.5 L 5 3 L 0.5 5.5 Z"
            className="de-map-route-svg__arrow de-map-route-svg__arrow--transoceanic"
          />
        </marker>
      </defs>
      {visible.map((route) => {
        const flowSec = route.flowDurationSec ?? DEFAULT_FLOW_SEC
        const flowClass = [
          'de-map-route-svg-flow',
          `de-map-route-svg-flow--${route.evidence}`,
          route.transoceanic ? 'de-map-route-svg-flow--transoceanic' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <g key={route.id} className="de-map-route-group">
            <path
              d={route.d}
              className={[
                'de-map-route-svg',
                `de-map-route-svg--${route.evidence}`,
                route.transoceanic ? 'de-map-route-svg--transoceanic' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              markerEnd={`url(#${route.transoceanic ? oceanMarkerId : markerId})`}
              opacity={route.opacity}
            />
            {!prefersReducedMotion ? (
              <path
                d={route.d}
                className={flowClass}
                opacity={Math.min(1, route.opacity * 1.15)}
                style={{ animationDuration: `${flowSec}s` }}
              />
            ) : null}
          </g>
        )
      })}
    </g>
  )
}
