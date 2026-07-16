import type { FamilyRegion } from '../../utils/mapRegions'
import type { MapSubregion } from '../../utils/mapSubregions'
import {
  fitCameraForRegion,
  usableViewport,
  type MapViewportLayout,
} from '../../utils/mapCamera'
import { MAP_DEBUG } from '../../utils/mapDebug'
import type { MapCamera, MapZoomLevel } from '../../utils/mapSemanticZoom'
import { projectMapPoint } from '../../utils/mapSemanticZoom'

type MapDebugOverlayProps = {
  regions: FamilyRegion[]
  subregions: MapSubregion[]
  camera: MapCamera
  level: MapZoomLevel
  layout: MapViewportLayout | null
  focusRegionId: string | null
}

export function MapDebugOverlay({
  regions,
  subregions,
  camera,
  level,
  layout,
  focusRegionId,
}: MapDebugOverlayProps) {
  if (!MAP_DEBUG || !layout) return null

  const usable = usableViewport(layout)
  const selectedRegion = focusRegionId
    ? regions.find((r) => r.id === focusRegionId)
    : null
  const fitCamera =
    selectedRegion && level !== 'family'
      ? fitCameraForRegion(selectedRegion.bounds, layout, level)
      : null

  return (
    <div className="map-debug-overlay" aria-hidden="true">
      <div
        className="map-debug-usable-viewport"
        style={{
          left: `${usable.centerXPercent - usable.widthPercent / 2}%`,
          top: `${usable.centerYPercent - usable.heightPercent / 2}%`,
          width: `${usable.widthPercent}%`,
          height: `${usable.heightPercent}%`,
        }}
      />
      {fitCamera && (
        <div
          className="map-debug-camera-target"
          style={{
            left: `${usable.centerXPercent}%`,
            top: `${usable.centerYPercent}%`,
          }}
        />
      )}
      {regions.map((region) => {
        const anchor = projectMapPoint(region.anchor.x, region.anchor.y, camera)
        const bounds = region.bounds
        const tl = projectMapPoint(bounds.minX, bounds.minY, camera)
        const br = projectMapPoint(bounds.maxX, bounds.maxY, camera)
        const ellipse = region.ellipse
        const ex = projectMapPoint(ellipse.cx, ellipse.cy, camera)
        return (
          <div key={region.id}>
            <div
              className="map-debug-bounds"
              style={{
                left: `${Math.min(tl.left, br.left)}%`,
                top: `${Math.min(tl.top, br.top)}%`,
                width: `${Math.abs(br.left - tl.left)}%`,
                height: `${Math.abs(br.top - tl.top)}%`,
              }}
            />
            <div
              className="map-debug-centroid"
              style={{ left: `${anchor.left}%`, top: `${anchor.top}%` }}
            />
            <div
              className="map-debug-ellipse-center"
              style={{ left: `${ex.left}%`, top: `${ex.top}%` }}
            />
          </div>
        )
      })}
      {subregions.map((sub) => {
        const anchor = projectMapPoint(sub.anchor.x, sub.anchor.y, camera)
        return (
          <div
            key={sub.id}
            className="map-debug-sub-centroid"
            style={{ left: `${anchor.left}%`, top: `${anchor.top}%` }}
          />
        )
      })}
    </div>
  )
}
