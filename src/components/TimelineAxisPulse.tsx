import { useTimelinePulse } from '../context/TimelinePulseContext'
import { timelineAxisY } from '../utils/chapterCalloutLayout'

type TimelineAxisPulseProps = {
  width: number
  height: number
}

export function TimelineAxisPulse({ width, height }: TimelineAxisPulseProps) {
  const { pulse } = useTimelinePulse()

  if (width <= 0 || height <= 0) return null

  const axisY = timelineAxisY(height)
  const rings: { key: string; x: number; delay: number }[] = []

  if (pulse.historyKey && pulse.pulseX != null) {
    rings.push({ key: `history-${pulse.historyKey}`, x: pulse.pulseX, delay: 0 })
  }

  for (const eventId of pulse.familyEventIds) {
    const x = pulse.familyPulseX[eventId]
    if (x == null) continue
    rings.push({
      key: `family-${eventId}`,
      x,
      delay: pulse.familyDelays[eventId] ?? 0,
    })
  }

  if (!rings.length) return null

  return (
    <>
      {rings.map(({ key, x, delay }) => (
        <div
          key={key}
          className="timeline-axis-pulse"
          style={{
            left: Math.round(x),
            top: axisY,
            animationDelay: `${delay}ms`,
          }}
          aria-hidden="true"
        />
      ))}
    </>
  )
}
