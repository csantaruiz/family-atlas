import type { MapSubregion } from '../../utils/mapSubregions'
import type { FamilyRegion } from '../../utils/mapRegions'
import type { PlaceRecord } from '../../utils/placeIndex'
import { getMapClusterPresentation } from '../../utils/mapClusterTitles'
import { useMapExploration } from '../../context/MapExplorationContext'
import { useTimeline } from '../../context/TimelineContext'
import { useAppNavigation } from '../../context/AppNavigationContext'

export function MapDetailPanel({ subregions = [] }: { subregions?: MapSubregion[] }) {
  const { selection, level, clearSelection } = useMapExploration()
  const { openPerson, openFamilyEvent } = useTimeline()
  const { viewOnTimeline } = useAppNavigation()

  if (!selection) return null

  const handleClose = () => clearSelection()

  if (selection.type === 'route' || selection.type === 'subroute') {
    const route = selection.route
    const yearLabel =
      route.yearMin != null && route.yearMax != null
        ? route.yearMin === route.yearMax
          ? String(route.yearMin)
          : `${route.yearMin}–${route.yearMax}`
        : 'Year range uncertain'

    const handleViewTimeline = () => {
      const p = route.people[0]
      if (p && route.yearMin != null && route.yearMax != null) {
        viewOnTimeline(p.id, { start: route.yearMin, end: route.yearMax })
      } else if (p) {
        viewOnTimeline(p.id)
      }
      handleClose()
    }

    return (
      <aside className="place-detail-panel open map-detail-panel">
        <button type="button" className="place-detail-close" onClick={handleClose} aria-label="Close">
          ×
        </button>
        <div className="eyebrow">Migration corridor</div>
        <h3>
          {route.fromName} → {route.toName}
        </h3>
        <p className="place-region">
          {route.moveCount} documented migration{route.moveCount === 1 ? '' : 's'}
          {route.confidence === 'documented' ? ' · verified moves' : ' · inferred routes'}
        </p>
        <div className="place-detail-stats">
          <div>
            <label>Year range</label>
            <span>{yearLabel}</span>
          </div>
          <div>
            <label>People</label>
            <span>{route.people.length}</span>
          </div>
          <div>
            <label>Moves</label>
            <span>{route.moveCount}</span>
          </div>
          <div>
            <label>Confidence</label>
            <span>{route.confidence}</span>
          </div>
        </div>
        <div className="place-detail-section">
          <div className="eyebrow">Travelers on this corridor</div>
          <ul className="place-detail-list">
            {route.people.slice(0, 12).map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => openPerson(p.id)}>
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="place-detail-actions">
          <button type="button" className="pill" onClick={handleViewTimeline}>
            View on timeline
          </button>
        </div>
      </aside>
    )
  }

  if (selection.type === 'subregion') {
    const sub = selection.subregion
    const yearLabel =
      sub.yearMin != null && sub.yearMax != null
        ? sub.yearMin === sub.yearMax
          ? String(sub.yearMin)
          : `${sub.yearMin}–${sub.yearMax}`
        : 'Year range uncertain'

    return (
      <aside className="place-detail-panel open map-detail-panel">
        <button type="button" className="place-detail-close" onClick={handleClose} aria-label="Close">
          ×
        </button>
        <div className="eyebrow">Regional chapter</div>
        <h3>{sub.chapterTitle}</h3>
        <p className="place-region">{sub.name}</p>
        <div className="place-detail-stats">
          <div>
            <label>Year range</label>
            <span>{yearLabel}</span>
          </div>
          <div>
            <label>Places</label>
            <span>{sub.placeCount}</span>
          </div>
          <div>
            <label>People</label>
            <span>{sub.peopleCount}</span>
          </div>
        </div>
        <div className="place-detail-section">
          <div className="eyebrow">Cities and towns</div>
          <ul className="place-detail-list">
            {sub.places.slice(0, 14).map((pl) => (
              <li key={pl.id}>
                <span>
                  {pl.name.split(',')[0]}
                  {pl.people.length ? ` · ${pl.people.length} people` : ''}
                </span>
              </li>
            ))}
            {sub.places.length > 14 && (
              <li className="muted">+{sub.places.length - 14} more places</li>
            )}
          </ul>
        </div>
      </aside>
    )
  }

  const place: PlaceRecord =
    selection.type === 'region' ? regionToPlaceRecord(selection.region) : selection.place

  const parentSub =
    selection.type === 'place'
      ? subregions.find((s) => s.places.some((p) => p.id === selection.place.id))
      : null

  const placeChapterTitle =
    selection.type === 'place'
      ? getMapClusterPresentation({
          places: [selection.place],
          depth: level === 'record' ? 'detail' : 'place',
          yearMin: selection.place.yearMin,
          yearMax: selection.place.yearMax,
          parentTitle: parentSub?.chapterTitle,
          regionId: parentSub?.parentRegionId,
          subregionKey: parentSub?.geoKey,
        }).title
      : null

  const yearLabel =
    place.yearMin != null && place.yearMax != null
      ? place.yearMin === place.yearMax
        ? String(place.yearMin)
        : `${place.yearMin}–${place.yearMax}`
      : 'Year range uncertain'

  const handleViewTimeline = () => {
    const p = place.people[0]
    if (p) {
      const range =
        place.yearMin != null && place.yearMax != null
          ? { start: place.yearMin, end: place.yearMax }
          : undefined
      viewOnTimeline(p.id, range)
    }
    handleClose()
  }

  const panelEyebrow =
    selection.type === 'region'
      ? level === 'family'
        ? 'Family region'
        : 'Regional summary'
      : level === 'record'
        ? 'Individual records'
        : 'Place record'

  return (
    <aside className="place-detail-panel open map-detail-panel">
      <button type="button" className="place-detail-close" onClick={handleClose} aria-label="Close">
        ×
      </button>
      <div className="eyebrow">{panelEyebrow}</div>
      <h3>
        {selection.type === 'region'
          ? selection.region.chapterTitle
          : selection.type === 'place'
            ? placeChapterTitle ?? place.name
            : place.name}
      </h3>
      {selection.type === 'region' && (
        <p className="place-region">{selection.region.name}</p>
      )}
      {selection.type === 'place' && !place.coordinate.resolved && (
        <p className="place-unresolved">Coordinates not resolved for this place.</p>
      )}
      {selection.type === 'place' && place.coordinate.displayRegion && (
        <p className="place-region">{place.coordinate.displayRegion}</p>
      )}
      <div className="place-detail-stats">
        <div>
          <label>Year range</label>
          <span>{yearLabel}</span>
        </div>
        <div>
          <label>People</label>
          <span>{place.people.length}</span>
        </div>
        <div>
          <label>{selection.type === 'region' ? 'Places' : 'Events'}</label>
          <span>{selection.type === 'region' ? selection.region.placeCount : place.eventCount}</span>
        </div>
        <div>
          <label>Branches</label>
          <span>{place.branches.join(', ') || '—'}</span>
        </div>
      </div>

      {selection.type === 'region' && level !== 'record' && (
        <div className="place-detail-section">
          <div className="eyebrow">Regional chapters</div>
          <ul className="place-detail-list">
            {selection.region.places.slice(0, 8).map((pl) => (
              <li key={pl.id}>
                <span>
                  {pl.name.split(',')[0]}
                  {pl.people.length ? ` · ${pl.people.length} people` : ''}
                </span>
              </li>
            ))}
            {selection.region.places.length > 8 && (
              <li className="muted">+{selection.region.places.length - 8} more places</li>
            )}
          </ul>
        </div>
      )}

      {(level === 'local' || level === 'place' || level === 'record') && (
        <div className="place-detail-section">
          <div className="eyebrow">Connected people</div>
          <ul className="place-detail-list">
            {place.people.slice(0, 12).map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => openPerson(p.id)}>
                  {p.name}
                  {p.birthYear ? ` · ${p.birthYear}` : ''}
                </button>
              </li>
            ))}
            {place.people.length > 12 && <li className="muted">+{place.people.length - 12} more</li>}
          </ul>
        </div>
      )}

      {level === 'record' && place.events.length > 0 && (
        <div className="place-detail-section">
          <div className="eyebrow">Individual events</div>
          <ul className="place-detail-list">
            {place.events.slice(0, 12).map((e, i) => (
              <li key={`${e.person.id}-${e.kind}-${e.year}-${i}`}>
                <button type="button" onClick={() => openFamilyEvent(e)}>
                  {e.year} · {e.kind === 'birth' ? 'Birth' : e.kind === 'death' ? 'Death' : e.kind === 'move' ? 'Migration' : 'Service'} · {e.person.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="place-detail-actions">
        <button type="button" className="pill" onClick={handleViewTimeline}>
          View on timeline
        </button>
      </div>
    </aside>
  )
}

function regionToPlaceRecord(region: FamilyRegion): PlaceRecord {
  const peopleMap = new Map<string, PlaceRecord['people'][0]>()
  const events: PlaceRecord['events'] = []
  const branches = new Set<string>()

  for (const pl of region.places) {
    pl.people.forEach((p) => peopleMap.set(p.id, p))
    events.push(...pl.events)
    pl.branches.forEach((b) => branches.add(b))
  }

  return {
    id: region.id,
    name: region.name,
    coordinate: {
      x: region.ellipse.cx,
      y: region.ellipse.cy,
      resolved: true,
      region: region.name,
      displayRegion: region.name,
    },
    people: [...peopleMap.values()],
    events,
    branches: [...branches],
    yearMin: region.yearMin,
    yearMax: region.yearMax,
    eventCount: events.length,
  }
}
