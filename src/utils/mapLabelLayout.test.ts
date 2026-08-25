import { describe, expect, it } from 'vitest'
import { layoutMapLabels } from './mapLabelLayout'

describe('layoutMapLabels', () => {
  const project = (x: number, y: number) => ({ left: x, top: y })

  it('keeps labels on their geographic projection', () => {
    const placed = layoutMapLabels(
      [
        {
          id: 'edge',
          x: 98,
          y: 8,
          text: 'Pennsylvania',
          priority: 100,
          kind: 'major',
          widthPx: 180,
          heightPx: 32,
        },
      ],
      390,
      420,
      8,
      project,
    )

    expect(placed).toHaveLength(1)
    expect(placed[0].left).toBeGreaterThan(50)
    expect(placed[0].left).toBeLessThan(100)
  })

  it('hides lower-priority labels that overlap in screen space', () => {
    const crowded = Array.from({ length: 8 }, (_, i) => ({
      id: i === 0 ? 'keep' : `drop-${i}`,
      x: 50,
      y: 50,
      text: i === 0 ? 'Pennsylvania' : `Town ${i}`,
      priority: i === 0 ? 100 : 40 - i,
      kind: (i === 0 ? 'major' : 'place') as 'major' | 'place',
      widthPx: 170,
      heightPx: 34,
    }))
    const placed = layoutMapLabels(crowded, 200, 180, 8, project)
    expect(placed[0]?.id).toBe('keep')
    expect(placed.length).toBeLessThan(4)
  })
})
