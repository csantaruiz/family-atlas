import { placeholderMarkers } from '../data/placeholderMarkers'
import { FamilyLayer } from './FamilyLayer'
import { WorldHistoryLayer } from './WorldHistoryLayer'

const AXIS_TICKS = ['1800', '1850', '1900', '1950', '2000']

export function TimelineViewport() {
  const familyMarkers = placeholderMarkers.filter((m) => m.layer === 'family')
  const worldMarkers = placeholderMarkers.filter((m) => m.layer === 'world')

  return (
    <section
      aria-label="Timeline viewport"
      className="w-full px-4 md:px-8 lg:px-12"
    >
      <div className="mx-auto w-full max-w-5xl">
        <FamilyLayer markers={familyMarkers} />

        <div className="relative my-6 md:my-8">
          <div className="timeline-axis" aria-hidden="true">
            {AXIS_TICKS.map((label, index) => {
              const position = (index / (AXIS_TICKS.length - 1)) * 100
              return (
                <div key={label}>
                  <div className="timeline-tick" style={{ left: `${position}%` }} />
                  <span className="timeline-tick-label" style={{ left: `${position}%` }}>
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <WorldHistoryLayer markers={worldMarkers} />
      </div>
    </section>
  )
}
