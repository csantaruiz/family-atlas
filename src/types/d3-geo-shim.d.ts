declare module '*.geojson' {
  const value: {
    type: string
    features: unknown[]
  }
  export default value
}

declare module '*.json' {
  const value: {
    type: string
    features: unknown[]
  }
  export default value
}

declare module 'd3' {
  export type GeoPermissibleObjects = object

  export interface GeoPath<G = GeoPermissibleObjects, R = string> {
    (object: G): R | null
  }

  export function geoPath(projection?: unknown): GeoPath
  export function geoTransform(
    methods: {
      forward?: (coordinates: [number, number]) => [number, number]
      invert?: (coordinates: [number, number]) => [number, number]
    },
  ): unknown
}
