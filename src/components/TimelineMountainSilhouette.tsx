import { useMemo } from 'react'
import { timelineAxisY } from '../utils/chapterCalloutLayout'
import {
  buildMountainSilhouettePath,
  mountainSilhouetteMaxHeight,
} from '../utils/timelineMountainSilhouette'
import { useTimeline } from '../context/TimelineContext'

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
  const { isZooming } = useTimeline()
  const interactionLocked = isZooming
  const axisY = useMemo(() => timelineAxisY(height, width), [height, width])
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
        // Coarser sampling while zooming keeps animation responsive.
        stepPxScale: interactionLocked ? 2.4 : 1,
      }),
    [start, end, span, width, axisY, maxHeight, interactionLocked],
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
