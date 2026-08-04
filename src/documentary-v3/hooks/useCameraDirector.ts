import { useEffect, useRef, type MutableRefObject } from 'react'
import maplibregl, { type Map, type Marker } from 'maplibre-gl'
import { findActiveCameraCue } from '../data/cameraCues'
import { isAfricaCenter } from '../data/gedcomPlaces'
import type { DebugState, LngLat } from '../types'

export const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

type UseCameraDirectorOptions = {
  map: Map | null
  currentTime: number
  seekVersion: number
  onDebugUpdate: (state: Partial<DebugState>) => void
}

function applyCamera(map: Map, center: LngLat, zoom: number, animate: boolean) {
  if (isAfricaCenter(center) && import.meta.env.DEV) {
    console.warn('[documentary-v3] blocked Africa camera center', center)
    return
  }

  if (animate) {
    map.flyTo({ center, zoom, duration: 2200, speed: 0.85, essential: true })
    return
  }
  map.jumpTo({ center, zoom })
}

function createMarkerElement(label: string): HTMLDivElement {
  const wrap = document.createElement('div')
  wrap.className = 'dv3-marker-wrap'

  const dot = document.createElement('div')
  dot.className = 'dv3-marker'

  const text = document.createElement('span')
  text.className = 'dv3-marker-label'
  text.textContent = label

  wrap.appendChild(dot)
  wrap.appendChild(text)
  return wrap
}

function syncMarker(
  markerRef: MutableRefObject<Marker | null>,
  map: Map,
  coords: LngLat | null,
  label: string | null,
) {
  if (!coords || !label) {
    markerRef.current?.remove()
    markerRef.current = null
    return
  }

  if (!markerRef.current) {
    const el = createMarkerElement(label)
    markerRef.current = new maplibregl.Marker({ element: el, anchor: 'top', offset: [0, 7] })
      .setLngLat(coords)
      .addTo(map)
    return
  }

  markerRef.current.setLngLat(coords)
  const labelEl = markerRef.current.getElement().querySelector('.dv3-marker-label')
  if (labelEl) labelEl.textContent = label
}

function readMapDebug(map: Map, cue: ReturnType<typeof findActiveCameraCue>): Partial<DebugState> {
  const center = map.getCenter()
  return {
    activeCueId: cue.id,
    requestedCenter: cue.center,
    requestedZoom: cue.zoom,
    mapCenter: [center.lng, center.lat],
    mapZoom: map.getZoom(),
    markerCoords: cue.marker,
  }
}

export function useCameraDirector({
  map,
  currentTime,
  seekVersion,
  onDebugUpdate,
}: UseCameraDirectorOptions) {
  const lastCueIdRef = useRef<string | null>(null)
  const lastSeekVersionRef = useRef(0)
  const markerRef = useRef<Marker | null>(null)

  useEffect(() => {
    if (!map) return

    const run = () => {
      const cue = findActiveCameraCue(currentTime)
      const seeked = seekVersion !== lastSeekVersionRef.current
      const cueChanged = cue.id !== lastCueIdRef.current

      if (seeked) lastSeekVersionRef.current = seekVersion

      if (cueChanged || seeked) {
        const target = cue.marker ?? cue.center
        const animate = !seeked && cue.action === 'fly'
        applyCamera(map, target, cue.zoom, animate)
        syncMarker(markerRef, map, cue.marker, cue.label)
        lastCueIdRef.current = cue.id
      }

      onDebugUpdate(readMapDebug(map, cue))
    }

    if (map.isStyleLoaded()) run()
    else map.once('load', run)

    const onMove = () => {
      if (!map.isStyleLoaded()) return
      onDebugUpdate(readMapDebug(map, findActiveCameraCue(currentTime)))
    }
    map.on('move', onMove)

    return () => {
      map.off('move', onMove)
    }
  }, [map, currentTime, seekVersion, onDebugUpdate])

  useEffect(() => {
    return () => {
      markerRef.current?.remove()
      markerRef.current = null
    }
  }, [map])
}
