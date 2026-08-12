import type { FamilyEvent } from '../types'
import type { MeasuredPlaqueAnchor, EditorialObstacle } from './chapterCalloutLayout'
import { estimateEditorialSidenoteObstacles } from './chapterCalloutLayout'
import { movementSummary } from './placeUtils'

export type LabelAlignment = 'center' | 'left' | 'right'

export type MeasuredFootprint = {
  width: number
  height: number
  nameLines: number
  compact: boolean
  maxWidth: number
  categoryHeight: number
  nameHeight: number
  metaHeight: number
  anchorSize: number
  stemHeight: number
}

export type LabelBox = {
  halfWidth: number
  height: number
}

let measureCtx: CanvasRenderingContext2D | null = null

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  if (!measureCtx) {
    const canvas = document.createElement('canvas')
    measureCtx = canvas.getContext('2d')
  }
  return measureCtx
}

export function categoryTypeLabel(event: FamilyEvent): string {
  switch (event.kind) {
    case 'birth':
      return 'BIRTH OF'
    case 'death':
      return 'DEATH OF'
    case 'move':
      return 'MIGRATION'
    case 'marriage':
      return 'MARRIED'
    case 'service':
      return event.title.length > 28 ? 'FAMILY STORY' : event.title.toUpperCase().slice(0, 24)
    default:
      return 'FAMILY STORY'
  }
}

export function categoryLabel(event: FamilyEvent): string {
  return `${categoryTypeLabel(event)} (${event.year})`
}

export function displayName(event: FamilyEvent, compact = false): string {
  const name =
    event.kind === 'marriage'
      ? event.title
      : event.kind === 'move' || event.kind === 'service'
        ? event.person.name
        : event.kind === 'birth' || event.kind === 'death'
          ? event.person.name
          : event.title

  if (!compact) return name
  if (name.length <= 22) return name
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 3) {
    return `${parts[0]} ${parts[parts.length - 1]}`
  }
  return `${name.slice(0, 20)}…`
}

export function detailMaxLabelWidth(viewportWidth: number): number {
  if (viewportWidth <= 760) {
    return Math.round(Math.min(150, Math.max(118, viewportWidth * 0.34)))
  }
  return Math.round(Math.min(190, Math.max(150, viewportWidth * 0.19)))
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): { lines: string[]; width: number } {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const trial = current ? `${current} ${word}` : word
    if (ctx.measureText(trial).width <= maxWidth) {
      current = trial
      continue
    }
    if (current) lines.push(current)
    current = word
    if (lines.length >= maxLines) break
  }

  if (lines.length < maxLines && current) lines.push(current)

  if (lines.length > maxLines) lines.length = maxLines

  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) {
    let last = lines[maxLines - 1]
    while (last.length > 3 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1)
    }
    lines[maxLines - 1] = `${last}…`
  }

  const width = Math.max(...lines.map((line) => ctx.measureText(line).width), 0)
  return { lines, width }
}

