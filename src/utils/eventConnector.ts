import type { FamilyEvent } from '../types'

/** Gap between stem end and the timeline axis (matches historical events). */
export const TIMELINE_STEM_GAP_PX = 12

export const FAMILY_STEM_MIN_HEIGHT_PX = 18

/** Family anchors must stay above the axis so labels never enter the history band. */
export function familyLabelCeilingY(timelineAxisY: number): number {
  return timelineAxisY - FAMILY_STEM_MIN_HEIGHT_PX - TIMELINE_STEM_GAP_PX
}

/** Vertical stem length from the event anchor down toward the timeline axis. */
export function familyEventStemLength(anchorY: number, timelineAxisY: number): number {
  return Math.max(FAMILY_STEM_MIN_HEIGHT_PX, timelineAxisY - anchorY - TIMELINE_STEM_GAP_PX)
}

export function connectorStemColor(kind: FamilyEvent['kind']): string {
  switch (kind) {
    case 'birth':
      return 'rgba(225, 188, 103, 0.46)'
    case 'death':
      return 'rgba(185, 181, 173, 0.46)'
    case 'move':
      return 'rgba(197, 139, 120, 0.46)'
    case 'service':
      return 'rgba(157, 179, 209, 0.46)'
    default:
      return 'rgba(214, 181, 108, 0.48)'
  }
}
