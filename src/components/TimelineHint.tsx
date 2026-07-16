import { MoveHorizontal, MousePointer2, ZoomIn } from 'lucide-react'

export function TimelineHint() {
  return (
    <div className="hint" role="note" aria-label="Timeline interaction guide">
      <span className="hint-item" title="Scroll to zoom the timeline">
        <ZoomIn size={14} strokeWidth={1.6} aria-hidden="true" />
        <span>Scroll to zoom</span>
      </span>
      <span className="hint-sep" aria-hidden="true">
        |
      </span>
      <span className="hint-item" title="Drag to pan across centuries">
        <MoveHorizontal size={14} strokeWidth={1.6} aria-hidden="true" />
        <span>Drag to pan</span>
      </span>
      <span className="hint-sep" aria-hidden="true">
        |
      </span>
      <span className="hint-item" title="Click a marker to open the record">
        <MousePointer2 size={14} strokeWidth={1.6} aria-hidden="true" />
        <span className="hint-item-long">Click a marker to open the record</span>
        <span className="hint-item-short">Open a record</span>
      </span>
    </div>
  )
}
