import { useEffect, useMemo, useRef, useState } from 'react'
import { WorldMapBackground } from '../../../components/map/WorldMapBackground'
import { MAP_VIEW_BOX } from '../../../utils/mapProjection'
import { viewBoxCameraForContainer } from '../../../utils/mapSemanticZoom'
import { useDocumentaryEngine } from '../../context/DocumentaryEngineContext'
import { useSmoothViewBox } from '../../hooks/useSmoothViewBox'
import type { DocumentaryFrame } from '../../types/choreography'
import { ScreenSpaceGeoLabels } from './ScreenSpaceGeoLabels'
import { ScreenSpaceMapMarkers } from './ScreenSpaceMapMarkers'
import { ViewBoxMapMarkers } from './ViewBoxMapMarkers'
import { ViewBoxMapRoutes } from './ViewBoxMapRoutes'
import { isClosingStoryMap } from '../../core/lateStageMarkerDirector'

type PersistentMapStageProps = {
  frame: DocumentaryFrame | null
}

export function PersistentMapStage({ frame }: PersistentMapStageProps) {
  const { seekGeneration } = useDocumentaryEngine()
  const hostRef = useRef<HTMLDivElement>(null)
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = hostRef.current
    if (!el) return

    const update = () => {
      const rect = el.getBoundingClientRect()
      setStageSize({ width: rect.width, height: rect.height })
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const targetViewBox = useMemo(() => {
    if (!frame || stageSize.width < 2 || stageSize.height < 2) return null
    return viewBoxCameraForContainer(frame.camera, stageSize.width, stageSize.height)
  }, [frame, stageSize.height, stageSize.width])

  const viewBox = useSmoothViewBox(targetViewBox, seekGeneration)

  if (!frame) return <div className="de-map-stage" ref={hostRef} />

  const viewBoxAttr = viewBox
    ? `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`
    : `0 0 ${MAP_VIEW_BOX.width} ${MAP_VIEW_BOX.height}`
  const closingStoryMap = isClosingStoryMap(frame)
  const mapMarkers = frame.markers.filter((marker) => !marker.preview && marker.opacity > 0.02)
  const mapRoutes = frame.routes.filter((route) => route.drawProgress > 0.01 && route.opacity > 0.02)

  return (
    <div className="de-map-stage" ref={hostRef}>
      <div className="de-map-camera">
        <svg
          className="de-map-svg"
          viewBox={viewBoxAttr}
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <WorldMapBackground idPrefix="de-" fadeIn={false} />
        </svg>

        {viewBox && mapRoutes.length > 0 ? (
          <svg
            className={`de-map-svg de-map-routes-layer${closingStoryMap ? ' de-map-routes-layer--closing' : ''}`}
            viewBox={viewBoxAttr}
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <ViewBoxMapRoutes routes={mapRoutes} />
          </svg>
        ) : null}

        {closingStoryMap && viewBox && mapMarkers.length > 0 ? (
          <svg
            className="de-map-svg de-map-markers-layer"
            viewBox={viewBoxAttr}
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <ViewBoxMapMarkers
              markers={mapMarkers}
              viewBoxWidth={viewBox.width}
              stageWidth={stageSize.width}
            />
          </svg>
        ) : null}
      </div>

      {viewBox ? (
        <div className={closingStoryMap ? 'de-map-overlays de-map-overlays--closing' : 'de-map-overlays'}>
          {!closingStoryMap ? (
            <ScreenSpaceMapMarkers
              frame={frame}
              viewBox={viewBox}
              stageWidth={stageSize.width}
              stageHeight={stageSize.height}
            />
          ) : null}
          <ScreenSpaceGeoLabels
            frame={frame}
            viewBox={viewBox}
            stageWidth={stageSize.width}
            stageHeight={stageSize.height}
          />
        </div>
      ) : null}
    </div>
  )
}
