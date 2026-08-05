import { useEffect, useMemo, useState } from 'react'
import {
  buildMapNarrativeCaption,
  type MapNarrativeFilters,
} from '../../utils/mapNarrativeCaption'
import type { MapSelection } from '../../context/MapExplorationContext'
import type { FamilyRegion } from '../../utils/mapRegions'
import type { MapSummary, PlaceRecord } from '../../utils/placeIndex'

type MapNarrativeCaptionProps = {
  selection: MapSelection
  filters: MapNarrativeFilters
  summary: MapSummary
  regions: FamilyRegion[]
  places: PlaceRecord[]
}

const CROSSFADE_MS = 280

export function MapNarrativeCaption({
  selection,
  filters,
  summary,
  regions,
  places,
}: MapNarrativeCaptionProps) {
  const next = useMemo(
    () =>
      buildMapNarrativeCaption({
        selection,
        filters,
        summary,
        regions,
        places,
      }),
    [selection, filters, summary, regions, places],
  )

  const [current, setCurrent] = useState(next)
  const [phase, setPhase] = useState<'in' | 'out'>('in')

  useEffect(() => {
    if (next.key === current.key) {
      if (next.text !== current.text) setCurrent(next)
      return
    }

    setPhase('out')
    const swap = window.setTimeout(() => {
      setCurrent(next)
      setPhase('in')
    }, CROSSFADE_MS)

    return () => window.clearTimeout(swap)
  }, [next, current.key, current.text])

  return (
    <div className="map-narrative-caption" aria-live="polite">
      <p
        className={`map-narrative-caption-text${phase === 'out' ? ' is-fading' : ''}`}
        key={current.key}
      >
        {current.text}
      </p>
    </div>
  )
}
