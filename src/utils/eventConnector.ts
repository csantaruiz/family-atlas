import type { FamilyEvent } from '../types'
import type { LabelAlignment } from './labelMeasure'

export function labelWidthForEvent(event: FamilyEvent, compact: boolean): number {
  if (compact) return 128
  if (event.kind === 'move' || event.kind === 'service') return 220
  return 178
}

/** Signed horizontal offset from marker center to the connector elbow (px). */
export function connectorElbowX(
  alignment: LabelAlignment,
  nudge: number,
  labelWidth: number,
): number {
  switch (alignment) {
    case 'left':
      return nudge
    case 'right':
      return -(nudge + labelWidth)
    case 'center':
    default:
      return nudge
  }
}

export function connectorNeedsElbow(elbowX: number): boolean {
  return Math.abs(elbowX) > 2
}

export function connectorStemColor(kind: FamilyEvent['kind']): string {
  switch (kind) {
    case 'birth':
      return 'rgba(225, 188, 103, 0.36)'
    case 'death':
      return 'rgba(185, 181, 173, 0.36)'
    case 'move':
      return 'rgba(197, 139, 120, 0.36)'
    case 'service':
      return 'rgba(157, 179, 209, 0.36)'
    default:
      return 'rgba(214, 181, 108, 0.38)'
  }
}

export const CONNECTOR_V_MARKER = 12
export const CONNECTOR_V_LABEL = 8
