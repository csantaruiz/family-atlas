import type { ResolvedMarker } from '../../types/choreography'

type ViewBoxMapMarkersProps = {
  markers: ResolvedMarker[]
  viewBoxWidth: number
  stageWidth: number
}

function markerRadius(viewBoxWidth: number, stageWidth: number) {
  if (viewBoxWidth <= 0 || stageWidth <= 0) return 0.55
  return 5.5 / (stageWidth / viewBoxWidth)
}

/** Map-attached dots — exact registry coordinates, no positional offset. */
export function ViewBoxMapMarkers({
  markers,
  viewBoxWidth,
  stageWidth,
}: ViewBoxMapMarkersProps) {
  const visible = markers.filter((marker) => !marker.preview && marker.opacity > 0.02)
  if (visible.length === 0) return null

  const radius = markerRadius(viewBoxWidth, stageWidth)

  return (
    <g className="de-map-markers-svg" aria-hidden="true">
      {visible.map((marker) => (
        <g
          key={marker.id}
          className={[
            'de-map-marker-svg',
            marker.active ? 'de-map-marker-svg--active' : 'de-map-marker-svg--context',
          ]
            .filter(Boolean)
            .join(' ')}
          transform={`translate(${marker.x} ${marker.y})`}
          opacity={marker.opacity}
        >
          <circle className="de-map-marker-svg__dot" r={radius} />
        </g>
      ))}
    </g>
  )
}
