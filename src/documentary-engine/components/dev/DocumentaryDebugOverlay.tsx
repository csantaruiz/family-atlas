import type { DocumentaryFrame } from '../../types/choreography'
import { getCanonicalPlace } from '../../data/canonicalPlaceRegistry'
import { placeAtCameraCenter } from '../../core/cameraTargetResolver'

type DocumentaryDebugOverlayProps = {
  frame: DocumentaryFrame | null
}

function isDebugMode(): boolean {
  if (!import.meta.env.DEV) return false
  const flag = new URLSearchParams(window.location.search).get('debug')
  return flag === '1' || flag === 'true'
}

export function DocumentaryDebugOverlay({ frame }: DocumentaryDebugOverlayProps) {
  if (!frame || !isDebugMode()) return null

  const activePlace = frame.activePlaceId ? getCanonicalPlace(frame.activePlaceId) : null
  const centerPlace = placeAtCameraCenter(frame.camera)
  const activePerson = frame.approvedPeople.find(
    (p) => frame.sceneProgress >= p.start && frame.sceneProgress < p.end,
  )
  const debug = frame.cameraDebug

  return (
    <div className="de-debug-overlay">
      <p>scene: {frame.sceneId}</p>
      {debug ? (
        <>
          <p>transition: {debug.transitionType}{debug.staged ? ' (staged)' : ''}</p>
          <p>
            start: {debug.startCenter.cx.toFixed(2)}, {debug.startCenter.cy.toFixed(2)} scale=
            {debug.startCenter.scale.toFixed(2)}
          </p>
          <p>
            target: {debug.targetCenter.cx.toFixed(2)}, {debug.targetCenter.cy.toFixed(2)} scale=
            {debug.targetZoom.toFixed(2)}
          </p>
          <p>
            current: {debug.currentCenter.cx.toFixed(2)}, {debug.currentCenter.cy.toFixed(2)} scale=
            {debug.currentCenter.scale.toFixed(2)}
          </p>
          <p>
            source: {debug.targetSource} | fallback: {debug.fallbackUsed ? 'yes' : 'no'} | fitBounds:{' '}
            {debug.fitBoundsActive ? 'yes' : 'no'}
          </p>
        </>
      ) : null}
      <p>scale band: {frame.geographicScale}</p>
      {activePlace ? (
        <>
          <p>
            place: {activePlace.id} ({activePlace.latitude}, {activePlace.longitude}) [
            {activePlace.confidence}]
          </p>
          <p>
            projected: x={activePlace.x.toFixed(2)} y={activePlace.y.toFixed(2)}
          </p>
        </>
      ) : (
        <p>place: —</p>
      )}
      {centerPlace ? (
        <p>
          camera near: {centerPlace.canonicalName} ({centerPlace.latitude}, {centerPlace.longitude})
        </p>
      ) : null}
      <p>approved: {frame.approvedPeople.map((p) => p.displayName).join(', ') || 'none'}</p>
      <p>active person: {activePerson?.displayName ?? 'none'}</p>
      <p>time layer: {frame.timeLayer.mode}</p>
      <p>geo label: {frame.geoLabel?.text ?? 'none'}</p>
    </div>
  )
}
