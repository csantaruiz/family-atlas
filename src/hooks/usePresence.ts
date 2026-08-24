import { useEffect, useState } from 'react'

const OVERLAY_MS = 220

/** Keep a surface mounted until its close animation finishes. */
export function usePresence(open: boolean, durationMs = OVERLAY_MS) {
  const [present, setPresent] = useState(open)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (open) {
      setPresent(true)
      const timer = window.setTimeout(() => setShown(true), 16)
      return () => window.clearTimeout(timer)
    }
    setShown(false)
    const timer = window.setTimeout(() => setPresent(false), durationMs)
    return () => window.clearTimeout(timer)
  }, [open, durationMs])

  return { present, shown }
}

export const PHONE_OVERLAY_MS = OVERLAY_MS
