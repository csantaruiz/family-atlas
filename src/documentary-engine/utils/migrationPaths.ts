import { curvedRoutePath } from '../../utils/mapRoutes'
import type { MapLocation, MigrationPath, SceneManifestEntry } from '../types/manifest'

export type ResolvedMigrationRoute = {
  d: string
  generational?: boolean
}

export function resolveMigrationRoutes(
  locations: MapLocation[],
  paths: MigrationPath[] | undefined,
): ResolvedMigrationRoute[] {
  if (!paths?.length || !locations.length) return []

  const byId = new Map(locations.map((loc) => [loc.id, loc]))
  const routes: ResolvedMigrationRoute[] = []

  for (const path of paths) {
    const from = byId.get(path.fromId)
    const to = byId.get(path.toId)
    if (!from || !to) continue
    if (from.resolved === false || to.resolved === false) continue
    if (from.x === to.x && from.y === to.y) continue

    routes.push({
      d: curvedRoutePath(from, to),
      generational: path.generational,
    })
  }

  return routes
}

/** Extend the final scene to the narration duration once audio metadata loads. */
export function finalizeManifest(
  manifest: SceneManifestEntry[],
  narrationDurationMs: number,
): SceneManifestEntry[] {
  if (manifest.length === 0 || narrationDurationMs <= 0) return manifest
  const end = Math.max(narrationDurationMs, manifest[manifest.length - 1].narrationStartMs + 1000)
  return manifest.map((scene, index) =>
    index === manifest.length - 1 ? { ...scene, narrationEndMs: end } : scene,
  )
}
