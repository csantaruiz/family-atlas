/** MapLibre coordinate order: [longitude, latitude] */
export type LngLat = [number, number]

export type CameraCue = {
  id: string
  time: number
  action: 'jump' | 'fly'
  center: LngLat
  zoom: number
  /** null = hide marker */
  marker: LngLat | null
  /** Screen-space label rendered on the MapLibre marker, anchored to marker coords */
  label: string | null
}

export type NarrativeCue = {
  id: string
  start: number
  end: number
  title?: string
  date?: string
  subtitle?: string
}

export type DebugState = {
  currentTime: number
  activeCueId: string
  requestedCenter: LngLat
  requestedZoom: number
  mapCenter: LngLat
  mapZoom: number
  markerCoords: LngLat | null
}
