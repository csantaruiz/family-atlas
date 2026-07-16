import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { FamilyRegion, FamilyRegionId } from '../../utils/mapRegions'
import type { MapSubregion } from '../../utils/mapSubregions'
import {
  labelBudgetForLevel,
  layoutMapLabels,
  topPlacesByWeight,
  type PlacedMapLabel,
} from '../../utils/mapLabelLayout'
import { MAP_CAMERA_TRANSITION_MS } from '../../utils/mapCamera'
import {
  markerDiameterPx,
  projectMapPoint,
  type MapCamera,
  type MapLayerVisibility,
  type MapZoomLevel,
} from '../../utils/mapSemanticZoom'
import type { PlaceRecord } from '../../utils/placeIndex'

const motionEase = [0.22, 0.8, 0.2, 1] as const

function placeShortName(name: string): string {
  return name.split(',')[0].trim() || name
}

type MapOverlayProps = {
  level: MapZoomLevel
  layers: MapLayerVisibility
  camera: MapCamera
  frameWidth: number
  frameHeight: number
  regions: FamilyRegion[]
  subregions: MapSubregion[]
  places: PlaceRecord[]
  focusRegionId: FamilyRegionId | null
  focusSubregionId: string | null
  selectedPlaceId: string | null
  hoveredRegionId: FamilyRegionId | null
  filterKey: string
  onRegionClick: (region: FamilyRegion) => void
  onSubregionClick: (sub: MapSubregion) => void
  onPlaceClick: (place: PlaceRecord) => void
  onRegionHover: (id: FamilyRegionId | null) => void
}

