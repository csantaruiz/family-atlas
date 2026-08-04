import {
  projectPointInViewBoxCamera,
  type ViewBoxCamera,
} from '../../../utils/mapSemanticZoom'
import type { DocumentaryFrame } from '../../types/choreography'

type ScreenSpaceGeoLabelsProps = {
  frame: DocumentaryFrame
  viewBox: ViewBoxCamera
  stageWidth: number
  stageHeight: number
}

/** Fixed px geographic label — screen space, no CSS scale transforms. */
export function ScreenSpaceGeoLabels({
  frame,
  viewBox,
  stageWidth,
  stageHeight,
}: ScreenSpaceGeoLabelsProps) {
  const label = frame.geoLabel
  if (!label || stageWidth < 2 || stageHeight < 2) return null

  const anchor = projectPointInViewBoxCamera(
    label.x,
    label.y,
    viewBox,
    stageWidth,
    stageHeight,
  )

  return (
    <div
      className="de-geo-label-screen"
      style={{
        left: `${anchor.left}%`,
        top: `${anchor.top}%`,
        opacity: label.opacity,
      }}
    >
      <span
        className="de-geo-label-screen__primary"
        style={{ fontSize: `${label.fontSizePx}px` }}
      >
        {label.text}
      </span>
      {label.subtext ? (
        <span className="de-geo-label-screen__sub">{label.subtext}</span>
      ) : null}
    </div>
  )
}
