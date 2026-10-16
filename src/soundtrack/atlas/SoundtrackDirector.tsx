import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAppNavigation } from '../../context/AppNavigationContext'
import { useFollowPerson } from '../../context/FollowPersonContext'
import { useMapExploration } from '../../context/MapExplorationContext'
import { useTimeline } from '../../context/TimelineContext'
import type { AppView } from '../../types/navigation'
import { useAmbientSoundtrack } from '../AmbientSoundtrackContext'
import {
  resolveSoundtrackContext,
  type SoundtrackFocus,
  type SoundtrackSignals,
  type SoundtrackSurface,
} from '../context/resolveSoundtrackContext'
import {
  ancestorFocus,
  familyEventFocus,
  historyFocus,
  insightFocus,
  journeyBeatFocus,
  mapSelectionFocus,
  summariseWindow,
} from './atlasFocus'

type MapSoundtrackState = { focus: SoundtrackFocus | null; moving: boolean }

const MapReporterContext = createContext<((state: MapSoundtrackState | null) => void) | null>(null)

const SURFACES: Record<AppView, SoundtrackSurface> = {
  journey: 'timeline',
  map: 'journeys',
  people: 'people',
  tree: 'tree',
  about: 'about',
}

/** Timeline windows are compared in whole steps so small drifts never count as a new context. */
const WINDOW_STEP_YEARS = 5
const COVERAGE_STEP = 0.05

function quantize(value: number, step: number): number {
  return Math.round(value / step) * step
}

/**
 * Reads Atlas navigation, timeline and selection state and reports a soundtrack context.
 * Renders its children untouched; wrap the Atlas views so the Journeys map can report too.
 *
 * Explicit detail panels / journey beats override the underlying timeline soundtrack while open.
 * Closing the last panel restores the underlying Atlas context (typically History Documentary).
 */
export function SoundtrackDirector({ children }: { children: ReactNode }) {
  const [mapState, setMapState] = useState<MapSoundtrackState | null>(null)
  const { reportContext } = useAmbientSoundtrack()
  const { activeView, focusedTreePersonId } = useAppNavigation()
  const { active: following, journey, beat } = useFollowPerson()
  const {
    center,
    span,
    fullSpan,
    minYear,
    presentYear,
    detail,
    peopleById,
    filteredFamilyEvents,
    isDragging,
    isZooming,
    isInertialScrolling,
  } = useTimeline()

  const unsettled = isDragging || isZooming || isInertialScrolling || Boolean(mapState?.moving)
  const surface = SURFACES[activeView]
  const windowStart = quantize(center - span / 2, WINDOW_STEP_YEARS)
  const windowEnd = quantize(center + span / 2, WINDOW_STEP_YEARS)
  const coverage = quantize(fullSpan > 0 ? span / fullSpan : 1, COVERAGE_STEP)
  /** Stable timeline center for ancestor year resolution (not zoom span). */
  const timelineYear = surface === 'timeline' ? quantize(center, 1) : null

  const focus = useMemo<SoundtrackFocus | null>(() => {
    if (following && journey && beat) return journeyBeatFocus(journey.personId, beat)
    if (detail?.type === 'person') {
      const person = peopleById[detail.personId]
      if (person) return ancestorFocus(person)
    }
    if (detail?.type === 'familyEvent') return familyEventFocus(detail.event)
    if (detail?.type === 'history') return historyFocus(detail.event)
    if (detail?.type === 'thinking') return insightFocus(detail.thinking, peopleById)
    if (surface === 'tree' && focusedTreePersonId) {
      const person = peopleById[focusedTreePersonId]
      if (person) return ancestorFocus(person)
    }
    if (surface === 'journeys') return mapState?.focus ?? null
    return null
  }, [beat, detail, focusedTreePersonId, following, journey, mapState?.focus, peopleById, surface])

  const windowSummary = useMemo(() => {
    if (surface !== 'timeline' || focus || unsettled) return null
    return summariseWindow(filteredFamilyEvents, windowStart, windowEnd)
  }, [filteredFamilyEvents, focus, surface, unsettled, windowEnd, windowStart])

  const soundtrackContext = useMemo(() => {
    const signals: SoundtrackSignals = {
      surface,
      presentYear,
      timelineYear,
      familyRange: { start: minYear, end: presentYear },
      window: surface === 'timeline' ? { start: windowStart, end: windowEnd, coverage } : null,
      migrationShare: windowSummary?.migrationShare ?? null,
      windowPlaces: windowSummary?.places ?? [],
      focus,
    }
    return resolveSoundtrackContext(signals)
  }, [
    coverage,
    focus,
    minYear,
    presentYear,
    surface,
    timelineYear,
    windowEnd,
    windowStart,
    windowSummary,
  ])

  const focusIdRef = useRef<string | null>(null)

  // Report even while muted so enable() starts on the context-appropriate track.
  useEffect(() => {
    const focusChanged = soundtrackContext.focusId !== focusIdRef.current
    focusIdRef.current = soundtrackContext.focusId
    reportContext(soundtrackContext, unsettled, {
      // Opening, switching, or closing a description panel must retarget immediately.
      immediate: focusChanged,
      crossfadeSec: soundtrackContext.overview && !soundtrackContext.explicit ? 1 : 0.6,
    })
  }, [reportContext, soundtrackContext, unsettled])

  return <MapReporterContext.Provider value={setMapState}>{children}</MapReporterContext.Provider>
}

/** Mount inside the Journeys map provider; reports the selected region or route while active. */
export function MapSoundtrackReporter({ active }: { active: boolean }) {
  const report = useContext(MapReporterContext)
  const { selection, isTransitioning } = useMapExploration()
  const focus = useMemo(() => mapSelectionFocus(selection), [selection])

  useEffect(() => {
    report?.(active ? { focus, moving: isTransitioning } : null)
  }, [active, focus, isTransitioning, report])

  useEffect(() => () => report?.(null), [report])
  return null
}
