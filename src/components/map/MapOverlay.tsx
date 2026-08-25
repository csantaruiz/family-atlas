import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { FamilyRegion, FamilyRegionId } from '../../utils/mapRegions'
import type { MapSubregion } from '../../utils/mapSubregions'
import {
  estimateLabelWidthPx,
  labelBudgetForLevel,
  layoutMapLabels,
  projectLabelPoint,
  topPlacesByWeight,
  type PlacedMapLabel,
} from '../../utils/mapLabelLayout'
import { MAP_CAMERA_TRANSITION_MS } from '../../utils/mapCamera'
import {
  type MapCamera,
  type MapLayerVisibility,
  type MapZoomLevel,
} from '../../utils/mapSemanticZoom'
import type { PlaceRecord } from '../../utils/placeIndex'

const motionEase = [0.22, 0.8, 0.2, 1] as const
const MARKER_HIT_PX = 48

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
  instant?: boolean
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
  instant = false,
}: MapOverlayProps) {
  const project = useMemo(
    () => (x: number, y: number) =>
      projectLabelPoint(x, y, camera, frameWidth, frameHeight),
    [camera, frameWidth, frameHeight],
  )

  const topPlaceIds = useMemo(() => {
    if (layers.showAllPlaces) return new Set(places.map((p) => p.id))
    return topPlacesByWeight(places, Math.max(6, Math.floor(places.length * 0.35)))
  }, [places, layers.showAllPlaces])

  const labels = useMemo((): PlacedMapLabel[] => {
    if (frameWidth < 10 || frameHeight < 10) return []

    const candidates: Parameters<typeof layoutMapLabels>[0] = []

    if (layers.showMajorLabels || focusRegionId) {
      for (const region of regions) {
        const selected = region.id === focusRegionId
        if (!layers.showMajorLabels && !selected) continue
        if (focusRegionId && region.id !== focusRegionId && level !== 'family') continue
        candidates.push({
          id: `major-label-${region.id}`,
          x: region.anchor.x,
          y: region.anchor.y,
          text: region.name,
          priority: selected ? 140 : 100,
          kind: 'major',
          widthPx: estimateLabelWidthPx('major', region.name, frameWidth),
          heightPx: 34,
        })
      }
    }

    if (layers.showSubregionLabels) {
      for (const sub of subregions) {
        if (focusRegionId && sub.parentRegionId !== focusRegionId) continue
        const selected = sub.id === focusSubregionId
        candidates.push({
          id: `sub-label-${sub.id}`,
          x: sub.anchor.x,
          y: sub.anchor.y,
          text: sub.name,
          priority: selected ? 120 : 80,
          kind: 'sub',
          widthPx: estimateLabelWidthPx('sub', sub.name, frameWidth),
          heightPx: 28,
        })
      }
    }

    if (layers.showPlaceLabels) {
      for (const place of places) {
        if (!topPlaceIds.has(place.id)) continue
        const name = placeShortName(place.name)
        const selected = place.id === selectedPlaceId
        candidates.push({
          id: `place-label-${place.id}`,
          x: place.coordinate.x,
          y: place.coordinate.y,
          text: name,
          priority: selected ? 110 : layers.showAllPlaces ? 55 : 48,
          kind: 'place',
          widthPx: estimateLabelWidthPx('place', name, frameWidth),
          heightPx: 22,
        })
      }
    }

    return layoutMapLabels(
      candidates,
      frameWidth,
      frameHeight,
      labelBudgetForLevel(level),
      project,
    )
  }, [
    frameWidth,
    frameHeight,
    layers,
    regions,
    subregions,
    places,
    focusRegionId,
    focusSubregionId,
    selectedPlaceId,
    level,
    topPlaceIds,
    project,
  ])

  const markers = useMemo(() => {
    const items: {
      id: string
      left: number
      top: number
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
        const pos = project(region.anchor.x, region.anchor.y)
        if (pos.left < -8 || pos.left > 108 || pos.top < -8 || pos.top > 108) continue
        items.push({
          id: `major-${region.id}`,
          left: pos.left,
          top: pos.top,
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
        const pos = project(sub.anchor.x, sub.anchor.y)
        const dimmed = focusSubregionId != null && sub.id !== focusSubregionId
        items.push({
          id: `sub-${sub.id}`,
          left: pos.left,
          top: pos.top,
          kind: 'sub',
          opacity: dimmed ? 0.35 : 0.9,
          onClick: () => onSubregionClick(sub),
          selected: focusSubregionId === sub.id,
        })
      }
    }

    if (layers.showPlaces) {
      for (const place of places) {
        if (!topPlaceIds.has(place.id)) continue
        const pos = project(place.coordinate.x, place.coordinate.y)
        items.push({
          id: `place-${place.id}`,
          left: pos.left,
          top: pos.top,
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
    topPlaceIds,
    hoveredRegionId,
    selectedPlaceId,
    onRegionClick,
    onSubregionClick,
    onPlaceClick,
    onRegionHover,
    project,
  ])

  const selectedPlace = places.find((p) => p.id === selectedPlaceId)
  const flyoutPos = selectedPlace
    ? project(selectedPlace.coordinate.x, selectedPlace.coordinate.y)
    : null

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
              width: MARKER_HIT_PX,
              height: MARKER_HIT_PX,
              opacity: m.opacity,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: m.opacity }}
            exit={{ opacity: 0 }}
            transition={{ duration: instant ? 0 : MAP_CAMERA_TRANSITION_MS / 1000, ease: motionEase }}
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
            transition={{ duration: instant ? 0 : MAP_CAMERA_TRANSITION_MS / 1000, ease: motionEase }}
          >
            <span className="map-overlay-label-text">{label.text}</span>
            {label.subtext && <span className="map-overlay-label-sub">{label.subtext}</span>}
          </motion.div>
        ))}
      </AnimatePresence>

      {layers.showRecordDetail && selectedPlace && flyoutPos ? (
        <motion.div
          className="map-record-flyout"
          style={{
            left: `${flyoutPos.left}%`,
            top: `${flyoutPos.top}%`,
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
      ) : null}
    </div>
  )
}
