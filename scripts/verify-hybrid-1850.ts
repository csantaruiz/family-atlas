/**
 * Hybrid-mode regression for 1850–1872 viewport.
 * Run: npx tsx scripts/verify-hybrid-1850.ts
 */
import { familyDatabase } from '../src/data/familyDatabase'
import { buildFamilyEvents } from '../src/data/buildFamilyEvents'
import { layoutFamilyEventsProgressive } from '../src/utils/clustering'
import { semanticZoomMode, chapterDensity, landmarksForChapterDensity } from '../src/utils/semanticZoom'
import { assignEventsToChapters, buildStoryChaptersForViewport } from '../src/data/buildStoryChapters'
import { footprintBounds, measureDetailedFootprint } from '../src/utils/labelMeasure'
import { DETAIL_H_GAP, DETAIL_V_GAP } from '../src/utils/detailPlacement'

const width = 1400
const height = 520
const start = 1850
const end = 1872
const span = end - start
const fullSpan = familyDatabase.stats.latestYear - familyDatabase.stats.earliestYear

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

console.log(`Mode: ${mode} (span=${span})`)
console.log(`Visible events: ${visible.length}`)
console.log(`Placed landmarks: ${layout.events.length}`)
console.log(`Residual clusters: ${layout.clusters.length}`)

for (const c of layout.clusters) {
  console.log(`  Cluster: ${c.title} ${c.from}–${c.to} +${c.hiddenCount} hidden`)
}

let maxPerChapter = 0
for (const chapter of chapters) {
  const events = chapterMap.get(chapter.id) ?? []
  const placed = layout.events.filter((p) => events.includes(p.event)).length
  const density = chapterDensity(events, chapter.yearStart, chapter.yearEnd)
  const limit = landmarksForChapterDensity(density, mode, events)
  maxPerChapter = Math.max(maxPerChapter, placed)
  console.log(
    `  Chapter ${chapter.yearStart}–${chapter.yearEnd}: ${events.length} events, density=${density}, limit=${limit}, placed=${placed}`,
  )
}

const boxes = layout.events.map((p) => {
  const footprint = measureDetailedFootprint(p.event, width, p.compact ?? false)
  const bounds = footprintBounds(p.x, p.y, footprint, p.alignment ?? 'center', p.nudge ?? 0, width)
  return bounds
})

let overlaps = 0
for (let i = 0; i < boxes.length; i++) {
  for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i]
    const b = boxes[j]
    if (
      !(
        a.right + DETAIL_H_GAP < b.left ||
        b.right + DETAIL_H_GAP < a.left ||
        a.bottom + DETAIL_V_GAP < b.top ||
        b.bottom + DETAIL_V_GAP < a.top
      )
    ) {
      overlaps++
    }
  }
}

const ok =
  mode !== 'detail' &&
  layout.clusters.length > 0 &&
  maxPerChapter <= 4 &&
  overlaps === 0

console.log(`Max landmarks in one chapter: ${maxPerChapter}`)
console.log(`Overlaps: ${overlaps}`)
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
