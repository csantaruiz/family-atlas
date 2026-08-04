import type { TextOverlay } from '../../types/manifest'
import { overlayOpacity } from '../../utils/textOverlays'

type DocumentaryTextOverlaysProps = {
  overlays?: TextOverlay[]
  progress: number
}

export function DocumentaryTextOverlays({ overlays, progress }: DocumentaryTextOverlaysProps) {
  if (!overlays?.length) return null

  const visible = overlays
    .map((overlay) => ({ overlay, opacity: overlayOpacity(progress, overlay) }))
    .filter(({ opacity }) => opacity > 0.02)

  if (!visible.length) return null

  const primary = visible.find(({ overlay }) => overlay.kind === 'year' || overlay.kind === 'place') ?? visible[0]
  const secondary = visible.filter(({ overlay }) => overlay !== primary.overlay)

  return (
    <div className="de-text-overlays" aria-live="polite">
      <div
        className={`de-text-overlay de-text-overlay--${primary.overlay.kind}`}
        style={{ opacity: primary.opacity }}
      >
        <p className="de-text-overlay__primary">{primary.overlay.text}</p>
        {primary.overlay.subtext ? (
          <p className="de-text-overlay__subtext">{primary.overlay.subtext}</p>
        ) : null}
      </div>

      {secondary.map(({ overlay, opacity }) => (
        <div
          key={`${overlay.kind}-${overlay.text}`}
          className={`de-text-overlay de-text-overlay--${overlay.kind} de-text-overlay--secondary`}
          style={{ opacity }}
        >
          <p className="de-text-overlay__primary">{overlay.text}</p>
          {overlay.subtext ? <p className="de-text-overlay__subtext">{overlay.subtext}</p> : null}
        </div>
      ))}
    </div>
  )
}
