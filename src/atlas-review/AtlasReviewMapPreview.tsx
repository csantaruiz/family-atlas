import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

type Props = {
  latitude: number
  longitude: number
  label: string
}

/** Small non-interactive preview. Hidden on small screens via CSS. */
export function AtlasReviewMapPreview({ latitude, longitude, label }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const map = new maplibregl.Map({
      container: host,
      style: MAP_STYLE,
      center: [longitude, latitude],
      zoom: 7,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
    })
    const marker = new maplibregl.Marker({ color: '#d6b56c' })
      .setLngLat([longitude, latitude])
      .addTo(map)
    return () => {
      marker.remove()
      map.remove()
    }
  }, [latitude, longitude])

  return (
    <div className="atlas-review-map">
      <div ref={hostRef} className="atlas-review-map-canvas" role="img" aria-label={label} />
    </div>
  )
}
