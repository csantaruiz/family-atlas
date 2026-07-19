import type { PlaceRecord } from '../../utils/placeIndex'

type MapUnresolvedDisclosureProps = {
  places: PlaceRecord[]
  variant: 'filters' | 'inspector'
}

export function MapUnresolvedDisclosure({ places, variant }: MapUnresolvedDisclosureProps) {
  if (places.length === 0) return null

  const label = `${places.length} unresolved location${places.length === 1 ? '' : 's'}`

  return (
    <details className={`map-unresolved-disclosure map-unresolved-disclosure--${variant}`}>
      <summary>{label}</summary>
      <p className="map-unresolved-disclosure-copy">
        {places.length} record{places.length === 1 ? '' : 's'} lack coordinates and are not mapped.
      </p>
    </details>
  )
}
