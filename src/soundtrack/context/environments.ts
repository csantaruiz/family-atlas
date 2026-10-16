import type { WorldRegion } from './geography'
import type { HistoricalPeriod } from './periods'

/**
 * Musical environments are the primary selection axis: geography + period
 * choose an environment; narrative mood refines within it when multiple tracks exist.
 */
export type SoundtrackEnvironmentId =
  | 'main'
  | 'mexico_southwest'
  | 'britain_ireland'
  | 'industrial_america'
  | 'wwii_1940s'
  | 'iberia'

export type SoundtrackEnvironment = {
  id: SoundtrackEnvironmentId
  label: string
  /** Short description for the preview lab and catalog UI. */
  summary: string
  regions: readonly WorldRegion[] | 'any'
  periods: readonly HistoricalPeriod[] | 'any'
}

export const SOUNDTRACK_ENVIRONMENTS: readonly SoundtrackEnvironment[] = [
  {
    id: 'main',
    label: 'Atlas Main Theme',
    summary: 'Cinematic signature theme for broad exploration and uncertain context.',
    regions: 'any',
    periods: 'any',
  },
  {
    id: 'mexico_southwest',
    label: 'Mexico / Southwest',
    summary: 'Mexican and borderlands atmosphere for Latin American ancestral places.',
    regions: ['latin_america'],
    periods: 'any',
  },
  {
    id: 'britain_ireland',
    label: 'Britain & Ireland',
    summary: 'British and Irish atmospheric instrumental colour for Isles ancestry.',
    regions: ['british_isles'],
    periods: 'any',
  },
  {
    id: 'industrial_america',
    label: 'Industrial America',
    summary: 'Late-19th / early-20th American period colour for U.S. industrialization and immigration eras.',
    regions: ['north_america'],
    periods: ['c19', 'early_20th'],
  },
  {
    id: 'wwii_1940s',
    label: 'WWII / 1940s',
    summary: 'Restrained wartime remembrance for documented world-war years and military service.',
    regions: 'any',
    periods: ['world_wars'],
  },
  {
    id: 'iberia',
    label: 'Iberia / Spain',
    summary: 'Spanish and Portuguese classical guitar colour for southern European origins.',
    regions: ['southern_europe'],
    periods: 'any',
  },
]

export const MAIN_ENVIRONMENT: SoundtrackEnvironmentId = 'main'
