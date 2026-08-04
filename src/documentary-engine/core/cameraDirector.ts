import { hashPhase } from '../utils/camera'
import {
  applyHoldDrift,
  ATLAS_ESTABLISHING_CAMERA,
  interpolateCamera,
  softenCameraTarget,
} from './cameraFraming'
import { validateCameraGeography } from './cameraGeographicGuard'
import {
  interpolateStagedCamera,
  needsStagedTransition,
  resolveSceneEndTarget,
} from './cameraStagedTransitions'
import {
  applyEarlyStageCamera,
  isEarlyDocumentaryStage,
  resolveEarlyPreviewMarkers,
} from './earlyStageDirector'
import {
  mergeClosingStoryMarkers,
  resolveArcContextMarkers,
  resolveLateAddedScriptMarkers,
  shouldShowClosingStoryMarkers,
} from './lateStageMarkerDirector'
import { resolveDocumentaryRoutes } from './routeDirector'
import {
  resolveLateAddedPlaceIds,
  resolvePlaceIdsInActiveSegment,
} from './scriptMentionDirector'
import { resolveGeographicLabel, stripPlaceLabelsFromOverlay } from './geoLabelDirector'
import {
  isGeoLabelRevealed,
  markGeoLabelRevealed,
} from './displayRevealRegistry'
import { resolveAudioSync } from './audioSyncDirector'
import { resolveNarrativeOverlay } from './narrativeOverlayDirector'
import { resolveTimeLayer } from './timeLayerDirector'
import {
  applyFinaleCameraPolicy,
  dampCameraPan,
  finalePanDamping,
  isFinalDocumentaryQuarter,
  isFinaleThird,
} from './finaleCameraPolicy'
import {
  resolveFinaleHighlightPlaceId,
} from './finaleHighlightDirector'
import { resolveSceneAtTime } from './SceneDirector'
import {
  canDriveLocalCamera,
  getCanonicalPlace,
  scaleAtZoom,
} from '../data/canonicalPlaceRegistry'
import type {
  CameraDebugInfo,
  DocumentaryFrame,
  GeographicScale,
  ResolvedMarker,
  ResolvedRoute,
  SceneChoreography,
} from '../types/choreography'
import type { SceneManifestEntry } from '../types/manifest'
import type { MapCamera } from '../../utils/mapSemanticZoom'

type SceneCameraResult = {
  camera: MapCamera
  guardFailed: boolean
}

let cachedSceneStarts: {
  manifest: SceneManifestEntry[]
  starts: MapCamera[]
} | null = null

const SCALE_WIDEN_ORDER: GeographicScale[] = ['local', 'regional', 'country', 'continental', 'world']

function broaderGeographicScale(
  cameraScale: GeographicScale,
  choreographyScale?: GeographicScale,
): GeographicScale {
  if (!choreographyScale) return cameraScale
  return SCALE_WIDEN_ORDER.indexOf(cameraScale) >= SCALE_WIDEN_ORDER.indexOf(choreographyScale)
    ? cameraScale
    : choreographyScale
}

function isLocationFocused(choreography: SceneChoreography, progress: number): boolean {
  const activeId = choreography.activePlaceId
  if (!activeId) return false

  const focusIds = choreography.focusPlaceIds ?? []
  const singlePlaceFocus =
    focusIds.length <= 1 || (focusIds.length === 1 && focusIds[0] === activeId)

  if (choreography.holdCamera || choreography.cameraRelation === 'hold') {
    return singlePlaceFocus || focusIds.includes(activeId)
  }

  if (!singlePlaceFocus) return false

  const tightView =
    choreography.geographicScale === 'local' ||
    (choreography.geographicScale === 'regional' &&
      focusIds.length <= 1 &&
      (focusIds.length === 0 || focusIds[0] === activeId))

  if (!tightView) return false
  if (choreography.cameraRelation === 'continue-camera' && progress >= 0.35) return true
  if (progress >= 0.88) return true

  return false
}

