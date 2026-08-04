import type { NarrativeCue } from '../types'

export const NARRATIVE_CUES: NarrativeCue[] = [
  {
    id: 'opening',
    start: 0,
    end: 12,
    title: 'Every family leaves a trail.',
  },
  {
    id: 'britain',
    start: 12,
    end: 38,
    title: 'The earliest surviving thread begins in Britain.',
  },
  {
    id: 'gawsworth',
    start: 38,
    end: 45,
    title: 'William Lowndes',
    date: '1473',
    subtitle: 'Gawsworth, Cheshire',
  },
]

export function findActiveNarrativeCue(timeSeconds: number): NarrativeCue | null {
  return (
    NARRATIVE_CUES.find((cue) => timeSeconds >= cue.start && timeSeconds < cue.end) ?? null
  )
}
