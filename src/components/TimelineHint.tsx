import { Hand, ZoomIn } from 'lucide-react'

export function TimelineHint() {
  return (
    <div className="hint" role="note" aria-label="Timeline interaction guide">
      <span className="hint-item" title="Pinch to zoom the timeline">
        <ZoomIn size={12} strokeWidth={1.6} aria-hidden="true" />
        <span>Pinch to zoom</span>
      </span>
      <span className="hint-sep" aria-hidden="true">
        |
      </span>
      <span className="hint-item" title="Drag to pan across centuries">
        <Hand size={12} strokeWidth={1.6} aria-hidden="true" />
        <span>Drag to pan</span>
      </span>
      <span className="hint-sep" aria-hidden="true">
        |
      </span>
      <span className="hint-item" title="Click markers to open records">
        <span className="hint-marker-diamond" aria-hidden="true" />
        <span className="hint-item-long">Click markers to open records</span>
        <span className="hint-item-short">Open records</span>
      </span>
    </div>
  )
}
