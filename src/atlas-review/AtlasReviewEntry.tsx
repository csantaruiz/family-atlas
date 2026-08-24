import { useAtlasReview } from './AtlasReviewRoot'
import { reviewShortcutLabel } from './customerReviewCopy'

/** Quiet brand shortcut. Hidden when the Review queue is empty. */
export function AtlasReviewEntry() {
  const { count, openReview } = useAtlasReview()
  if (count <= 0) return null

  return (
    <button type="button" className="atlas-review-chip" onClick={openReview}>
      {reviewShortcutLabel(count)}
    </button>
  )
}
