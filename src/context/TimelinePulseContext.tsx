import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useReducedMotion } from 'framer-motion'
import { useJourneyIntro } from './JourneyIntroContext'
import { useTimeline } from './TimelineContext'
import {
  AMBIENT_FAMILY_RESPONSE_BASE_MS,
  AMBIENT_FAMILY_STAGGER_MS,
  ambientPulseClearDelayMs,
  ambientPulseIntervalMs,
  ambientYearProximityWindow,
  findRespondingFamilyTargets,
  pickWeightedHistoryTarget,
  type PulseTarget,
} from '../utils/timelineAmbientPulse'

export type TimelinePulseState = {
  historyKey: string | null
  pulseX: number | null
  familyEventIds: string[]
  familyDelays: Record<string, number>
  familyPulseX: Record<string, number>
}

const idlePulse: TimelinePulseState = {
  historyKey: null,
  pulseX: null,
  familyEventIds: [],
  familyDelays: {},
  familyPulseX: {},
}

type TimelinePulseContextValue = {
  pulse: TimelinePulseState
  registerHistoryPulseTargets: (targets: PulseTarget[]) => void
  registerFamilyPulseTargets: (targets: PulseTarget[]) => void
}

const TimelinePulseContext = createContext<TimelinePulseContextValue | null>(null)

type TimelinePulseProviderProps = {
  active: boolean
  children: ReactNode
}

export function TimelinePulseProvider({ active, children }: TimelinePulseProviderProps) {
  const {
    center,
    span,
    detail,
    timelineFilters,
    isDragging,
    isZooming,
    isInertialScrolling,
  } = useTimeline()
  const { isIntroActive } = useJourneyIntro()
  const prefersReducedMotion = useReducedMotion()

  const [pulse, setPulse] = useState<TimelinePulseState>(idlePulse)

  const historyTargetsRef = useRef<PulseTarget[]>([])
  const familyTargetsRef = useRef<PulseTarget[]>([])
  const centerRef = useRef(center)
  const spanRef = useRef(span)

  centerRef.current = center
  spanRef.current = span

  const enabled =
    active &&
    !prefersReducedMotion &&
    !isDragging &&
    !isZooming &&
    !isInertialScrolling &&
    !isIntroActive &&
    !detail &&
    timelineFilters.historicalEvents

  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const registerHistoryPulseTargets = (targets: PulseTarget[]) => {
    historyTargetsRef.current = targets
  }

  const registerFamilyPulseTargets = (targets: PulseTarget[]) => {
    familyTargetsRef.current = targets
  }

  useEffect(() => {
    if (!enabled) {
      setPulse(idlePulse)
      return
    }

    let cancelled = false
    let waitTimeoutId = 0
    let clearTimeoutId = 0

    const scheduleNext = () => {
      if (cancelled) return
      waitTimeoutId = window.setTimeout(runPulse, ambientPulseIntervalMs())
    }

    const runPulse = () => {
      if (cancelled || !enabledRef.current) {
        scheduleNext()
        return
      }

      const historyTarget = pickWeightedHistoryTarget(
        historyTargetsRef.current,
        centerRef.current,
      )

      if (!historyTarget) {
        scheduleNext()
        return
      }

      const responders = findRespondingFamilyTargets(
        familyTargetsRef.current,
        historyTarget.year,
        ambientYearProximityWindow(spanRef.current),
        5,
      )

      const familyDelays: Record<string, number> = {}
      const familyPulseX: Record<string, number> = {}
      responders.forEach((target, index) => {
        familyDelays[target.key] =
          AMBIENT_FAMILY_RESPONSE_BASE_MS + index * AMBIENT_FAMILY_STAGGER_MS
        familyPulseX[target.key] = target.x
      })

      setPulse({
        historyKey: historyTarget.key,
        pulseX: historyTarget.x,
        familyEventIds: responders.map((target) => target.key),
        familyDelays,
        familyPulseX,
      })

      clearTimeoutId = window.setTimeout(() => {
        if (!cancelled) setPulse(idlePulse)
        scheduleNext()
      }, ambientPulseClearDelayMs(responders.length))
    }

    scheduleNext()

    return () => {
      cancelled = true
      window.clearTimeout(waitTimeoutId)
      window.clearTimeout(clearTimeoutId)
      setPulse(idlePulse)
    }
  }, [enabled])

  return (
    <TimelinePulseContext.Provider
      value={{ pulse, registerHistoryPulseTargets, registerFamilyPulseTargets }}
    >
      {children}
    </TimelinePulseContext.Provider>
  )
}

export function useTimelinePulse(): TimelinePulseContextValue {
  const ctx = useContext(TimelinePulseContext)
  if (!ctx) {
    throw new Error('useTimelinePulse must be used within TimelinePulseProvider')
  }
  return ctx
}
