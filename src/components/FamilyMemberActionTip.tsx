import { useFollowPerson } from '../context/FollowPersonContext'

type FamilyMemberActionTipProps = {
  personId: string
  onExplore: (personId: string) => void
  onViewTree: (personId: string) => void
  className?: string
}

function ActionLink({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="family-event-action-link"
      onPointerDown={(ev) => ev.stopPropagation()}
      onClick={(ev) => {
        ev.stopPropagation()
        onClick()
      }}
    >
      <span className="family-event-action-link-text">{label}</span>
      <span className="family-event-action-link-arrow" aria-hidden="true">
        →
      </span>
    </button>
  )
}

export function FamilyMemberActionTip({
  personId,
  onExplore,
  onViewTree,
  className = '',
}: FamilyMemberActionTipProps) {
  const { startFollow, journeyForPerson, active: followActive } = useFollowPerson()
  const journey = journeyForPerson(personId)
  const showJourney = Boolean(journey?.eligible) && !followActive

  return (
    <span
      className={`family-event-action-tip${showJourney ? ' family-event-action-tip--with-journey' : ''}${className ? ` ${className}` : ''}`}
      role="group"
      aria-label="Family member actions"
    >
      <ActionLink label="Explore family member" onClick={() => onExplore(personId)} />
      <ActionLink label="View on family tree" onClick={() => onViewTree(personId)} />
      {showJourney && journey ? (
        <ActionLink label={journey.ctaLabel} onClick={() => startFollow(personId)} />
      ) : null}
    </span>
  )
}
