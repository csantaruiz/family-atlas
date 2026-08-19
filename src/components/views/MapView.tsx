import { useEffect, useMemo, useState } from 'react'
import { familyDatabase } from '../../data'
import { MapExplorationProvider, useMapExploration } from '../../context/MapExplorationContext'
import { useTimeline } from '../../context/TimelineContext'
import {
  branchOptions,
  centuryOptions,
} from '../../utils/personDirectory'
import { resolveExploreMapCoordinate } from '../../data/placeCoordinates'
import {
  buildMigrationSegments,
  buildPlaceIndex,
  computeMapSummary,
  DEFAULT_MAP_FILTERS,
  filterPlaces,
} from '../../utils/placeIndex'
import { buildFamilyRegions } from '../../utils/mapRegions'
import { buildLineagePalette } from '../../utils/lineageColors'
import { buildRegionalRoutes, buildSubregionRoutes } from '../../utils/mapRoutes'
import { buildSubregions } from '../../utils/mapSubregions'
import { FamilyMap } from '../map/FamilyMap'
import { MapDetailPanel } from '../map/MapDetailPanel'
import { MapLineageLegend } from '../map/MapLineageLegend'
import { MapNarrativeCaption } from '../map/MapNarrativeCaption'
import { MapUnresolvedDisclosure } from '../map/MapUnresolvedDisclosure'

type MapViewProps = {
  active: boolean
}

const EVENT_TYPES = [
  { value: '', label: 'All events' },
  { value: 'birth', label: 'Births' },
  { value: 'death', label: 'Deaths' },
  { value: 'marriage', label: 'Marriages' },
  { value: 'move', label: 'Migrations' },
  { value: 'service', label: 'Service' },
]

