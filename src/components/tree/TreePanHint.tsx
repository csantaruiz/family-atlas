import { MoveHorizontal, MousePointer2 } from 'lucide-react'

type TreePanHintProps = {
  visible: boolean
}

export function TreePanHint({ visible }: TreePanHintProps) {
  if (!visible) return null

  return (
    <div className="tree-pan-hint" role="note" aria-label="Tree navigation guide">
      <span className="tree-pan-hint-item">
        <MoveHorizontal size={14} strokeWidth={1.6} aria-hidden="true" />
        <span>Drag or scroll to explore</span>
      </span>
      <span className="tree-pan-hint-sep" aria-hidden="true">
        |
      </span>
      <span className="tree-pan-hint-item">
        <MousePointer2 size={14} strokeWidth={1.6} aria-hidden="true" />
        <span>Names fade in as you pan</span>
      </span>
    </div>
  )
}
