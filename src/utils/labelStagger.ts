import type { LabelAlignment } from './labelMeasure'

/** Minimum horizontal marker gap before labels are treated as independent. */
export const LABEL_STAGGER_GAP_PX = 22

export type MarkerPosition<T> = {
  item: T
  markerX: number
  labelWidth: number
}

/** Merge events whose label footprints would overlap horizontally on the timeline. */
export function groupByLabelProximity<T>(
  items: MarkerPosition<T>[],
  gap = LABEL_STAGGER_GAP_PX,
): MarkerPosition<T>[][] {
  if (!items.length) return []

  const sorted = [...items].sort((a, b) => a.markerX - b.markerX)
  const groups: MarkerPosition<T>[][] = []
  let group = [sorted[0]]
  let groupRight = sorted[0].markerX + sorted[0].labelWidth / 2

  for (let i = 1; i < sorted.length; i++) {
    const entry = sorted[i]
    const left = entry.markerX - entry.labelWidth / 2
    if (left <= groupRight + gap) {
      group.push(entry)
      groupRight = Math.max(groupRight, entry.markerX + entry.labelWidth / 2)
    } else {
      groups.push(group)
      group = [entry]
      groupRight = entry.markerX + entry.labelWidth / 2
    }
  }

  groups.push(group)
  return groups
}

export function minLaneForGroupIndex(groupIndex: number, maxLanes: number): number {
  return Math.min(Math.max(0, groupIndex), maxLanes - 1)
}

export function staggerAlignmentForIndex(index: number): LabelAlignment {
  if (index % 3 === 0) return 'left'
  if (index % 3 === 1) return 'right'
  return 'center'
}

export function allowedLanes(preferred: number, minLane: number, maxLanes: number): number[] {
  const lanes: number[] = []
  for (let lane = minLane; lane < maxLanes; lane++) lanes.push(lane)
  if (preferred >= minLane && preferred < maxLanes) {
    return [preferred, ...lanes.filter((lane) => lane !== preferred)]
  }
  return lanes
}
