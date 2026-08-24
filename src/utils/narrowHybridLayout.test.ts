import { describe, expect, it } from 'vitest'
import { familyDatabase } from '../data/familyDatabase'
import { buildFamilyEvents } from '../data/buildFamilyEvents'
import { layoutFamilyEventsProgressive } from './clustering'
import { footprintBounds, measureDetailedFootprint } from './labelMeasure'
import { DETAIL_H_GAP, DETAIL_V_GAP } from './detailPlacement'
import { maxFamilyEventsForSpan } from './landmarkSelection'

describe('narrow hybrid layout', () => {
  it('stays within density cap and avoids label overlaps at phone width', () => {
    const width = 390
    const height = 700
    const start = 1850
    const end = 1872
    const span = end - start
    const fullSpan = familyDatabase.stats.latestYear - familyDatabase.stats.earliestYear
    const events = buildFamilyEvents(familyDatabase.people)

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

    const cap = maxFamilyEventsForSpan(span, width)
    expect(layout.events.length).toBeLessThanOrEqual(cap)

    const boxes = layout.events.map((placed) => {
      const footprint = measureDetailedFootprint(placed.event, width, placed.compact ?? true)
      return footprintBounds(
        placed.x,
        placed.y,
        footprint,
        placed.alignment ?? 'center',
        placed.nudge ?? 0,
        width,
      )
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

    expect(overlaps).toBe(0)
  })

  it('keeps 1500–1700 family labels from overlapping at 390px', () => {
    const width = 390
    const height = 700
    const start = 1473
    const end = 1793
    const span = end - start
    const fullSpan = familyDatabase.stats.latestYear - familyDatabase.stats.earliestYear
    const events = buildFamilyEvents(familyDatabase.people)

    const layout = layoutFamilyEventsProgressive(
      events,
      start,
      end,
      span,
      width,
      height,
      'centuries',
      fullSpan,
      familyDatabase.stats.earliestYear,
      familyDatabase.root,
      2026,
    )

    expect(layout.events.length).toBeLessThanOrEqual(maxFamilyEventsForSpan(span, width))
    expect(maxFamilyEventsForSpan(span, width)).toBeLessThanOrEqual(3)

    const boxes = layout.events.map((placed) => {
      const footprint = measureDetailedFootprint(placed.event, width, placed.compact ?? true)
      return footprintBounds(
        placed.x,
        placed.y,
        footprint,
        placed.alignment ?? 'center',
        placed.nudge ?? 0,
        width,
      )
    })

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
        expect(collide).toBe(false)
      }
    }
  })
})
