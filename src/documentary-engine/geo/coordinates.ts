/** Named geographic point — latitude and longitude in WGS84 decimal degrees. */
export type GeoPoint = {
  latitude: number
  longitude: number
}

export class InvalidCoordinatesError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidCoordinatesError'
  }
}

export function validateGeoPoint(point: GeoPoint): void {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
    throw new InvalidCoordinatesError('Coordinates must be finite numbers')
  }
  if (point.latitude < -90 || point.latitude > 90) {
    throw new InvalidCoordinatesError(
      `Latitude ${point.latitude} out of range — must be between -90 and 90`,
    )
  }
  if (point.longitude < -180 || point.longitude > 180) {
    throw new InvalidCoordinatesError(
      `Longitude ${point.longitude} out of range — must be between -180 and 180`,
    )
  }
}

/** GeoJSON order: [longitude, latitude] */
export function toGeoJsonCoordinates(point: GeoPoint): [number, number] {
  validateGeoPoint(point)
  return [point.longitude, point.latitude]
}

export function geoPoint(latitude: number, longitude: number): GeoPoint {
  const point = { latitude, longitude }
  validateGeoPoint(point)
  return point
}
