import { createContext, useContext, type ReactNode } from 'react'
import { useJourneyIntroAnimation, type JourneyIntroControls } from '../hooks/useJourneyIntroAnimation'
import { useAppNavigation } from './AppNavigationContext'
import { useTimeline } from './TimelineContext'

const JourneyIntroContext = createContext<JourneyIntroControls | null>(null)

export function JourneyIntroProvider({ children }: { children: ReactNode }) {
  const { activeView } = useAppNavigation()
  const {
    center,
    span,
    fullSpan,
    minYear,
    maxYear,
    zoomValue,
    detail,
    timelineFilters,
    thinkingFocusRange,
    mapHighlightYears,
    isDragging,
    isZooming,
  } = useTimeline()

  const intro = useJourneyIntroAnimation({
    isJourneyActive: activeView === 'journey',
    center,
    span,
    fullSpan,
    minYear,
    maxYear,
    zoomValue,
    detail,
    timelineFilters,
    thinkingFocusRange,
    mapHighlightYears,
    isDragging,
    isZooming,
  })

  return <JourneyIntroContext.Provider value={intro}>{children}</JourneyIntroContext.Provider>
}

export function useJourneyIntro(): JourneyIntroControls {
  const ctx = useContext(JourneyIntroContext)
  if (!ctx) {
    return {
      shouldAnimateIntro: false,
      isIntroActive: false,
      introPhase: 'complete',
      introProgress: { card: 1, connector: 1, brace: 1, events: 1, junction: 1 },
      completeIntro: () => {},
      eventIntroDelayMs: () => 0,
      eventIntroDurationMs: 0,
    }
  }
  return ctx
}
