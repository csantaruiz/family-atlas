import {
  buildCanonicalMigrationCorridors,
  isTransoceanicPlacePair,
  resolveGedcomMigrationRoutes,
  resolveGedcomPlaceToCanonicalId,
  type GedcomRouteContext,
} from './gedcomMigrationDirector'
import { curvedRoutePath } from '../../utils/mapRoutes'
import {
  countSegmentDirections,
  migrationRouteFlowDuration,
  normalizeMigrationEndpoint,
  pickDominantEndpoints,
} from '../../utils/migrationRouteDirection'
import { getCanonicalPlace } from '../data/canonicalPlaceRegistry'
import type { ResolvedRoute, RouteEvidence, SceneChoreography } from '../types/choreography'
import type { SceneManifestEntry } from '../types/manifest'
import { DOCUMENTARY_V24 } from './renderingPolicy'
import {
  markManifestRouteRevealed,
  routeRevealKey,
} from './displayRevealRegistry'

const DRAW_SPAN = 0.38

function opacityForEvidence(
  evidence: RouteEvidence,
  closingContext = false,
  transoceanic = false,
): number {
  let base: number
  if (closingContext) {
    if (evidence === 'confirmed') base = 0.28
    else if (evidence === 'generational') base = 0.24
    else base = 0.22
  } else if (evidence === 'confirmed') base = 0.38
  else if (evidence === 'generational') base = 0.32
  else base = 0.28

  if (transoceanic) base *= 1.18
  return base
}

function drawProgress(sceneProgress: number, drawAfter: number): number {
  if (sceneProgress <= drawAfter) return 0
  return Math.min(1, (sceneProgress - drawAfter) / DRAW_SPAN)
}

function routeFromPlaces(
  id: string,
  fromId: string,
  toId: string,
  evidence: RouteEvidence,
  opacity: number,
  drawProgressValue: number,
): ResolvedRoute | null {
  const from = getCanonicalPlace(fromId)
  const to = getCanonicalPlace(toId)
  if (!from || !to || from.confidence === 'unresolved' || to.confidence === 'unresolved') {
    return null
  }
  if (from.x === to.x && from.y === to.y) return null

  const transoceanic = isTransoceanicPlacePair(fromId, toId)
  const fromKey = normalizeMigrationEndpoint(fromId)
  const toKey = normalizeMigrationEndpoint(toId)
  const corridors = buildCanonicalMigrationCorridors()
  const forwardCorridor = corridors.find(
    (corridor) => corridor.fromPlaceId === fromKey && corridor.toPlaceId === toKey,
  )
  const reverseCorridor = corridors.find(
    (corridor) => corridor.fromPlaceId === toKey && corridor.toPlaceId === fromKey,
  )

  let fromPoint = { x: from.x, y: from.y }
  let toPoint = { x: to.x, y: to.y }

  if (forwardCorridor || reverseCorridor) {
    const counts = countSegmentDirections(
      [...(forwardCorridor?.segments ?? []), ...(reverseCorridor?.segments ?? [])],
      fromKey,
      toKey,
      resolveGedcomPlaceToCanonicalId,
    )
    const endpoints = pickDominantEndpoints(fromPoint, toPoint, counts.forward, counts.reverse)
    fromPoint = endpoints.from
    toPoint = endpoints.to
  }

  return {
    id,
    d: curvedRoutePath(fromPoint, toPoint),
    evidence,
    opacity,
    drawProgress: drawProgressValue,
    transoceanic,
    flowDurationSec: migrationRouteFlowDuration(fromPoint, toPoint),
  }
}

function resolveChoreographyRoutes(
  choreography: SceneChoreography,
  sceneProgress: number,
  closingContext = false,
): ResolvedRoute[] {
  if (!choreography.routes?.length) return []

  return choreography.routes.flatMap((route, index) => {
    const progress = closingContext ? 1 : drawProgress(sceneProgress, route.drawAfter ?? 0.12)
    if (progress <= 0) return []

    const transoceanic = isTransoceanicPlacePair(route.fromId, route.toId)
    const resolved = routeFromPlaces(
      `manifest-${route.fromId}-${route.toId}-${index}`,
      route.fromId,
      route.toId,
      route.evidence,
      opacityForEvidence(route.evidence, closingContext, transoceanic) * (0.82 + progress * 0.18),
      progress,
    )
    return resolved ? [resolved] : []
  })
}