export function measureDetailedFootprint(
  event: FamilyEvent,
  viewportWidth: number,
  compact = false,
): MeasuredFootprint {
  const ctx = getMeasureContext()
  const maxWidth = compact ? 128 : detailMaxLabelWidth(viewportWidth)
  const hasMeta = !compact && (event.kind === 'move' || event.kind === 'service')
  const name = displayName(event, compact)
  const cat = categoryLabel(event)

  const anchorSize = 13
  const stemHeight = 18
  const hPad = 12
  const vPad = 8
  const categoryHeight = 20
  const nameLineHeight = compact ? 14 : 16.2
  const metaHeight = hasMeta ? 16 : 0
  const copyGap = 5

  if (!ctx) {
    const width = Math.min(maxWidth, Math.max(cat.length * 5.2, name.length * 4.8) + hPad * 2)
    const nameLines = name.length > 24 ? 2 : 1
    const height = categoryHeight + copyGap + nameLines * nameLineHeight + metaHeight + vPad * 2
    return {
      width,
      height,
      nameLines,
      compact,
      maxWidth,
      categoryHeight,
      nameHeight: nameLines * nameLineHeight,
      metaHeight,
      anchorSize,
      stemHeight,
    }
  }

  ctx.font = '9px Inter, system-ui, sans-serif'
  const catWidth = ctx.measureText(cat).width + 18

  ctx.font = compact
    ? '13px Georgia, "Times New Roman", serif'
    : '15px Georgia, "Times New Roman", serif'
  const wrapped = wrapTextLines(ctx, name, maxWidth - hPad * 2, compact ? 1 : 2)
  const nameWidth = wrapped.width
  const nameLines = wrapped.lines.length

  let metaWidth = 0
  if (hasMeta) {
    ctx.font = '10px Arial, sans-serif'
    metaWidth = ctx.measureText(movementSummary(event) || event.detail || '').width
  }

  const contentWidth = Math.min(maxWidth, Math.max(catWidth, nameWidth, metaWidth) + hPad * 2)
  const height =
    categoryHeight + copyGap + nameLines * nameLineHeight + (metaHeight ? copyGap + metaHeight : 0) + vPad * 2

  return {
    width: contentWidth,
    height,
    nameLines,
    compact,
    maxWidth,
    categoryHeight,
    nameHeight: nameLines * nameLineHeight,
    metaHeight,
    anchorSize,
    stemHeight,
  }
}

export function footprintBounds(
  markerX: number,
  anchorY: number,
  footprint: MeasuredFootprint,
  alignment: LabelAlignment,
  nudge: number,
  viewportWidth: number,
): { left: number; right: number; top: number; bottom: number; labelCenterX: number } {
  const labelBottom = anchorY - 14
  const labelTop = labelBottom - footprint.height
  const stemBottom = anchorY + footprint.stemHeight + 6
  const anchorHalf = footprint.anchorSize / 2

  let left: number
  let right: number
  const anchor = markerX + nudge

  if (alignment === 'left') {
    left = anchor
    right = anchor + footprint.width
  } else if (alignment === 'right') {
    right = anchor
    left = anchor - footprint.width
  } else {
    left = anchor - footprint.width / 2
    right = anchor + footprint.width / 2
  }

  const edgePad = 24
  if (left < edgePad) {
    const shift = edgePad - left
    left += shift
    right += shift
  }
  if (right > viewportWidth - edgePad) {
    const shift = right - (viewportWidth - edgePad)
    left -= shift
    right -= shift
  }

  return {
    left,
    right,
    top: labelTop - 8,
    bottom: Math.max(labelBottom, stemBottom, anchorY + anchorHalf + 4) + 6,
    labelCenterX: (left + right) / 2,
  }
}

/** Nudge that keeps the rendered label inside the viewport after edge clamping. */
export function effectiveLabelNudge(
  markerX: number,
  anchorY: number,
  footprint: MeasuredFootprint,
  alignment: LabelAlignment,
  nudge: number,
  viewportWidth: number,
): number {
  const bounds = footprintBounds(markerX, anchorY, footprint, alignment, nudge, viewportWidth)
  if (alignment === 'left') return bounds.left - markerX
  if (alignment === 'right') return markerX - bounds.right
  return bounds.labelCenterX - markerX
}


/** Estimate full rendered label footprint using canvas measureText when available. */
export function measureEventLabelBox(event: FamilyEvent): LabelBox {
  const footprint = measureDetailedFootprint(event, 1200, false)
  return {
    halfWidth: footprint.width / 2 + 12,
    height: footprint.height + footprint.stemHeight + 20,
  }
}

export function measureChapterLabelHalfWidth(title: string): number {
  const ctx = getMeasureContext()
  if (!ctx) return Math.max(72, title.length * 3.8)
  ctx.font = '12px Georgia, "Times New Roman", serif'
  return Math.max(72, ctx.measureText(title).width / 2 + 10)
}