function MapViewContent({ active }: MapViewProps) {
  const { familyEvents } = useTimeline()
  const { level, selection, resetExploration, refitFilteredView } = useMapExploration()
  const people = familyDatabase.people

  const [branch, setBranch] = useState('')
  const [eventType, setEventType] = useState('')
  const [century, setCentury] = useState('')
  const [directAncestorsOnly, setDirectAncestorsOnly] = useState(false)
  const [showRoutes, setShowRoutes] = useState(true)

  const allPlaces = useMemo(
    () => buildPlaceIndex(people, familyEvents, resolveExploreMapCoordinate),
    [people, familyEvents],
  )
  const allMigrations = useMemo(
    () => buildMigrationSegments(people, familyEvents, resolveExploreMapCoordinate),
    [people, familyEvents],
  )

  const filteredPlaces = useMemo(
    () =>
      filterPlaces(allPlaces, {
        ...DEFAULT_MAP_FILTERS,
        branch,
        eventType,
        century,
        directAncestorsOnly,
      }),
    [allPlaces, branch, eventType, century, directAncestorsOnly],
  )

  const regions = useMemo(() => buildFamilyRegions(filteredPlaces), [filteredPlaces])
  const subregions = useMemo(() => buildSubregions(filteredPlaces, regions), [filteredPlaces, regions])
  const unresolved = useMemo(() => filteredPlaces.filter((p) => !p.coordinate.resolved), [filteredPlaces])

  const migrations = useMemo(() => {
    const ids = new Set(filteredPlaces.flatMap((p) => p.people.map((x) => x.id)))
    return allMigrations.filter((m) => ids.has(m.personId))
  }, [filteredPlaces, allMigrations])

  const routes = useMemo(
    () => buildRegionalRoutes(migrations, regions, familyEvents),
    [migrations, regions, familyEvents],
  )

  const subroutes = useMemo(
    () => buildSubregionRoutes(migrations, subregions, familyEvents),
    [migrations, subregions, familyEvents],
  )

  const summary = useMemo(() => computeMapSummary(filteredPlaces, allMigrations), [filteredPlaces, allMigrations])
  const branches = useMemo(() => branchOptions(familyDatabase.stats.surnames), [])
  const centuries = useMemo(() => centuryOptions(people), [people])
  const lineagePalette = useMemo(
    () => buildLineagePalette(people, familyDatabase.root),
    [people],
  )

  const filterKey = `${branch}-${eventType}-${century}-${directAncestorsOnly}`
  const narrativeFilters = useMemo(
    () => ({ branch, eventType, century, directAncestorsOnly }),
    [branch, eventType, century, directAncestorsOnly],
  )

  useEffect(() => {
    if (!selection) return

    const isValid =
      selection.type === 'region'
        ? regions.some((region) => region.id === selection.region.id)
        : selection.type === 'subregion'
          ? subregions.some((sub) => sub.id === selection.subregion.id)
          : selection.type === 'place'
            ? filteredPlaces.some((place) => place.id === selection.place.id)
            : selection.type === 'route'
              ? routes.some((route) => route.id === selection.route.id)
              : subroutes.some((route) => route.id === selection.route.id)

    if (!isValid) {
      resetExploration()
      return
    }

    if (selection) {
      refitFilteredView()
    }
  }, [
    filterKey,
    selection,
    regions,
    subregions,
    filteredPlaces,
    routes,
    subroutes,
    resetExploration,
    refitFilteredView,
  ])

  return (
    <section id="map" className={`view atlas-page${active ? ' active' : ''}`} aria-hidden={!active}>
      <div className="map-wrap">
        <div className="map-page-atmosphere" aria-hidden="true" />
        <div className="map-page-focus" aria-hidden="true" />

        <div className="map-page-visual">
          <FamilyMap
            regions={regions}
            subregions={subregions}
            routes={routes}
            subroutes={subroutes}
            showRoutes={showRoutes}
            filterKey={filterKey}
            lineagePalette={lineagePalette}
            people={people}
          />

          <header className="map-page-intro map-title">
            <div className="eyebrow">Known places</div>
            <h2>A family in motion.</h2>
            <div className="map-summary">
              <span>
                <strong>{summary.placeCount}</strong> places
              </span>
              <span>
                <strong>{regions.length}</strong> regions
              </span>
              {summary.longestMove && (
                <span className="map-summary-move">
                  Longest move: {summary.longestMove.personName}
                </span>
              )}
            </div>
            <MapLineageLegend palette={lineagePalette} visible={showRoutes} />
          </header>

          <div className="map-page-controls map-filters">
            <div className="map-filter-grid">
              <label className="filter-field">
                <span>Branch</span>
                <select value={branch} onChange={(e) => setBranch(e.target.value)}>
                  <option value="">All</option>
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-field">
                <span>Event</span>
                <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
                  {EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-field">
                <span>Century</span>
                <select value={century} onChange={(e) => setCentury(e.target.value)}>
                  <option value="">All</option>
                  {centuries.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="map-filter-checks">
                <label className="filter-field filter-check">
                  <input
                    type="checkbox"
                    checked={directAncestorsOnly}
                    onChange={(e) => setDirectAncestorsOnly(e.target.checked)}
                  />
                  <span>Direct ancestors</span>
                </label>
                <label className="filter-field filter-check">
                  <input
                    type="checkbox"
                    checked={showRoutes}
                    onChange={(e) => setShowRoutes(e.target.checked)}
                  />
                  <span>Migration routes</span>
                </label>
              </div>
            </div>
            {unresolved.length > 0 && level === 'family' && !selection && (
              <MapUnresolvedDisclosure places={unresolved} variant="filters" />
            )}
          </div>

          <MapDetailPanel subregions={subregions} unresolved={unresolved} />

          <MapNarrativeCaption
            selection={selection}
            filters={narrativeFilters}
            summary={summary}
            regions={regions}
            places={filteredPlaces}
          />

          <div className="map-page-vignette" aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}

export function MapView({ active }: MapViewProps) {
  return (
    <MapExplorationProvider>
      <MapViewContent active={active} />
    </MapExplorationProvider>
  )
}