function computeSceneCamera(
  scene: SceneManifestEntry,
  startCamera: MapCamera,
  progress: number,
  enableDrift = true,
): SceneCameraResult {
  const choreography = scene.choreography
  if (!choreography) {
    return { camera: startCamera, guardFailed: false }
  }

  const targetResult = resolveSceneEndTarget(choreography, {
    sceneId: scene.id,
    sceneType: scene.sceneType,
    previousCamera: startCamera,
  })

  let endCamera = softenCameraTarget(targetResult.camera, startCamera)
  if (choreography.holdCamera || choreography.cameraRelation === 'hold') {
    endCamera = startCamera
  }

  const phase = hashPhase(scene.id)
  const staged =
    !choreography.holdCamera &&
    choreography.cameraRelation !== 'hold' &&
    needsStagedTransition(startCamera, endCamera, choreography, scene.id)
  const locationFocused = isLocationFocused(choreography, progress)
  const driftOptions = { pan: !locationFocused, scale: true }

  let camera: MapCamera
  if (choreography.holdCamera || choreography.cameraRelation === 'hold') {
    camera = enableDrift ? applyHoldDrift(endCamera, progress, phase, driftOptions) : endCamera
  } else if (staged) {
    camera = interpolateStagedCamera(
      startCamera,
      endCamera,
      progress,
      scene.id,
      choreography,
    ).camera
  } else {
    camera = interpolateCamera(startCamera, endCamera, progress)
  }

  if (
    enableDrift &&
    !choreography.holdCamera &&
    choreography.cameraRelation !== 'hold' &&
    progress > 0.02
  ) {
    camera = applyHoldDrift(camera, progress, phase, driftOptions)
  }

  const guard = validateCameraGeography(
    choreography.activePlaceId,
    camera,
    startCamera,
    scene.id,
  )

  if (!guard.valid) {
    camera = interpolateCamera(startCamera, guard.camera, Math.min(1, progress * 1.4))
  }

  return { camera, guardFailed: !guard.valid }
}

function sceneStartCameras(manifest: SceneManifestEntry[]): MapCamera[] {
  if (cachedSceneStarts?.manifest === manifest) {
    return cachedSceneStarts.starts
  }

  const starts: MapCamera[] = [ATLAS_ESTABLISHING_CAMERA]

  for (let index = 1; index < manifest.length; index += 1) {
    const previous = manifest[index - 1]!
    const previousStart = starts[index - 1]!
    const { camera } = computeSceneCamera(previous, previousStart, 1)
    starts.push(camera)
  }

  cachedSceneStarts = { manifest, starts }
  return starts
}

function resolveMarkers(choreography: SceneChoreography, progress: number): ResolvedMarker[] {
  const activeId = choreography.activePlaceId
  if (!activeId) return []

  const place = getCanonicalPlace(activeId)
  if (!place || place.confidence === 'unresolved') return []
  if (choreography.geographicScale === 'local' && !canDriveLocalCamera(place.confidence)) return []

  const rampOpacity = Math.min(1, Math.max(0, progress / 0.18))
  const labelText = place.canonicalName
  let opacity = rampOpacity
  if (isGeoLabelRevealed(labelText)) {
    opacity = 1
  } else if (rampOpacity >= 0.95) {
    markGeoLabelRevealed(labelText)
  }

  return [
    {
      id: activeId,
      placeId: activeId,
      x: place.x,
      y: place.y,
      active: true,
      contextual: false,
      branch: place.branch,
      opacity,
    },
  ]
}

function resolveRoutes(
  manifest: SceneManifestEntry[],
  choreography: SceneChoreography,
  progress: number,
  closingMap: boolean,
  chapter: string,
  timeMs: number,
  visiblePlaceIds: string[],
  focusPlaceIds: string[],
  geographicScale: DocumentaryFrame['geographicScale'],
  currentSceneId: string,
): ResolvedRoute[] {
  return resolveDocumentaryRoutes(
    {
      manifest,
      chapter,
      branch: choreography.branch,
      geographicScale,
      sceneProgress: progress,
      closingMap,
      timeMs,
      visiblePlaceIds,
      focusPlaceIds,
      currentSceneId,
    },
    choreography,
  )
}

