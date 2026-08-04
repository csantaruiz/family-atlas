import type { MapCamera } from '../../utils/mapSemanticZoom'
import { SCALE_ZOOM } from '../data/canonicalPlaceRegistry'
import type { GeographicScale, SceneChoreography } from '../types/choreography'
import { cameraForPlaceScale, interpolateCamera, softenCameraTarget } from './cameraFraming'
import { resolveCameraTarget, type ResolvedCameraTarget } from './cameraTargetResolver'

type StagedWaypoint = {
  placeId?: string
  geographicScale: GeographicScale
}

const STAGED_SCENE_WAYPOINTS: Record<string, StagedWaypoint[]> = {
  'spain-branch': [
    { placeId: 'england', geographicScale: 'country' },
    { placeId: 'spain', geographicScale: 'country' },
  ],
  'chihuahua-arrival': [
    { placeId: 'spain', geographicScale: 'continental' },
    { placeId: 'chihuahua', geographicScale: 'regional' },
  ],
  'migration-california': [
    { placeId: 'el-paso', geographicScale: 'regional' },
    { placeId: 'california', geographicScale: 'regional' },
  ],
}

function waypointCamera(waypoint: StagedWaypoint): MapCamera | null {
  if (!waypoint.placeId) return null
  return cameraForPlaceScale(waypoint.placeId, waypoint.geographicScale)
}

function cameraDistance(a: MapCamera, b: MapCamera): number {
  return Math.hypot(a.cx - b.cx, a.cy - b.cy) + Math.abs(a.scale - b.scale) * 4
}

export function needsStagedTransition(
  start: MapCamera,
  end: MapCamera,
  choreography: SceneChoreography,
  sceneId: string,
): boolean {
  if (choreography.cameraRelation === 'chapter-reset' || choreography.cameraRelation === 'chapter-transition') {
    return true
  }
  if (STAGED_SCENE_WAYPOINTS[sceneId]?.length) return true
  return cameraDistance(start, end) > 14
}

export function interpolateStagedCamera(
  start: MapCamera,
  end: MapCamera,
  progress: number,
  sceneId: string,
  choreography: SceneChoreography,
): { camera: MapCamera; staged: boolean } {
  const waypoints = STAGED_SCENE_WAYPOINTS[sceneId] ?? []
  const keys: MapCamera[] = [start]

  for (const waypoint of waypoints) {
    const cam = waypointCamera(waypoint)
    if (cam) {
      const previous = keys[keys.length - 1] ?? start
      keys.push(softenCameraTarget(cam, previous))
    }
  }
  keys.push(softenCameraTarget(end, keys[keys.length - 1] ?? start))

  if (keys.length <= 2) {
    return { camera: interpolateCamera(start, end, progress), staged: false }
  }

  const segmentCount = keys.length - 1
  const t = Math.min(1, Math.max(0, progress)) * segmentCount
  const segmentIndex = Math.min(segmentCount - 1, Math.floor(t))
  const segmentProgress = t - segmentIndex

  const from = keys[segmentIndex] ?? start
  const to = keys[segmentIndex + 1] ?? end

  if (choreography.cameraRelation === 'chapter-reset' && segmentIndex === 0) {
    const pullBack: MapCamera = {
      cx: from.cx,
      cy: from.cy,
      scale: Math.min(from.scale, SCALE_ZOOM.continental),
    }
    return {
      camera: interpolateCamera(pullBack, to, segmentProgress),
      staged: true,
    }
  }

  return {
    camera: interpolateCamera(from, to, segmentProgress),
    staged: true,
  }
}

export function resolveSceneEndTarget(
  choreography: SceneChoreography,
  options: {
    sceneId?: string
    sceneType?: string
    previousCamera: MapCamera
  },
): ResolvedCameraTarget {
  const resolved = resolveCameraTarget(choreography, options)
  if (resolved) return resolved

  if (import.meta.env.DEV && options.sceneId) {
    console.warn(
      `[documentary-camera] scene=${options.sceneId} retaining previous camera — target unresolved`,
    )
  }

  return {
    camera: options.previousCamera,
    source: 'previous-camera',
    fitBounds: false,
    fallbackUsed: true,
    activePlaceId: choreography.activePlaceId,
  }
}
