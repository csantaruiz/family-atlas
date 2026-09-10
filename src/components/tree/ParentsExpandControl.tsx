type ParentsExpandControlProps = {
  deeperCount: number
  onExpand: () => void
}

/** Compact pill anchored to a person card — not a genealogy layout node. */
export function ParentsExpandControl({ deeperCount, onExpand }: ParentsExpandControlProps) {
  return (
    <button
      type="button"
      className="tree-parents-control"
      onClick={(event) => {
        event.stopPropagation()
        onExpand()
      }}
      aria-label={
        deeperCount > 0
          ? `Show parents. ${deeperCount} earlier ancestors available.`
          : 'Show parents'
      }
    >
      <span className="tree-parents-control-main">+ Parents</span>
      {deeperCount > 0 ? (
        <span className="tree-parents-control-meta" aria-hidden="true">
          {deeperCount} more
        </span>
      ) : null}
    </button>
  )
}