export function stemIntersectsBox(
  markerX: number,
  anchorY: number,
  stemHeight: number,
  box: { left: number; right: number; top: number; bottom: number },
): boolean {
  const stemTop = anchorY - 4
  const stemBottom = anchorY + stemHeight + 8
  if (stemBottom < box.top || stemTop > box.bottom) return false
  return markerX >= box.left - 3 && markerX <= box.right + 3
}

export const PLAQUE_LABEL_CLEARANCE_PX = 36
export const EDITORIAL_LABEL_CLEARANCE_PX = 14

/** Push an event anchor downward so its label clears a measured chapter plaque. */
export function clampAnchorBelowPlaque(
  event: FamilyEvent,
  markerX: number,
  anchorY: number,
  viewportWidth: number,
  plaque: MeasuredPlaqueAnchor,
  alignment: LabelAlignment = 'center',
  nudge = 0,
  compact = false,
): number {
  const horizontalPad = plaque.width / 2 + 52
  if (markerX < plaque.centerX - horizontalPad || markerX > plaque.centerX + horizontalPad) {
    return anchorY
  }

  const footprint = measureDetailedFootprint(event, viewportWidth, compact)
  const bounds = footprintBounds(markerX, anchorY, footprint, alignment, nudge, viewportWidth)
  const minTop = plaque.bottomY + PLAQUE_LABEL_CLEARANCE_PX
  if (bounds.top >= minTop) return anchorY

  return anchorY + (minTop - bounds.top)
}

/** Keep labels below Featured Story / Atlas Thinking when they share that column. */
export function clampAnchorBelowEditorialPanels(
  event: FamilyEvent,
  markerX: number,
  anchorY: number,
  viewportWidth: number,
  alignment: LabelAlignment = 'center',
  nudge = 0,
  compact = false,
  panels?: EditorialObstacle[],
): number {
  const editorial = panels ?? estimateEditorialSidenoteObstacles(viewportWidth)
  if (!editorial.length) return anchorY

  const footprint = measureDetailedFootprint(event, viewportWidth, compact)
  let y = anchorY

  for (const panel of editorial) {
    const bounds = footprintBounds(markerX, y, footprint, alignment, nudge, viewportWidth)
    const overlapsHorizontally = !(
      bounds.right + 10 < panel.left || bounds.left - 10 > panel.right
    )
    if (!overlapsHorizontally) continue
    const minTop = panel.bottom + EDITORIAL_LABEL_CLEARANCE_PX
    if (bounds.top >= minTop) continue
    y += minTop - bounds.top
  }

  return y
}

/**
 * After plaque clamping (or similar Y pushes), separate anchors that would
 * land on nearly the same band with overlapping labels.
 * Optional `maxY` keeps family markers above the timeline axis.
 */
export function deconflictFamilyAnchorYs<
  T extends { id: string; x: number; y: number; width: number; height: number },
>(items: T[], minGap = 16, maxY?: number): T[] {
  if (items.length <= 1) {
    if (maxY == null) return items
    return items.map((item) => ({ ...item, y: Math.min(item.y, maxY) }))
  }

  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x)
  const resolved: T[] = []

  for (const item of sorted) {
    let y = maxY == null ? item.y : Math.min(item.y, maxY)
    for (let pass = 0; pass < 10; pass++) {
      let nudged = false
      for (const other of resolved) {
        const hClear =
          item.x + item.width / 2 + 10 < other.x - other.width / 2 ||
          other.x + other.width / 2 + 10 < item.x - item.width / 2
        if (hClear) continue
        const minDy = (item.height + other.height) / 2 + minGap
        if (Math.abs(y - other.y) + 0.5 < minDy) {
          const nextY = other.y + minDy
          if (maxY != null && nextY > maxY) break
          y = nextY
          nudged = true
        }
      }
      if (!nudged) break
    }
    if (maxY != null) y = Math.min(y, maxY)
    resolved.push({ ...item, y })
  }

  const byId = new Map(resolved.map((item) => [item.id, item]))
  return items.map((item) => byId.get(item.id) ?? item)
}
