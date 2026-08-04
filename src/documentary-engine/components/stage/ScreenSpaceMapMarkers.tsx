import {
  projectPointInViewBoxCamera,
  type ViewBoxCamera,
} from '../../../utils/mapSemanticZoom'
import type { DocumentaryFrame } from '../../types/choreography'

type ScreenSpaceMapMarkersProps = {
  frame: DocumentaryFrame
  viewBox: ViewBoxCamera
  stageWidth: number
  stageHeight: number
}

/** Fixed-size screen markers — no CSS scale, anchored to viewBox projection. */
export function ScreenSpaceMapMarkers({
  frame,
  viewBox,
  stageWidth,
  stageHeight,
}: ScreenSpaceMapMarkersProps) {
  if (stageWidth < 2 || stageHeight < 2) return null

  return (
    <>
      {frame.markers.map((marker) => {
        const anchor = projectPointInViewBoxCamera(
          marker.x,
          marker.y,
          viewBox,
          stageWidth,
          stageHeight,
        )

        return (
          <div
            key={marker.id}
            className={[
              'de-marker',
              marker.active ? 'de-marker--active' : '',
              marker.contextual ? 'de-marker--context' : '',
              marker.preview ? 'de-marker--preview' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              left: `${anchor.left}%`,
              top: `${anchor.top}%`,
              opacity: marker.opacity,
            }}
          >
            <span className="de-marker-dot" aria-hidden="true" />
          </div>
        )
      })}
    </>
  )
}
