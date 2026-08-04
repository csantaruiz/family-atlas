import { describe, expect, it } from 'vitest'
import { resolveDocumentaryFrame } from '../core/cameraDirector'
import {
  allCanonicalPlaces,
  getCanonicalPlace,
  placesForIds,
} from '../data/canonicalPlaceRegistry'
import { DOCUMENTARY_MANIFEST } from '../data/documentaryManifest'
import {
  InvalidCoordinatesError,
  geoPoint,
  toGeoJsonCoordinates,
  validateGeoPoint,
} from '../geo/coordinates'

const DURATION_MS = 384_888

function withinBox(
  lat: number,
  lon: number,
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
): boolean {
  return (
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lon >= bounds.minLon &&
    lon <= bounds.maxLon
  )
}

function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

describe('coordinate validation', () => {
  it('accepts valid latitude and longitude', () => {
    expect(() => validateGeoPoint({ latitude: 53.224, longitude: -2.166 })).not.toThrow()
  })

  it('rejects latitude out of range', () => {
    expect(() => validateGeoPoint({ latitude: 91, longitude: 0 })).toThrow(InvalidCoordinatesError)
  })

  it('rejects longitude out of range', () => {
    expect(() => validateGeoPoint({ latitude: 0, longitude: 181 })).toThrow(InvalidCoordinatesError)
  })

  it('converts to GeoJSON [longitude, latitude]', () => {
    const point = geoPoint(53.224, -2.166)
    expect(toGeoJsonCoordinates(point)).toEqual([-2.166, 53.224])
  })
})

describe('canonical place registry geography', () => {
  const britishIsles = { minLat: 49, maxLat: 61, minLon: -11, maxLon: 2 }
  const iberia = { minLat: 36, maxLat: 44, minLon: -10, maxLon: 4 }
  const englandBox = { minLat: 49.9, maxLat: 55.8, minLon: -6, maxLon: 2 }
  const cheshireBox = { minLat: 52.9, maxLat: 53.5, minLon: -3.2, maxLon: -1.8 }

  it('places Britain within the British Isles', () => {
    const place = getCanonicalPlace('britain')
    expect(place).not.toBeNull()
    expect(withinBox(place!.latitude, place!.longitude, britishIsles)).toBe(true)
  })

  it('places Spain within the Iberian Peninsula', () => {
    const place = getCanonicalPlace('spain')
    expect(place).not.toBeNull()
    expect(withinBox(place!.latitude, place!.longitude, iberia)).toBe(true)
  })

  it('places Cheshire within England', () => {
    const place = getCanonicalPlace('cheshire')
    expect(place).not.toBeNull()
    expect(withinBox(place!.latitude, place!.longitude, englandBox)).toBe(true)
  })

  it('places Gawsworth near Cheshire', () => {
    const gawsworth = getCanonicalPlace('gawsworth')
    const cheshire = getCanonicalPlace('cheshire')
    expect(gawsworth).not.toBeNull()
    expect(cheshire).not.toBeNull()
    expect(withinBox(gawsworth!.latitude, gawsworth!.longitude, cheshireBox)).toBe(true)
    expect(haversineKm(gawsworth!, cheshire!)).toBeLessThan(35)
  })

  it('places Ojinaga and El Paso near one another across the border', () => {
    const ojinaga = getCanonicalPlace('ojinaga')
    const elPaso = getCanonicalPlace('el-paso')
    expect(ojinaga).not.toBeNull()
    expect(elPaso).not.toBeNull()
    expect(haversineKm(ojinaga!, elPaso!)).toBeLessThan(350)
  })

  it('projects every registry place with finite map coordinates', () => {
    for (const place of allCanonicalPlaces()) {
      expect(Number.isFinite(place.x)).toBe(true)
      expect(Number.isFinite(place.y)).toBe(true)
      expect(place.x).toBeGreaterThan(0)
      expect(place.x).toBeLessThan(100)
      expect(place.y).toBeGreaterThan(0)
      expect(place.y).toBeLessThan(100)
    }
  })
})

describe('script-locked approvedPeople', () => {
  it('does not show a person when approvedPeople is empty', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 40_000, DURATION_MS)
    expect(frame).not.toBeNull()
    expect(frame!.approvedPeople).toEqual([])
    expect(frame!.narrativeOverlay?.title).not.toBe('William Lowndes')
  })

  it('shows William Lowndes only in the authorized scene window', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 51_000, DURATION_MS)
    expect(frame?.sceneId).toBe('gawsworth-william')
    expect(frame?.narrativeOverlay?.title).toBe('William Lowndes')
  })
})

describe('markers and routes', () => {
  it('does not render markers without resolved place IDs during Cheshire reveal', () => {
    const frame = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, 44_000, DURATION_MS)
    const sceneMarkers = frame?.markers.filter((marker) => !marker.preview) ?? []
    expect(sceneMarkers.length).toBe(1)
    for (const marker of sceneMarkers) {
      expect(getCanonicalPlace(marker.placeId)).not.toBeNull()
    }
  })

  it('requires valid resolved places for route endpoints in manifest', () => {
    const routeScene = DOCUMENTARY_MANIFEST.find((s) => s.id === 'chihuahua-arrival')
    const route = routeScene?.choreography?.routes?.[0]
    expect(route).toBeDefined()
    expect(getCanonicalPlace(route!.fromId)).not.toBeNull()
    expect(getCanonicalPlace(route!.toId)).not.toBeNull()
    expect(placesForIds([route!.fromId, route!.toId])).toHaveLength(2)
  })
})

describe('seek reconstruction', () => {
  it('returns identical geographic and people state for the same timestamp', () => {
    const times = [0, 22_000, 48_000, 100_000, 112_000, 160_000]
    for (const timeMs of times) {
      const a = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, timeMs, DURATION_MS)
      const b = resolveDocumentaryFrame(DOCUMENTARY_MANIFEST, timeMs, DURATION_MS)
      expect(a).toEqual(b)
    }
  })
})
