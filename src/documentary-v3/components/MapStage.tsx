import { useEffect, useRef } from 'react'
import maplibregl, { type Map } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { V3_PLACES } from '../data/gedcomPlaces'
import { MAP_STYLE } from '../hooks/useCameraDirector'

type MapStageProps = {
  onMapReady: (map: Map) => void
}

/** One persistent MapLibre instance — container must not remount. */
export function MapStage({ onMapReady }: MapStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const readyRef = useRef(onMapReady)
  readyRef.current = onMapReady

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: V3_PLACES.world,
      zoom: 2.2,
      attributionControl: false,
      pitch: 0,
      bearing: 0,
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.scrollZoom.disable()

    map.on('load', () => {
      mapRef.current = map
      readyRef.current(map)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  return <div ref={containerRef} className="dv3-map-stage" aria-hidden="false" />
}
