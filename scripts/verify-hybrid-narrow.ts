/**
 * Narrow-stage hybrid regression (~phone width).
 * Run: npx tsx scripts/verify-hybrid-narrow.ts
 */
import { familyDatabase } from '../src/data/familyDatabase'
import { buildFamilyEvents } from '../src/data/buildFamilyEvents'
import { layoutFamilyEventsProgressive } from '../src/utils/clustering'
import { semanticZoomMode } from '../src/utils/semanticZoom'
import { assignEventsToChapters, buildStoryChaptersForViewport } from '../src/data/buildStoryChapters'
import { footprintBounds, measureDetailedFootprint } from '../src/utils/labelMeasure'
import { DETAIL_H_GAP, DETAIL_V_GAP } from '../src/utils/detailPlacement'
import { maxFamilyEventsForSpan } from '../src/utils/landmarkSelection'
import { isNarrowStage } from '../src/utils/stageBreakpoints'

const width = 390
const height = 700
const start = 1850
const end = 1872
const span = end - start
const fullSpan = familyDatabase.stats.latestYear - familyDatabase.stats.earliestYear

if (!isNarrowStage(width)) {
  console.error('Expected narrow width ≤760')
  process.exit(1)
}

const allEvents = buildFamilyEvents(familyDatabase.people)
const visible = allEvents.filter((e) => e.year >= start && e.year <= end)
const chapters = buildStoryChaptersForViewport(
  visible,
  start,
  end,
  span,
  familyDatabase.stats.earliestYear,
  2026,
  12,
)
const chapterMap = assignEventsToChapters(visible, chapters)
const mode = semanticZoomMode(span, fullSpan, {
  visible,
  start,
  span,
  width,
  chapters,
  chapterMap,
})

const layout = layoutFamilyEventsProgressive(
  allEvents,
  start,
  end,
  span,
  width,
  height,
  'years',
  fullSpan,
  familyDatabase.stats.earliestYear,
  familyDatabase.root,
  2026,
)

const cap = maxFamilyEventsForSpan(span, width)
console.log(`Narrow mode: ${mode} (span=${span}, width=${width})`)
console.log(`Visible events: ${visible.length}`)
console.log(`Placed landmarks: ${layout.events.length} (cap ${cap})`)
console.log(`Residual clusters: ${layout.clusters.length}`)

if (layout.events.length > cap) {
  console.error(`FAIL: placed ${layout.events.length} > narrow cap ${cap}`)
  process.exit(1)
}

const boxes = layout.events.map((p) => {
  const footprint = measureDetailedFootprint(p.event, width, p.compact ?? true)
  return footprintBounds(p.x, p.y, footprint, p.alignment ?? 'center', p.nudge ?? 0, width)
})

let overlaps = 0
for (let i = 0; i < boxes.length; i++) {
  for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i]
    const b = boxes[j]
    const collide = !(
      a.right + DETAIL_H_GAP < b.left ||
      b.right + DETAIL_H_GAP < a.left ||
      a.bottom + DETAIL_V_GAP < b.top ||
      b.bottom + DETAIL_V_GAP < a.top
    )
    if (collide) overlaps++
  }
}

if (overlaps > 0) {
  console.error(`FAIL: ${overlaps} label overlaps on narrow stage`)
  process.exit(1)
}

console.log('OK: narrow hybrid layout within cap and zero label overlaps')
