type FamilyMemberActionTipProps = {
  personId: string
  onExplore: (personId: string) => void
  onViewTree: (personId: string) => void
  className?: string
}

export function FamilyMemberActionTip({
  personId,
  onExplore,
  onViewTree,
  className = '',
}: FamilyMemberActionTipProps) {
  return (
    <span
      className={`family-event-action-tip${className ? ` ${className}` : ''}`}
      role="group"
      aria-label="Family member actions"
    >
      <button
        type="button"
        className="family-event-action-link family-event-action-link--primary"
        onPointerDown={(ev) => ev.stopPropagation()}
        onClick={(ev) => {
          ev.stopPropagation()
          onExplore(personId)
        }}
      >
        Explore family member
      </button>
      <button
        type="button"
        className="family-event-action-link"
        onPointerDown={(ev) => ev.stopPropagation()}
        onClick={(ev) => {
          ev.stopPropagation()
          onViewTree(personId)
        }}
      >
        View on family tree
      </button>
    </span>
  )
}
