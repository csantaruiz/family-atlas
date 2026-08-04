import { familyDatabase } from '../../../data/familyDatabase'
import type { SceneManifestEntry } from '../../types/manifest'

type TimelineOrientationSceneProps = {
  scene: SceneManifestEntry
  progress: number
}

/** Screen-space timeline band — map continues underneath via PersistentMapStage. */
export function TimelineOrientationScene({ scene, progress }: TimelineOrientationSceneProps) {
  const { earliestYear, latestYear } = familyDatabase.stats
  const window = scene.timelineWindow ?? { start: earliestYear, end: earliestYear + 120 }
  const span = latestYear - earliestYear
  const left = ((window.start - earliestYear) / span) * 100
  const width = ((window.end - window.start) / span) * 100
  const reveal = Math.min(1, progress / 0.35)

  return (
    <div className="de-timeline-band" style={{ opacity: reveal }}>
      <p className="de-timeline-band__eyebrow">Timeline</p>
      <div className="de-timeline-band__range">
        <span>{earliestYear}</span>
        <span>Present</span>
      </div>
      <div className="de-timeline-band__track">
        <div className="de-timeline-band__axis" />
        <div
          className="de-timeline-band__highlight"
          style={{ left: `${left}%`, width: `${Math.max(4, width)}%` }}
        />
      </div>
      {window.label ? <p className="de-timeline-band__label">{window.label}</p> : null}
    </div>
  )
}
