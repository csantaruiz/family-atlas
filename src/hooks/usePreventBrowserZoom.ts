import { useEffect } from 'react'

/** Block browser page zoom from trackpad pinch (ctrl+wheel) and iOS gesture zoom. */
export function usePreventBrowserZoom() {
  useEffect(() => {
    const preventWheelZoom = (event: WheelEvent) => {
      if (event.ctrlKey) event.preventDefault()
    }

    const preventGesture = (event: Event) => {
      event.preventDefault()
    }

    document.addEventListener('wheel', preventWheelZoom, { passive: false })
    document.addEventListener('gesturestart', preventGesture, { passive: false })
    document.addEventListener('gesturechange', preventGesture, { passive: false })
    document.addEventListener('gestureend', preventGesture, { passive: false })

    return () => {
      document.removeEventListener('wheel', preventWheelZoom)
      document.removeEventListener('gesturestart', preventGesture)
      document.removeEventListener('gesturechange', preventGesture)
      document.removeEventListener('gestureend', preventGesture)
    }
  }, [])
}