export function MapOverlay({
  level,
  layers,
  camera,
  frameWidth,
  frameHeight,
  regions,
  subregions,
  places,
  focusRegionId,
  focusSubregionId,
  selectedPlaceId,
  hoveredRegionId,
  filterKey,
  onRegionClick,
  onSubregionClick,
  onPlaceClick,
  onRegionHover,
}: MapOverlayProps) {
  const topPlaceIds = useMemo(() => {
    if (layers.showAllPlaces) return new Set(places.map((p) => p.id))
    return topPlacesByWeight(places, Math.max(6, Math.floor(places.length * 0.35)))
  }, [places, layers.showAllPlaces])

  const labels = useMemo((): PlacedMapLabel[] => {
    if (frameWidth < 10 || frameHeight < 10) return []

    const candidates: Parameters<typeof layoutMapLabels>[0] = []

    if (layers.showMajorLabels) {
      for (const region of regions) {
        if (focusRegionId && region.id !== focusRegionId && level !== 'family') continue
        candidates.push({
          id: `major-label-${region.id}`,
          x: region.anchor.x,
          y: region.anchor.y,
          text: region.name,
          priority: 100,
          kind: 'major',
        })
      }
    }

    if (layers.showSubregionLabels) {
      for (const sub of subregions) {
        if (focusRegionId && sub.parentRegionId !== focusRegionId) continue
        candidates.push({
          id: `sub-label-${sub.id}`,
          x: sub.anchor.x,
          y: sub.anchor.y,
          text: sub.name,
          priority: 85,
          kind: 'sub',
        })
      }
    }

    if (layers.showPlaceLabels) {
      for (const place of places) {
        if (!topPlaceIds.has(place.id)) continue
        candidates.push({
          id: `place-label-${place.id}`,
          x: place.coordinate.x,
          y: place.coordinate.y,
          text: placeShortName(place.name),
          priority: layers.showAllPlaces ? 70 : 60,
          kind: 'place',
        })
      }
    }

    return layoutMapLabels(candidates, camera, frameWidth, frameHeight, labelBudgetForLevel(level))
  }, [
    frameWidth,
    frameHeight,
    layers,
    regions,
    subregions,
    places,
    focusRegionId,
    level,
    camera,
    topPlaceIds,
  ])

  const markers = useMemo(() => {
    const items: {
      id: string
      left: number
      top: number
      size: number
      kind: 'major' | 'sub' | 'place'
      opacity: number
      onClick?: () => void
      onMouseEnter?: () => void
      onMouseLeave?: () => void
      selected?: boolean
      hovered?: boolean
    }[] = []

    if (layers.showMajorMarkers) {
      for (const region of regions) {
        if (level !== 'family') continue
        const pos = projectMapPoint(region.anchor.x, region.anchor.y, camera)
        if (pos.left < -5 || pos.left > 105 || pos.top < -5 || pos.top > 105) continue
        items.push({
          id: `major-${region.id}`,
          left: pos.left,
          top: pos.top,
          size: markerDiameterPx(level, 'major'),
          kind: 'major',
          opacity: 1,
          onClick: () => onRegionClick(region),
          onMouseEnter: () => onRegionHover(region.id),
          onMouseLeave: () => onRegionHover(null),
          hovered: hoveredRegionId === region.id,
        })
      }
    }

    if (layers.showSubregionMarkers) {
      for (const sub of subregions) {
        if (focusRegionId && sub.parentRegionId !== focusRegionId) continue
        if (level === 'local' && focusSubregionId && sub.id !== focusSubregionId) continue
        const pos = projectMapPoint(sub.anchor.x, sub.anchor.y, camera)
        const dimmed = focusSubregionId != null && sub.id !== focusSubregionId
        items.push({
          id: `sub-${sub.id}`,
          left: pos.left,
          top: pos.top,
          size: markerDiameterPx(level, 'sub'),
          kind: 'sub',
          opacity: dimmed ? 0.35 : 0.9,
          onClick: () => onSubregionClick(sub),
        })
      }
    }

    if (layers.showPlaces) {
      for (const place of places) {
        if (!topPlaceIds.has(place.id)) continue
        const pos = projectMapPoint(place.coordinate.x, place.coordinate.y, camera)
        items.push({
          id: `place-${place.id}`,
          left: pos.left,
          top: pos.top,
          size: markerDiameterPx(level, 'place'),
          kind: 'place',
          opacity: 1,
          onClick: () => onPlaceClick(place),
          selected: selectedPlaceId === place.id,
        })
      }
    }

    return items
  }, [
    layers,
    regions,
    subregions,
    places,
    focusRegionId,
    focusSubregionId,
    level,
    camera,
    topPlaceIds,
    hoveredRegionId,
    selectedPlaceId,
    onRegionClick,
    onSubregionClick,
    onPlaceClick,
    onRegionHover,
  ])

  const selectedPlace = places.find((p) => p.id === selectedPlaceId)

  return (
    <div className="map-overlay" aria-hidden={false}>
      <AnimatePresence mode="sync">
        {markers.map((m) => (
          <motion.button
            key={`${m.id}-${filterKey}`}
            type="button"
            className={`map-overlay-marker map-overlay-marker--${m.kind}${m.selected ? ' map-overlay-marker--selected' : ''}${m.hovered ? ' map-overlay-marker--hovered' : ''}`}
            style={{
              left: `${m.left}%`,
              top: `${m.top}%`,
              width: m.size,
              height: m.size,
              opacity: m.opacity,
            }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: m.opacity, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: MAP_CAMERA_TRANSITION_MS / 1000, ease: motionEase }}
            onClick={(e) => {
              e.stopPropagation()
              m.onClick?.()
            }}
            onMouseEnter={m.onMouseEnter}
            onMouseLeave={m.onMouseLeave}
            aria-label={m.id}
          />
        ))}
      </AnimatePresence>

      <AnimatePresence mode="sync">
        {labels.map((label) => (
          <motion.div
            key={`${label.id}-${filterKey}`}
            className={`map-overlay-label map-overlay-label--${label.kind}`}
            style={{ left: `${label.left}%`, top: `${label.top}%` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: MAP_CAMERA_TRANSITION_MS / 1000, ease: motionEase }}
          >
            <span className="map-overlay-label-text">{label.text}</span>
            {label.subtext && <span className="map-overlay-label-sub">{label.subtext}</span>}
          </motion.div>
        ))}
      </AnimatePresence>

      {layers.showRecordDetail && selectedPlace && (
        <motion.div
          className="map-record-flyout"
          style={{
            left: `${projectMapPoint(selectedPlace.coordinate.x, selectedPlace.coordinate.y, camera).left}%`,
            top: `${projectMapPoint(selectedPlace.coordinate.x, selectedPlace.coordinate.y, camera).top}%`,
          }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MAP_CAMERA_TRANSITION_MS / 1000, ease: motionEase }}
        >
          <div className="map-record-flyout-title">{placeShortName(selectedPlace.name)}</div>
          <div className="map-record-flyout-meta">
            {selectedPlace.people.length} people · {selectedPlace.eventCount} records
          </div>
        </motion.div>
      )}
    </div>
  )
}
