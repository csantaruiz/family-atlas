import { MoveHorizontal, ZoomIn } from 'lucide-react'

type TreePanHintProps = {
  visible: boolean
}

export function TreePanHint({ visible }: TreePanHintProps) {
  if (!visible) return null

  return (
    <div className="tree-pan-hint" role="note" aria-label="Tree navigation guide">
      <span className="tree-pan-hint-item">
        <MoveHorizontal size={14} strokeWidth={1.6} aria-hidden="true" />
        <span>Drag to pan</span>
      </span>
      <span className="tree-pan-hint-sep" aria-hidden="true">
        ·
      </span>
      <span className="tree-pan-hint-item">
        <ZoomIn size={14} strokeWidth={1.6} aria-hidden="true" />
        <span>Pinch or scroll to zoom</span>
      </span>
    </div>
  )
}
