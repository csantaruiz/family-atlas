import { lazy, Suspense, useEffect, useState } from 'react'

const WorldMapBackdropInner = lazy(() =>
  import('./AtlasMapBackdropInner').then((m) => ({ default: m.AtlasMapBackdropInner })),
)

/** Lightweight shell — heavy world-map SVG loads after first paint. */
export function AtlasMapBackdrop() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className="app-map-backdrop" aria-hidden="true">
      {ready ? (
        <Suspense fallback={<div className="app-map-backdrop--placeholder" />}>
          <WorldMapBackdropInner />
        </Suspense>
      ) : (
        <div className="app-map-backdrop--placeholder" />
      )}
    </div>
  )
}