export function resolveDocumentaryFrame(
  manifest: SceneManifestEntry[],
  timeMs: number,
  durationMs: number,
): DocumentaryFrame | null {
  const resolved = resolveSceneAtTime(manifest, timeMs, durationMs)
  if (!resolved) return null

  const sceneIndex = manifest.indexOf(resolved.scene)
  const choreography = resolved.scene.choreography
  const approvedPeople = choreography?.approvedPeople ?? []
  const starts = sceneStartCameras(manifest)

  if (!choreography) {
    return {
      camera: ATLAS_ESTABLISHING_CAMERA,
      geographicScale: 'world',
      markers: [],
      geoLabel: null,
      routes: [],
      narrativeOverlay: resolved.scene.caption
        ? { title: resolved.scene.caption, opacity: 1 }
        : null,
      approvedPeople: [],
      chapter: resolved.chapter,
      sceneId: resolved.scene.id,
      sceneProgress: resolved.progress,
      timeLayer: { mode: 'hidden', opacity: 0, rangeStart: 0, rangeEnd: 0 },
    }
  }

  const startCamera = starts[sceneIndex] ?? ATLAS_ESTABLISHING_CAMERA
  const targetResult = resolveSceneEndTarget(choreography, {
    sceneId: resolved.scene.id,
    sceneType: resolved.scene.sceneType,
    previousCamera: startCamera,
  })

  let endCamera = softenCameraTarget(targetResult.camera, startCamera)
  if (choreography.holdCamera || choreography.cameraRelation === 'hold') {
    endCamera = startCamera
  }

  const panDamping = finalePanDamping(timeMs, durationMs)
  const enableDrift = panDamping > 0.75 && !isFinaleThird(timeMs, durationMs)

  const { camera: sceneCamera, guardFailed: cameraGuardFailed } = computeSceneCamera(
    resolved.scene,
    startCamera,
    resolved.progress,
    enableDrift,
  )

  let camera = sceneCamera
  if (panDamping < 1) {
    camera = dampCameraPan(startCamera, camera, panDamping)
  }
  if (isFinaleThird(timeMs, durationMs)) {
    camera = applyFinaleCameraPolicy(camera, timeMs, durationMs)
  }

  if (isEarlyDocumentaryStage(timeMs, resolved.chapter, resolved.scene.sceneType)) {
    camera = applyEarlyStageCamera(camera, timeMs)
  }

  const overlayProgress = resolved.rawProgress
  const sceneSpanMs = Math.max(1, resolved.scene.narrationEndMs - resolved.scene.narrationStartMs)
  const sceneProgress = Math.min(
    1,
    Math.max(0, (timeMs - resolved.scene.narrationStartMs) / sceneSpanMs),
  )
  const geographicScale = scaleAtZoom(camera.scale)
  const routeGeographicScale = broaderGeographicScale(geographicScale, choreography.geographicScale)
  const onWideClosingMap = shouldShowClosingStoryMarkers(
    timeMs,
    resolved.chapter,
    geographicScale,
  )
  const cuePlaceId = resolveAudioSync(timeMs, undefined, durationMs).cue.placeId
  const segmentPlaces = onWideClosingMap ? resolvePlaceIdsInActiveSegment(timeMs) : []
  const segmentPlaceId = segmentPlaces.at(-1)
  const latestLatePlaceId = onWideClosingMap
    ? resolveLateAddedPlaceIds(timeMs, durationMs).at(-1)
    : undefined
  const highlightPlaceId = onWideClosingMap
    ? segmentPlaceId ??
      latestLatePlaceId ??
      resolveFinaleHighlightPlaceId(cuePlaceId, choreography.activePlaceId)
    : cuePlaceId ?? choreography.activePlaceId
  const markers = onWideClosingMap
    ? mergeClosingStoryMarkers(
        resolveArcContextMarkers(highlightPlaceId),
        resolveLateAddedScriptMarkers(timeMs, durationMs),
      )
    : [
        ...(isEarlyDocumentaryStage(timeMs, resolved.chapter, resolved.scene.sceneType)
          ? resolveEarlyPreviewMarkers(timeMs)
          : []),
        ...resolveMarkers(choreography, overlayProgress),
      ]
  const geoLabels = resolveGeographicLabel(markers, geographicScale, highlightPlaceId)
  const hidePlaceLabels = isFinalDocumentaryQuarter(timeMs, durationMs)
  const geoLabel = cameraGuardFailed || hidePlaceLabels ? null : (geoLabels[0] ?? null)
  const mapLabelText = geoLabel?.text ?? null

  let narrativeOverlay = resolveNarrativeOverlay(
    choreography,
    overlayProgress,
    mapLabelText,
    timeMs,
    resolveAudioSync(timeMs, undefined, durationMs).cue.timeMs,
  )
  if (hidePlaceLabels) {
    narrativeOverlay = stripPlaceLabelsFromOverlay(narrativeOverlay)
  }
  const routes = resolveRoutes(
    manifest,
    choreography,
    sceneProgress,
    onWideClosingMap,
    resolved.scene.chapter,
    timeMs,
    [
      ...(choreography.visiblePlaceIds ?? []),
      ...(choreography.focusPlaceIds ?? []),
      ...markers.map((marker) => marker.placeId),
    ],
    choreography.focusPlaceIds ?? [],
    routeGeographicScale,
    resolved.scene.id,
  )
  const timeLayer = resolveTimeLayer(manifest, timeMs, narrativeOverlay, approvedPeople)

  const cameraDebug: CameraDebugInfo = {
    transitionType: choreography.cameraRelation,
    startCenter: startCamera,
    targetCenter: endCamera,
    currentCenter: camera,
    targetZoom: endCamera.scale,
    targetSource: targetResult.source,
    fallbackUsed: targetResult.fallbackUsed,
    fitBoundsActive: targetResult.fitBounds,
    staged:
      !choreography.holdCamera &&
      choreography.cameraRelation !== 'hold' &&
      needsStagedTransition(startCamera, endCamera, choreography, resolved.scene.id),
  }

  return {
    camera,
    geographicScale,
    markers,
    geoLabel,
    routes,
    narrativeOverlay,
    approvedPeople,
    activePlaceId: highlightPlaceId,
    chapter: resolved.chapter,
    sceneId: resolved.scene.id,
    sceneProgress: resolved.progress,
    timeLayer,
    cameraDebug,
    cameraGuardFailed,
  }
}

/** @internal test helper */
export function clearSceneStartCache(): void {
  cachedSceneStarts = null
}

export { clearFinaleCameraCache } from './finaleCameraPolicy'
