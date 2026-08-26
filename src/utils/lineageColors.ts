import type { Person } from '../types'
import { primaryRootIds } from './householdRoots'
export { householdCoRootId, primaryRootIds } from './householdRoots'
import { surnameOf } from './personDirectory'

export type LineageId =
  | 'rootPaternal'
  | 'rootMaternal'
  | 'coRootPaternal'
  | 'coRootMaternal'

/** @deprecated Use LineageId. Root paternal/maternal aliases. */
export type LineageSide = LineageId

export type LineageLine = {
  id: LineageId
  household: 'root' | 'coRoot'
  side: 'paternal' | 'maternal'
  /** Surname of the parent-anchor, for display only. */
  label: string
  anchorName: string
  color: string
  glowColor: string
  personIds: Set<string>
}

export type LineagePalette = {
  lines: LineageLine[]
  rootPaternal: LineageLine
  rootMaternal: LineageLine
  coRootPaternal: LineageLine
  coRootMaternal: LineageLine
  paternal: LineageLine
  maternal: LineageLine
  otherColor: string
  otherGlowColor: string
}

const LINE_COLORS: Record<LineageId, { color: string; glow: string }> = {
  rootPaternal: { color: 'rgba(214, 181, 108, 0.9)', glow: 'rgba(214, 181, 108, 0.55)' },
  rootMaternal: { color: 'rgba(139, 163, 154, 0.9)', glow: 'rgba(139, 163, 154, 0.5)' },
  coRootPaternal: { color: 'rgba(186, 122, 98, 0.9)', glow: 'rgba(186, 122, 98, 0.5)' },
  coRootMaternal: { color: 'rgba(122, 142, 176, 0.9)', glow: 'rgba(122, 142, 176, 0.5)' },
}

const OTHER_COLOR = 'rgba(138, 145, 174, 0.78)'
const OTHER_GLOW = 'rgba(138, 145, 174, 0.4)'

function peopleById(people: Person[]): Map<string, Person> {
  return new Map(people.map((person) => [person.id, person]))
}

export function collectAncestors(startId: string, byId: Map<string, Person>): Set<string> {
  const seen = new Set<string>()
  const stack = [startId]
  while (stack.length) {
    const id = stack.pop()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const person = byId.get(id)
    person?.parents?.forEach((parentId) => stack.push(parentId))
  }
  return seen
}

function collectDescendants(startId: string, byId: Map<string, Person>): Set<string> {
  const seen = new Set<string>()
  const stack = [startId]
  while (stack.length) {
    const id = stack.pop()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const person = byId.get(id)
    person?.children?.forEach((childId) => stack.push(childId))
  }
  return seen
}

function lineagePersonIds(startId: string | undefined, byId: Map<string, Person>): Set<string> {
  if (!startId) return new Set()
  const ids = collectAncestors(startId, byId)
  collectDescendants(startId, byId).forEach((id) => ids.add(id))
  return ids
}

function resolveParentSide(
  person: Person | undefined,
  byId: Map<string, Person>,
): { father?: Person; mother?: Person } {
  if (!person) return {}
  const parents = (person.parents ?? [])
    .map((id) => byId.get(id))
    .filter((row): row is Person => Boolean(row))

  let father = parents.find((row) => row.sex === 'M')
  let mother = parents.find((row) => row.sex === 'F')
  if (!father && parents[0]) father = parents[0]
  if (!mother && parents[1] && parents[1].id !== father?.id) mother = parents[1]
  return { father, mother }
}

