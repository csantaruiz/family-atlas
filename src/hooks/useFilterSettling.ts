import { useEffect, useState } from 'react'
import type { TimelineFilters } from '../types/timelineFilters'

export const FILTER_SETTLE_MS = 340

export function timelineFilterSignature(filters: TimelineFilters): string {
  return Object.keys(filters)
    .sort()
    .map((key) => (filters[key as keyof TimelineFilters] ? '1' : '0'))
    .join('')
}

/**
 * True for a short window after the applied filters change.
 * Set during render (not in an effect) so the commit that moves markers already
 * carries the settling class — otherwise positions would snap before easing starts.
 * Rapid toggles extend the window and always settle on the latest filter state.
 */
export function useFilterSettling(filters: TimelineFilters): boolean {
  const signature = timelineFilterSignature(filters)
  const [lastSignature, setLastSignature] = useState(signature)
  const [generation, setGeneration] = useState(0)
  const [settling, setSettling] = useState(false)

  if (lastSignature !== signature) {
    setLastSignature(signature)
    setGeneration((g) => g + 1)
    setSettling(true)
  }

  useEffect(() => {
    if (!settling) return
    const timer = window.setTimeout(() => setSettling(false), FILTER_SETTLE_MS + 60)
    return () => window.clearTimeout(timer)
  }, [settling, generation])

  return settling
}
