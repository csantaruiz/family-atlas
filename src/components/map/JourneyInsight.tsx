import { useEffect, useMemo, useState } from 'react'
import {
  buildJourneyInsight,
  type JourneyInsightModel,
} from '../../utils/journeyInsight'
import type { MapNarrativeFilters } from '../../utils/mapNarrativeCaption'
import type { MapSelection } from '../../context/MapExplorationContext'
import type { FamilyRegion } from '../../utils/mapRegions'
import type { MapSummary, PlaceRecord } from '../../utils/placeIndex'

type JourneyInsightProps = {
  selection: MapSelection
  filters: MapNarrativeFilters
  summary: MapSummary
  regions: FamilyRegion[]
  places: PlaceRecord[]
  /** Desktop map rail vs future sheet/inline uses. */
  variant?: 'rail' | 'sheet'
  /** Reserved: parent can react when an insight is explored (map highlight, etc.). */
  onExploreInsight?: (insight: JourneyInsightModel) => void
}

const CROSSFADE_MS = 280

/**
 * Journey storytelling surface — collapsed editorial caption today;
 * expandable shell for a future AI Historian / evidence panel.
 */
export function JourneyInsight({
  selection,
  filters,
  summary,
  regions,
  places,
  variant = 'rail',
  onExploreInsight,
}: JourneyInsightProps) {
  const next = useMemo(
    () =>
      buildJourneyInsight({
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
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (next.key === current.key) {
      if (
        next.teaser !== current.teaser ||
        next.body !== current.body ||
        next.headline !== current.headline ||
        next.eraLabel !== current.eraLabel
      ) {
        setCurrent(next)
      }
      return
    }

    setExpanded(false)
    setPhase('out')
    const swap = window.setTimeout(() => {
      setCurrent(next)
      setPhase('in')
    }, CROSSFADE_MS)

    return () => window.clearTimeout(swap)
  }, [next, current.key, current.teaser, current.body, current.headline, current.eraLabel])

  const fading = phase === 'out'

  return (
    <aside
      className={`journey-insight journey-insight--${variant}${expanded ? ' is-expanded' : ''}${fading ? ' is-fading' : ''}`}
      aria-live="polite"
    >
      <div className="journey-insight-inner" key={current.key}>
        {current.eraLabel ? (
          <div className="journey-insight-era">{current.eraLabel}</div>
        ) : null}
        <h3 className="journey-insight-headline">{current.headline}</h3>
        <p className="journey-insight-teaser">{current.teaser}</p>

        {expanded ? (
          <div className="journey-insight-expanded">
            <p className="journey-insight-body">{current.body}</p>
          </div>
        ) : null}

        <button
          type="button"
          className="journey-insight-action"
          aria-expanded={expanded}
          onClick={() => {
            const nextExpanded = !expanded
            setExpanded(nextExpanded)
            if (nextExpanded) onExploreInsight?.(current)
          }}
        >
          {expanded ? 'Close insight' : 'Explore insight'}
        </button>
      </div>
    </aside>
  )
}
