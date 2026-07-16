import type { PlaceRecord } from '../../utils/placeIndex'
import { useTimeline } from '../../context/TimelineContext'
import { useAppNavigation } from '../../context/AppNavigationContext'

type PlaceDetailPanelProps = {
  place: PlaceRecord | null
  onClose: () => void
}

export function PlaceDetailPanel({ place, onClose }: PlaceDetailPanelProps) {
  const { openPerson, openFamilyEvent } = useTimeline()
  const { viewOnTimeline } = useAppNavigation()

  if (!place) return null

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
    onClose()
  }

  return (
    <aside className="place-detail-panel open">
      <button type="button" className="place-detail-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="eyebrow">Place record</div>
      <h3>{place.name}</h3>
      {!place.coordinate.resolved && (
        <p className="place-unresolved">
          Coordinates not resolved — this place is listed but not placed on the map.
        </p>
      )}
      {place.coordinate.displayRegion && <p className="place-region">{place.coordinate.displayRegion}</p>}
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
          <label>Events</label>
          <span>{place.eventCount}</span>
        </div>
        <div>
          <label>Branches</label>
          <span>{place.branches.join(', ') || '—'}</span>
        </div>
      </div>

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

      {place.events.length > 0 && (
        <div className="place-detail-section">
          <div className="eyebrow">Connected events</div>
          <ul className="place-detail-list">
            {place.events.slice(0, 8).map((e, i) => (
              <li key={`${e.person.id}-${e.kind}-${e.year}-${i}`}>
                <button type="button" onClick={() => openFamilyEvent(e)}>
                  {e.year} · {e.title}
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
