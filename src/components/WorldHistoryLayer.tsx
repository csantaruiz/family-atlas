import type { PlaceholderMarker } from '../data/placeholderMarkers'

type WorldHistoryLayerProps = {
  markers: PlaceholderMarker[]
}

export function WorldHistoryLayer({ markers }: WorldHistoryLayerProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[0.6875rem] tracking-[0.1em] text-atlas-teal-soft uppercase">
        The World Around Them
      </p>
      <div aria-label="World history events" className="relative h-24 md:h-28">
        {markers.map((marker) => (
          <div
            key={marker.id}
            className="marker-world absolute top-0 flex -translate-x-1/2 flex-col items-center gap-1.5"
            style={{ left: `${marker.position}%` }}
          >
            <div className="marker-world__dot" />
            <span className="max-w-[5.5rem] text-center text-[0.625rem] leading-tight text-atlas-teal md:text-xs">
              {marker.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
