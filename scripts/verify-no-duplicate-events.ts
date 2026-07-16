/**
 * Duplicate event regression — 1740–1765 hybrid/detail viewport.
 * Run: npx tsx scripts/verify-no-duplicate-events.ts
 */
import { familyDatabase } from '../src/data/familyDatabase'
import { buildFamilyEvents } from '../src/data/buildFamilyEvents'
import { layoutFamilyEventsProgressive } from '../src/utils/clustering'
import { canonicalEventId, dedupeFamilyEvents } from '../src/utils/canonicalEvent'

const width = 1400
const height = 520
const fullSpan = familyDatabase.stats.latestYear - familyDatabase.stats.earliestYear

const raw = buildFamilyEvents(familyDatabase.people)
const events = dedupeFamilyEvents(raw)

let failed = false

for (const span of [12, 22, 30]) {
  const start = 1740
  const end = start + span
  const layout = layoutFamilyEventsProgressive(
    events,
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

  const ids = layout.events.map((p) => canonicalEventId(p.event))
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
  const maria = layout.events.filter((p) => p.event.person.name === 'Maria Eulogia Pena')
  const thomas = layout.events.filter(
    (p) => p.event.person.name === 'Thomas Stubbs' && p.event.year === 1755,
  )

  if (dup.length || maria.length > 1 || thomas.length > 1) {
    failed = true
    console.error(`FAIL span=${span}`, { dup, maria: maria.length, thomas: thomas.length })
  } else {
    console.log(
      `OK span=${span} placed=${layout.events.length} maria=${maria.length} thomas=${thomas.length}`,
    )
  }
}

process.exit(failed ? 1 : 0)