function givenName(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

function buildLine(
  id: LineageId,
  household: 'root' | 'coRoot',
  side: 'paternal' | 'maternal',
  anchor: Person | undefined,
  fallbackLabel: string,
  byId: Map<string, Person>,
): LineageLine {
  const colors = LINE_COLORS[id]
  return {
    id,
    household,
    side,
    label: anchor ? surnameOf(anchor.name) || fallbackLabel : fallbackLabel,
    anchorName: anchor?.name ?? fallbackLabel,
    color: colors.color,
    glowColor: colors.glow,
    personIds: lineagePersonIds(anchor?.id, byId),
  }
}

/** Four genealogical lines from the archive root and household co-root. */
export function buildLineagePalette(people: Person[], rootId: string): LineagePalette {
  const byId = peopleById(people)
  const roots = primaryRootIds(rootId, people)
  const root = byId.get(roots[0] ?? rootId)
  const coRoot = roots[1] ? byId.get(roots[1]) : undefined
  const rootParents = resolveParentSide(root, byId)
  const coParents = resolveParentSide(coRoot, byId)

  const rootPaternal = buildLine(
    'rootPaternal',
    'root',
    'paternal',
    rootParents.father,
    'Paternal',
    byId,
  )
  const rootMaternal = buildLine(
    'rootMaternal',
    'root',
    'maternal',
    rootParents.mother,
    'Maternal',
    byId,
  )
  const coRootPaternal = buildLine(
    'coRootPaternal',
    'coRoot',
    'paternal',
    coParents.father,
    coRoot ? `${givenName(coRoot.name)} paternal` : 'Paternal',
    byId,
  )
  const coRootMaternal = buildLine(
    'coRootMaternal',
    'coRoot',
    'maternal',
    coParents.mother,
    coRoot ? `${givenName(coRoot.name)} maternal` : 'Maternal',
    byId,
  )

  return {
    lines: [rootPaternal, rootMaternal, coRootPaternal, coRootMaternal],
    rootPaternal,
    rootMaternal,
    coRootPaternal,
    coRootMaternal,
    paternal: rootPaternal,
    maternal: rootMaternal,
    otherColor: OTHER_COLOR,
    otherGlowColor: OTHER_GLOW,
  }
}

export function personLineageIds(
  personId: string,
  palette: LineagePalette,
  byId: Map<string, Person>,
): Set<LineageId> {
  const ids = new Set<LineageId>()
  for (const line of palette.lines) {
    if (line.personIds.has(personId)) ids.add(line.id)
  }
  if (ids.size > 0) return ids

  const person = byId.get(personId)
  if (!person) return ids
  const surname = surnameOf(person.name)
  for (const line of palette.lines) {
    if (surname && surname === line.label && line.personIds.size > 0) ids.add(line.id)
  }
  return ids
}

/** @deprecated Use personLineageIds */
export function personLineageSides(
  personId: string,
  palette: LineagePalette,
  byId: Map<string, Person>,
): Set<LineageId> {
  return personLineageIds(personId, palette, byId)
}

export function classifyPersonLineage(
  personId: string,
  palette: LineagePalette,
  byId: Map<string, Person>,
): LineageId | 'other' {
  const ids = personLineageIds(personId, palette, byId)
  if (ids.has('rootPaternal')) return 'rootPaternal'
  if (ids.has('rootMaternal')) return 'rootMaternal'
  if (ids.has('coRootPaternal')) return 'coRootPaternal'
  if (ids.has('coRootMaternal')) return 'coRootMaternal'
  return 'other'
}

export function routeDominantLineage(
  segments: { personId: string }[],
  palette: LineagePalette,
  byId: Map<string, Person>,
): LineageId | 'other' {
  if (!segments.length) return 'other'
  const counts: Record<LineageId | 'other', number> = {
    rootPaternal: 0,
    rootMaternal: 0,
    coRootPaternal: 0,
    coRootMaternal: 0,
    other: 0,
  }
  for (const segment of segments) {
    counts[classifyPersonLineage(segment.personId, palette, byId)]++
  }
  const ranked = (Object.entries(counts) as [LineageId | 'other', number][])
    .sort((a, b) => b[1] - a[1])
  return ranked[0] && ranked[0][1] > 0 ? ranked[0][0] : 'other'
}

export function lineageStrokeColor(
  side: LineageId | 'other',
  palette: LineagePalette,
  confidence: 'documented' | 'inferred',
): string {
  const alpha = confidence === 'documented' ? 0.52 : 0.3
  const line = palette.lines.find((line) => line.id === side)
  if (line) {
    return line.color.replace(/[\d.]+\)$/, `${alpha})`)
  }
  return confidence === 'documented' ? palette.otherColor : `rgba(138, 145, 174, ${alpha})`
}

export function lineageFlowColor(
  side: LineageId | 'other',
  palette: LineagePalette,
): string {
  const line = palette.lines.find((line) => line.id === side)
  return line?.glowColor ?? palette.otherGlowColor
}

export function lineageTravelerColor(
  side: LineageId | 'other',
  palette: LineagePalette,
): string {
  const line = palette.lines.find((line) => line.id === side)
  return line?.color ?? palette.otherColor
}

export function lineageLegendItems(palette: LineagePalette): {
  id: LineageId
  side: LineageId
  label: string
  color: string
}[] {
  return palette.lines
    .filter((line) => line.personIds.size > 0)
    .map((line) => ({
      id: line.id,
      side: line.id,
      label: `${line.label} line`,
      color: line.color,
    }))
}

export function lineageFilterOptions(palette: LineagePalette): {
  id: LineageId
  label: string
}[] {
  return palette.lines
    .filter((line) => line.personIds.size > 0)
    .map((line) => ({
      id: line.id,
      label: `${line.label} line`,
    }))
}
