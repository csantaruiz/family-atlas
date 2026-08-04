type TimeIndicatorProps = {
  earliestYear?: number
}

export function TimeIndicator({ earliestYear = 1473 }: TimeIndicatorProps) {
  return (
    <p className="dv3-time-indicator" aria-label={`Historical span from ${earliestYear} to present`}>
      {earliestYear} — Present
    </p>
  )
}
