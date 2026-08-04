import { WorldMapBackground } from '../../../components/map/WorldMapBackground'
import { MAP_VIEW_BOX } from '../../../utils/mapProjection'
import { allCanonicalPlaces } from '../../data/canonicalPlaceRegistry'

/** Development-only — visually verify all canonical place coordinates. */
export function GeographicQaView() {
  const places = allCanonicalPlaces()

  return (
    <div className="de-geo-qa">
      <header className="de-geo-qa__header">
        <h1>Geographic QA — Canonical Places</h1>
        <p>{places.length} verified points on Natural Earth projection</p>
      </header>
      <div className="de-geo-qa__map">
        <svg
          viewBox={`0 0 ${MAP_VIEW_BOX.width} ${MAP_VIEW_BOX.height}`}
          preserveAspectRatio="xMidYMid slice"
        >
          <WorldMapBackground idPrefix="qa-" fadeIn={false} />
          {places.map((place) => (
            <g key={place.id} transform={`translate(${place.x} ${place.y})`}>
              <circle r={0.5} className="de-geo-qa__dot" />
              <text y={1.6} textAnchor="middle" className="de-geo-qa__label">
                {place.canonicalName}
              </text>
              <text y={2.6} textAnchor="middle" className="de-geo-qa__coords">
                {place.latitude.toFixed(2)}, {place.longitude.toFixed(2)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <ul className="de-geo-qa__list">
        {places.map((place) => (
          <li key={place.id}>
            <strong>{place.canonicalName}</strong> — {place.latitude}, {place.longitude} (
            {place.confidence})
          </li>
        ))}
      </ul>
    </div>
  )
}
