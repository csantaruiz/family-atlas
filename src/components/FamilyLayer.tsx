import type { PlaceholderMarker } from '../data/placeholderMarkers'

type FamilyLayerProps = {
  markers: PlaceholderMarker[]
}

export function FamilyLayer({ markers }: FamilyLayerProps) {
  return (
    <div aria-label="Family events" className="relative h-28 md:h-32">
      {markers.map((marker) => (
        <div
          key={marker.id}
          className="marker-family absolute bottom-0 flex -translate-x-1/2 flex-col items-center gap-1.5"
          style={{ left: `${marker.position}%` }}
        >
          <span
            className={`max-w-[5.5rem] text-center leading-tight ${
              marker.variant === 'minimal'
                ? 'text-[0.625rem] text-atlas-gold-dim'
                : 'text-xs text-atlas-gold-soft'
            }`}
          >
            {marker.label}
          </span>
          <div className="marker-family__dot" />
        </div>
      ))}
    </div>
  )
}
