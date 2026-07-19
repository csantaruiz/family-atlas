import { useMemo } from 'react'
import { timelineAxisY } from '../utils/chapterCalloutLayout'
import {
  buildMountainSilhouettePath,
  mountainSilhouetteMaxHeight,
} from '../utils/timelineMountainSilhouette'

type TimelineMountainSilhouetteProps = {
  start: number
  end: number
  span: number
  width: number
  height: number
}

export function TimelineMountainSilhouette({
  start,
  end,
  span,
  width,
  height,
}: TimelineMountainSilhouetteProps) {
  const axisY = useMemo(() => timelineAxisY(height), [height])
  const maxHeight = useMemo(() => mountainSilhouetteMaxHeight(height), [height])

  const path = useMemo(
    () =>
      buildMountainSilhouettePath({
        start,
        end,
        span,
        width,
        axisY,
        maxHeight,
      }),
    [start, end, span, width, axisY, maxHeight],
  )

  if (width <= 0 || height <= 0 || !path) return null

  return (
    <svg
      className="timeline-mountain-silhouette"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <path d={path} className="timeline-mountain-silhouette-fill" />
    </svg>
  )
}
