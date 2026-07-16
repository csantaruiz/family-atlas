/**
 * Collision verification for detail-zoom placement around regression years.
 * Run: npx tsx scripts/verify-detail-placement.ts
 */
import { familyDatabase } from '../src/data/familyDatabase'
import { buildFamilyEvents } from '../src/data/buildFamilyEvents'
import { placeDetailEvents } from '../src/utils/detailPlacement'
import { footprintBounds, measureDetailedFootprint } from '../src/utils/labelMeasure'
import { eventImportanceScore } from '../src/utils/clustering'
import { buildStoryChaptersForViewport } from '../src/data/buildStoryChapters'
import { DETAIL_H_GAP, DETAIL_V_GAP } from '../src/utils/detailPlacement'

const width = 1400
const height = 520
const span = 30
const center = 1750
const start = center - span / 2
const end = center + span / 2
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

const scoreOf = (e: typeof visible[0]) =>
  eventImportanceScore(e, chapters, familyDatabase.stats.earliestYear, familyDatabase.root)

const { placed } = placeDetailEvents(visible, start, span, width, height, scoreOf)

function collides(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
): boolean {
  return !(
    a.right + DETAIL_H_GAP < b.left ||
    b.right + DETAIL_H_GAP < a.left ||
    a.bottom + DETAIL_V_GAP < b.top ||
    b.bottom + DETAIL_V_GAP < a.top
  )
}

const boxes = placed.map((p) => {
  const footprint = measureDetailedFootprint(p.event, width, p.compact ?? false)
  const bounds = footprintBounds(p.x, p.y, footprint, p.alignment ?? 'center', p.nudge ?? 0, width)
  return { name: p.event.person.name, year: p.event.year, ...bounds }
})

let overlapCount = 0
for (let i = 0; i < boxes.length; i++) {
  for (let j = i + 1; j < boxes.length; j++) {
    if (collides(boxes[i], boxes[j])) {
      overlapCount++
      console.error(`OVERLAP: ${boxes[i].name} (${boxes[i].year}) vs ${boxes[j].name} (${boxes[j].year})`)
    }
  }
}

const targets = [
  'Antonio Policarpio Loya',
  'Maria Eulogia Pena',
  'Juan Melecio Nemecio Urias',
  'Mary Wade',
]

for (const name of targets) {
  const hits = placed.filter((p) => p.event.person.name === name)
  console.log(`${name}: ${hits.length} placed`, hits.map((h) => ({ lane: h.lane, align: h.alignment, nudge: h.nudge, compact: h.compact })))
}

const edgeViolations = boxes.filter((b) => b.left < 0 || b.right > width)
if (edgeViolations.length) {
  console.error('EDGE violations:', edgeViolations.map((b) => b.name))
}

console.log(`Placed ${placed.length}/${visible.length} events, overlaps: ${overlapCount}`)
process.exit(overlapCount > 0 || edgeViolations.length > 0 ? 1 : 0)
