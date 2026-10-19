import { describe, expect, it } from 'vitest'
import { selectGuidedLabels, type GuidedLabelCandidate } from '../guidedLabelEmphasis'

function label(
  id: string,
  left: number,
  extra: Partial<GuidedLabelCandidate> = {},
): GuidedLabelCandidate {
  return {
    id,
    personId: id,
    kind: 'birth',
    year: 1920,
    importance: 2,
    left,
    right: left + 120,
    top: 100,
    bottom: 140,
    ...extra,
  }
}

describe('selectGuidedLabels', () => {
  it('never keeps two overlapping labels', () => {
    const picked = selectGuidedLabels(
      [label('a', 0), label('b', 60), label('c', 200), label('d', 260)],
      { focusPersonIds: [], maxLabels: 10 },
    )
    expect([...picked].sort()).toEqual(['a', 'c'])
  })

  it('keeps the focus person over a more important neighbour', () => {
    const picked = selectGuidedLabels(
      [label('loud', 0, { importance: 9 }), label('focus', 40, { personId: 'hero' })],
      { focusPersonIds: ['hero'], maxLabels: 10 },
    )
    expect([...picked]).toEqual(['focus'])
  })

  it('prefers chapter-relevant records, then respects the budget', () => {
    const picked = selectGuidedLabels(
      [
        label('old-death', 0, { kind: 'death', year: 1890, importance: 5 }),
        label('era-birth', 200, { year: 1930 }),
        label('era-marriage', 400, { kind: 'marriage', year: 1938 }),
      ],
      {
        focusPersonIds: [],
        emphasis: { years: { start: 1914, end: 1945 }, kinds: ['birth', 'marriage'] },
        maxLabels: 2,
      },
    )
    expect([...picked].sort()).toEqual(['era-birth', 'era-marriage'])
  })

  it('caps unrelated records when the chapter has an emphasis, preferring in-era ones', () => {
    const picked = selectGuidedLabels(
      [
        label('focus-birth', 0, { year: 1923 }),
        label('era-death', 200, { kind: 'death', year: 1919, importance: 6 }),
        label('era-move', 400, { kind: 'move', year: 1935, importance: 6 }),
        label('late-move', 600, { kind: 'move', year: 1949, importance: 9 }),
      ],
      {
        focusPersonIds: [],
        emphasis: { years: { start: 1914, end: 1945 }, kinds: ['birth', 'marriage'] },
        maxLabels: 6,
      },
    )
    expect([...picked].sort()).toEqual(['era-death', 'era-move', 'focus-birth'])
  })

  it('labels each person once and is deterministic', () => {
    const input = [
      label('birth', 0, { personId: 'p' }),
      label('marriage', 400, { personId: 'p', kind: 'marriage' }),
      label('other', 800),
    ]
    const first = selectGuidedLabels(input, { focusPersonIds: [], maxLabels: 5 })
    const second = selectGuidedLabels([...input].reverse(), { focusPersonIds: [], maxLabels: 5 })
    expect(first.size).toBe(2)
    expect([...first].sort()).toEqual([...second].sort())
  })
})
