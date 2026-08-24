import { useEffect } from 'react'

let lockCount = 0

function isPhoneViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches
}

function syncOverlayClass() {
  const root = document.documentElement
  if (lockCount > 0) {
    root.classList.add('phone-overlay-open')
  } else {
    root.classList.remove('phone-overlay-open')
  }
}

/** While a phone overlay is present, lock background chrome and scrolling. */
export function usePhoneOverlayLock(active: boolean) {
  useEffect(() => {
    if (!active || !isPhoneViewport()) return
    lockCount += 1
    syncOverlayClass()
    return () => {
      lockCount = Math.max(0, lockCount - 1)
      syncOverlayClass()
    }
  }, [active])
}
