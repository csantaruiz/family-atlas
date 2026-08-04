import type { NarrativeStack } from '../../types/choreography'

type ScreenOverlayLayerProps = {
  narrative: NarrativeStack | null
  chapter?: string
}

export function ScreenOverlayLayer({ narrative, chapter }: ScreenOverlayLayerProps) {
  if (!narrative) return null

  return (
    <div className="de-screen-overlays" aria-live="polite">
      {chapter ? <p className="de-screen-chapter">{chapter}</p> : null}

      {narrative.eyebrow ? (
        <p className="de-narrative-eyebrow" style={{ opacity: narrative.eyebrow.opacity }}>
          {narrative.eyebrow.text}
        </p>
      ) : null}

      {narrative.primary ? (
        <h2 className="de-narrative-primary" style={{ opacity: narrative.primary.opacity }}>
          {narrative.primary.text}
        </h2>
      ) : null}

      {narrative.secondary ? (
        <p className="de-narrative-secondary" style={{ opacity: narrative.secondary.opacity }}>
          {narrative.secondary.text}
          {narrative.secondary.subtext ? (
            <span className="de-narrative-secondary__sub">{narrative.secondary.subtext}</span>
          ) : null}
        </p>
      ) : null}

      {narrative.tertiary ? (
        <p className="de-narrative-tertiary" style={{ opacity: narrative.tertiary.opacity }}>
          {narrative.tertiary.text}
        </p>
      ) : null}

      {narrative.insight ? (
        <p className="de-narrative-insight" style={{ opacity: narrative.insight.opacity }}>
          {narrative.insight.text}
        </p>
      ) : null}
    </div>
  )
}
