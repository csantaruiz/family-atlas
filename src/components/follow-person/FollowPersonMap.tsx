import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { WorldMapBackground } from '../map/WorldMapBackground'
import { MAP_CAMERA_TRANSITION_MS } from '../../utils/mapCamera'
import type { MapCamera, ViewBoxCamera } from '../../utils/mapSemanticZoom'
import { MAP_VIEW_BOX } from '../../utils/mapProjection'
import type { LifeJourney, LifeJourneyBeat } from '../../types/lifeJourney'

type FollowPersonMapProps = {
  journey: LifeJourney
  beat: LifeJourneyBeat
}

/** Follow-mode framing — left HUD reserve, no pan-coverage inflation. */
function followViewBox(
  camera: MapCamera,
  containerWidth: number,
  containerHeight: number,
): ViewBoxCamera {
  const zoom = Math.max(1.05, camera.scale)
  const aspect = containerWidth / Math.max(containerHeight, 1)

  let width: number
  let height: number
  if (aspect >= 1) {
    width = MAP_VIEW_BOX.width / zoom
    height = width / aspect
  } else {
    height = MAP_VIEW_BOX.height / zoom
    width = height * aspect
  }

  // Keep the focal place in the open map area (right of the narrative HUD).
  const focusX = 0.64
  const focusY = 0.46
  return {
    minX: camera.cx - width * focusX,
    minY: camera.cy - height * focusY,
    width,
    height,
  }
}

function cameraForBeat(beat: LifeJourneyBeat): MapCamera {
  if (!beat.map?.resolved) return { cx: 42, cy: 46, scale: 1.35 }
  return { cx: beat.map.x, cy: beat.map.y, scale: beat.map.scale }
}

/** Short place chip for the map — city only, never the full caption. */
function mapPlaceLabel(label: string | null): string | null {
  if (!label) return null
  const first = label.split(',')[0]?.trim()
  if (!first) return null
  // Drop spouse-name prefixes that slipped into place strings.
  const withoutPerson = first.includes(' · ') ? first.split(' · ').at(-1)?.trim() : first
  return withoutPerson || null
}

export function FollowPersonMap({ journey, beat }: FollowPersonMapProps) {
  const prefersReducedMotion = useReducedMotion()
  const frameRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const node = frameRef.current
    if (!node) return
    const update = () => {
      const rect = node.getBoundingClientRect()
      setSize({ width: rect.width, height: rect.height })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const camera = cameraForBeat(beat)
  const viewBox =
    size.width > 0 && size.height > 0
      ? followViewBox(camera, size.width, size.height)
      : { minX: 0, minY: 0, width: MAP_VIEW_BOX.width, height: MAP_VIEW_BOX.height }

  // Keep dots/labels roughly constant on screen as the viewBox zooms.
  const unit = Math.max(viewBox.width, viewBox.height) * 0.01
  const markerR = unit * 0.38
  const currentR = unit * 0.55
  const ringR = unit * 1.05
  const labelSize = unit * 0.95
  const labelOffset = unit * 1.55
  const pathWidth = unit * 0.22

  const path = useMemo(() => {
    const points = journey.beats
      .map((item) => item.map)
      .filter((point): point is NonNullable<typeof point> => Boolean(point?.resolved))
    if (points.length < 2) return ''
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  }, [journey.beats])

  const markers = useMemo(
    () =>
      journey.beats
        .filter((item) => item.map?.resolved)
        .map((item) => ({
          id: item.id,
          x: item.map!.x,
          y: item.map!.y,
          current: item.id === beat.id,
          label: item.id === beat.id ? mapPlaceLabel(beat.locationLabel) : null,
        })),
    [beat.id, beat.locationLabel, journey.beats],
  )

  const viewBoxValue = `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`
  const duration = prefersReducedMotion ? 0 : MAP_CAMERA_TRANSITION_MS / 1000

  return (
    <div className="follow-person-map" ref={frameRef} aria-hidden="true">
      <motion.svg
        className="follow-person-map-svg"
        initial={false}
        animate={{ viewBox: viewBoxValue }}
        transition={{ duration, ease: [0.22, 0.8, 0.2, 1] }}
        preserveAspectRatio="xMidYMid slice"
      >
        <WorldMapBackground idPrefix="follow-person-" fadeIn={false} />
        {path ? (
          <path
            className="follow-person-map-path"
            d={path}
            fill="none"
            strokeWidth={pathWidth}
          />
        ) : null}
        {markers.map((marker) => (
          <g key={marker.id} transform={`translate(${marker.x} ${marker.y})`}>
            {marker.current ? (
              <circle
                className="follow-person-map-ring"
                r={ringR}
                strokeWidth={unit * 0.12}
              />
            ) : null}
            <circle
              className={`follow-person-map-marker${marker.current ? ' is-current' : ''}`}
              r={marker.current ? currentR : markerR}
              strokeWidth={unit * 0.08}
            />
            {marker.current && marker.label ? (
              <text
                className="follow-person-map-label"
                x={0}
                y={-labelOffset}
                textAnchor="middle"
                fontSize={labelSize}
                strokeWidth={labelSize * 0.18}
              >
                {marker.label}
              </text>
            ) : null}
          </g>
        ))}
      </motion.svg>
      <div className="follow-person-map-vignette" />
    </div>
  )
}
