import * as d3 from 'd3'
import type { GeoPermissibleObjects } from 'd3'

/** Printed-atlas projection — not Mercator. */
export const MAP_PROJECTION_ID = 'naturalEarth1' as const

type AtlasProjection = {
  (coords: [number, number]): [number, number] | null
  fitExtent(
    extent: [[number, number], [number, number]],
    object: GeoPermissibleObjects,
  ): AtlasProjection
}

type D3Geo = {
  geoNaturalEarth1: () => AtlasProjection
  geoGraticule: () => {
    step: (step: [number, number]) => { (): GeoPermissibleObjects }
    (): GeoPermissibleObjects
  }
  geoPath: (
    projection?: AtlasProjection,
  ) => d3.GeoPath<GeoPermissibleObjects, string>
}

const d3geo = d3 as typeof d3 & D3Geo

/**
 * Geographic extent for the family atlas viewport.
 * Western Europe through the Pacific coast of North America.
 */
const FAMILY_ATLAS_BOUNDS = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-132, 14],
        [-4, 14],
        [-4, 63],
        [-132, 63],
        [-132, 14],
      ],
    ],
  },
} as GeoPermissibleObjects

const MAP_PADDING = { left: 2.5, top: 4, right: 97.5, bottom: 96 } as const

/** Known geographic anchors — for docs and regression checks. */
export const MAP_REFERENCE_ANCHORS = [
  { lon: -2.2, lat: 53.2, label: 'England' },
  { lon: -3.4, lat: 58.3, label: 'Scotland' },
  { lon: -8.0, lat: 53.4, label: 'Ireland' },
  { lon: -75.0, lat: 40.5, label: 'Eastern United States' },
  { lon: -122.0, lat: 37.4, label: 'California' },
  { lon: -106.1, lat: 28.6, label: 'Mexico' },
  { lon: -106.5, lat: 31.8, label: 'Southwest United States' },
] as const

export const MAP_VIEW_BOX = { width: 100, height: 100 } as const

/** Archival expedition-map palette — warm land on quiet oxidized sea. */
export const WORLD_MAP_WATER_FILL = '#0a1216'
export const WORLD_MAP_WATER_DEEP = 'rgba(36, 58, 64, 0.38)'
export const WORLD_MAP_WATER_TINT = 'rgba(52, 78, 84, 0.24)'
export const WORLD_MAP_WATER_SHALLOW = 'rgba(68, 98, 102, 0.14)'
export const WORLD_MAP_LAND_FILL = 'rgba(148, 128, 96, 0.18)'
export const WORLD_MAP_LAND_WASH = 'rgba(168, 146, 108, 0.12)'
export const WORLD_MAP_LAND_HIGHLIGHT = 'rgba(196, 176, 138, 0.08)'
export const WORLD_MAP_COASTLINE_STROKE = 'rgba(186, 168, 132, 0.36)'
export const WORLD_MAP_COASTLINE_WIDTH = 0.38
export const WORLD_MAP_GRATICULE_STROKE = 'rgba(160, 148, 124, 0.038)'
export const WORLD_MAP_GRATICULE_WIDTH = 0.22

let cachedProjection: AtlasProjection | null = null
let cachedPathGenerator: d3.GeoPath<GeoPermissibleObjects, string> | null = null
let cachedGraticulePath: string | null = null

function createProjection(): AtlasProjection {
  const projection = d3geo.geoNaturalEarth1().fitExtent(
    [
      [MAP_PADDING.left, MAP_PADDING.top],
      [MAP_PADDING.right, MAP_PADDING.bottom],
    ],
    FAMILY_ATLAS_BOUNDS,
  )
  return projection
}

export function getAtlasProjection(): AtlasProjection {
  if (!cachedProjection) cachedProjection = createProjection()
  return cachedProjection
}

/** Project lon/lat to atlas coordinates (0–100). */
export function projectGeo(lon: number, lat: number): { x: number; y: number } {
  const projected = getAtlasProjection()([lon, lat])
  if (!projected) return { x: 50, y: 50 }
  return { x: projected[0], y: projected[1] }
}

export function createAtlasPathGenerator(): d3.GeoPath<GeoPermissibleObjects, string> {
  if (!cachedPathGenerator) {
    cachedPathGenerator = d3geo.geoPath(getAtlasProjection())
  }
  return cachedPathGenerator
}

/** Subtle graticule path for the antique atlas grid. */
export function createAtlasGraticulePath(): string {
  if (cachedGraticulePath) return cachedGraticulePath
  const graticule = d3geo.geoGraticule().step([15, 15])
  const d = createAtlasPathGenerator()(graticule()) ?? ''
  cachedGraticulePath = d
  return d
}

/** @deprecated Use MAP_REFERENCE_ANCHORS */
export const MAP_CALIBRATION_POINTS = MAP_REFERENCE_ANCHORS