function resolveIntroducedManifestRoutes(
  manifest: SceneManifestEntry[],
  timeMs: number,
  currentSceneId?: string,
): ResolvedRoute[] {
  const seen = new Set<string>()
  const routes: ResolvedRoute[] = []

  for (const scene of manifest) {
    const choreography = scene.choreography
    if (!choreography?.routes?.length) continue

    const sceneDuration = Math.max(1, scene.narrationEndMs - scene.narrationStartMs)
    const sceneProgress = Math.min(
      1,
      Math.max(0, (timeMs - scene.narrationStartMs) / sceneDuration),
    )

    for (const [index, route] of choreography.routes.entries()) {
      const drawAfter = route.drawAfter ?? 0.12
      const progress = drawProgress(sceneProgress, drawAfter)
      if (progress <= 0) continue

      const key = routeRevealKey(route.fromId, route.toId, route.evidence)
      if (seen.has(key)) continue

      const stillAnimatingInCurrentScene =
        scene.id === currentSceneId && progress < 1 && timeMs < scene.narrationEndMs
      if (stillAnimatingInCurrentScene) continue

      seen.add(key)
      markManifestRouteRevealed(key, timeMs)

      const transoceanic = isTransoceanicPlacePair(route.fromId, route.toId)
      const resolved = routeFromPlaces(
        `manifest-introduced-${route.fromId}-${route.toId}-${index}`,
        route.fromId,
        route.toId,
        route.evidence,
        opacityForEvidence(route.evidence, false, transoceanic),
        1,
      )
      if (resolved) routes.push(resolved)
    }
  }

  return routes
}

function resolveManifestClosingArcs(manifest: SceneManifestEntry[]): ResolvedRoute[] {
  const seen = new Set<string>()
  const routes: ResolvedRoute[] = []

  for (const scene of manifest) {
    for (const [index, route] of (scene.choreography?.routes ?? []).entries()) {
      const key = `${route.fromId}->${route.toId}:${route.evidence}`
      if (seen.has(key)) continue
      seen.add(key)

      const transoceanic = isTransoceanicPlacePair(route.fromId, route.toId)
      const resolved = routeFromPlaces(
        `manifest-closing-${route.fromId}-${route.toId}-${index}`,
        route.fromId,
        route.toId,
        route.evidence,
        opacityForEvidence(route.evidence, true, transoceanic),
        1,
      )
      if (resolved) routes.push(resolved)
    }
  }

  return routes
}

function mergeRoutes(...groups: ResolvedRoute[][]): ResolvedRoute[] {
  const byId = new Map<string, ResolvedRoute>()
  for (const group of groups) {
    for (const route of group) {
      byId.set(route.id, route)
    }
  }
  return [...byId.values()]
}

export type DocumentaryRouteContext = GedcomRouteContext & {
  manifest: SceneManifestEntry[]
  currentSceneId?: string
}

/** Scene, GEDCOM, and closing-map migration arcs. */
export function resolveDocumentaryRoutes(
  context: DocumentaryRouteContext,
  choreography: SceneChoreography,
): ResolvedRoute[] {
  if (DOCUMENTARY_V24.disableRoutes) return []

  const introducedRoutes = resolveIntroducedManifestRoutes(
    context.manifest,
    context.timeMs,
    context.currentSceneId,
  )
  const choreographyRoutes = resolveChoreographyRoutes(
    choreography,
    context.sceneProgress,
    context.closingMap,
  )
  const gedcomRoutes = resolveGedcomMigrationRoutes(context)

  if (context.closingMap) {
    return mergeRoutes(
      gedcomRoutes,
      resolveManifestClosingArcs(context.manifest),
      introducedRoutes,
      choreographyRoutes,
    )
  }

  return mergeRoutes(gedcomRoutes, introducedRoutes, choreographyRoutes)
}
