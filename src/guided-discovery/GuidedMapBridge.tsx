import { useEffect } from 'react'
import { useMapExploration } from '../context/MapExplorationContext'
import type { FamilyRegion } from '../utils/mapRegions'
import type { RegionalRoute } from '../utils/mapRoutes'
import { useGuidedDiscovery } from './GuidedDiscoveryContext'

type GuidedMapBridgeProps = {
  active: boolean
  regions: FamilyRegion[]
  routes: RegionalRoute[]
}

/**
 * Applies guided map intents once Journeys is mounted and routes are ready.
 * Lives inside MapExplorationProvider.
 */
export function GuidedMapBridge({ active, regions, routes }: GuidedMapBridgeProps) {
  const { status, mapIntent, clearMapIntent } = useGuidedDiscovery()
  const { selectRoute, resetExploration, exploreRegion } = useMapExploration()

  useEffect(() => {
    if (!active || status !== 'active' || !mapIntent) return

    if (mapIntent.type === 'overview') {
      resetExploration()
      clearMapIntent()
      return
    }

    if (mapIntent.type === 'region') {
      const region = regions.find((r) => r.id === mapIntent.regionId)
      if (region) exploreRegion(region)
      clearMapIntent()
      return
    }

    if (mapIntent.type === 'route') {
      // Wait until route index is populated — clearing early drops the chapter focus.
      if (routes.length === 0) return
      const route = routes.find((r) => r.id === mapIntent.routeId)
      if (route) {
        selectRoute(route, 'route')
      } else {
        resetExploration()
      }
      clearMapIntent()
    }
  }, [
    active,
    clearMapIntent,
    exploreRegion,
    mapIntent,
    regions,
    resetExploration,
    routes,
    selectRoute,
    status,
  ])

  return null
}
