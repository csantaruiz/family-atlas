import { useFollowPerson } from '../context/FollowPersonContext'

type PersonJourneyButtonProps = {
  personId: string
  className?: string
  onClick?: () => void
}

export function PersonJourneyButton({ personId, className = '', onClick }: PersonJourneyButtonProps) {
  const { startFollow, journeyForPerson, active: followActive } = useFollowPerson()
  const journey = journeyForPerson(personId)
  if (!journey?.eligible || followActive) return null

  const handleClick = () => {
    startFollow(personId)
    onClick?.()
  }

  return (
    <button
      type="button"
      className={`detail-portrait-upload-btn detail-follow-journey${className ? ` ${className}` : ''}`}
      onClick={handleClick}
    >
      {journey.ctaLabel} →
    </button>
  )
}
