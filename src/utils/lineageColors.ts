import type { Person } from '../types'
import { surnameOf } from './personDirectory'

export type LineageSide = 'paternal' | 'maternal'

export type LineageLine = {
  side: LineageSide
  /** Primary surname for this line (e.g. Ruiz, Hendry). */
  label: string
  /** Parent anchor on this side of the tree. */
  anchorName: string
  color: string
  glowColor: string
  personIds: Set<string>
}

export type LineagePalette = {
  paternal: LineageLine
  maternal: LineageLine
  otherColor: string
  otherGlowColor: string
}

const PATERNAL_COLOR = 'rgba(214, 181, 108, 0.9)'
const PATERNAL_GLOW = 'rgba(214, 181, 108, 0.55)'
const MATERNAL_COLOR = 'rgba(139, 163, 154, 0.9)'
const MATERNAL_GLOW = 'rgba(139, 163, 154, 0.5)'
const OTHER_COLOR = 'rgba(138, 145, 174, 0.78)'
const OTHER_GLOW = 'rgba(138, 145, 174, 0.4)'

function peopleById(people: Person[]): Map<string, Person> {
  return new Map(people.map((person) => [person.id, person]))
}

function collectAncestors(startId: string, byId: Map<string, Person>): Set<string> {
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
  root: Person,
  byId: Map<string, Person>,
): { father?: Person; mother?: Person } {
  const parents = (root.parents ?? [])
    .map((id) => byId.get(id))
    .filter((person): person is Person => Boolean(person))

  let father = parents.find((person) => person.sex === 'M')
  let mother = parents.find((person) => person.sex === 'F')

  if (!father && parents[0]) father = parents[0]
  if (!mother && parents[1] && parents[1].id !== father?.id) mother = parents[1]

  return { father, mother }
}

function topSurnames(people: Person[], limit = 2): string[] {
  const counts = new Map<string, number>()
  for (const person of people) {
    const surname = surnameOf(person.name)
    if (!surname) continue
    counts.set(surname, (counts.get(surname) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name)
}

function buildLine(
  side: LineageSide,
  anchor: Person | undefined,
  fallbackLabel: string,
  byId: Map<string, Person>,
): LineageLine {
  const label = anchor ? surnameOf(anchor.name) || fallbackLabel : fallbackLabel
  return {
    side,
    label,
    anchorName: anchor?.name ?? fallbackLabel,
    color: side === 'paternal' ? PATERNAL_COLOR : MATERNAL_COLOR,
    glowColor: side === 'paternal' ? PATERNAL_GLOW : MATERNAL_GLOW,
    personIds: lineagePersonIds(anchor?.id, byId),
  }
}

/** Infer the two primary migration line colors from the archive root's parents. */
export function buildLineagePalette(people: Person[], rootId: string): LineagePalette {
  const byId = peopleById(people)
  const root =
    byId.get(rootId) ??
    people.find((person) => person.generation === 0) ??
    people.find((person) => person.focus)

  const [fallbackPaternal, fallbackMaternal] = topSurnames(people, 2)

  if (!root) {
    return {
      paternal: buildLine('paternal', undefined, fallbackPaternal ?? 'Paternal', byId),
      maternal: buildLine('maternal', undefined, fallbackMaternal ?? 'Maternal', byId),
      otherColor: OTHER_COLOR,
      otherGlowColor: OTHER_GLOW,
    }
  }

  const { father, mother } = resolveParentSide(root, byId)

  return {
    paternal: buildLine('paternal', father, fallbackPaternal ?? 'Paternal', byId),
    maternal: buildLine('maternal', mother, fallbackMaternal ?? 'Maternal', byId),
    otherColor: OTHER_COLOR,
    otherGlowColor: OTHER_GLOW,
  }
}

/** All branch sides a person belongs to (root descendants may be on both). */
export function personLineageSides(
  personId: string,
  palette: LineagePalette,
  byId: Map<string, Person>,
): Set<LineageSide> {
  const sides = new Set<LineageSide>()
  if (palette.paternal.personIds.has(personId)) sides.add('paternal')
  if (palette.maternal.personIds.has(personId)) sides.add('maternal')
  if (sides.size > 0) return sides

  const person = byId.get(personId)
  if (!person) return sides

  const surname = surnameOf(person.name)
  if (surname && surname === palette.paternal.label) sides.add('paternal')
  if (surname && surname === palette.maternal.label) sides.add('maternal')
  return sides
}

export function classifyPersonLineage(
  personId: string,
  palette: LineagePalette,
  byId: Map<string, Person>,
): LineageSide | 'other' {
  const sides = personLineageSides(personId, palette, byId)
  if (sides.has('paternal')) return 'paternal'
  if (sides.has('maternal')) return 'maternal'
  return 'other'
}

export function routeDominantLineage(
  segments: { personId: string }[],
  palette: LineagePalette,
  byId: Map<string, Person>,
): LineageSide | 'other' {
  if (!segments.length) return 'other'

  const counts: Record<LineageSide | 'other', number> = {
    paternal: 0,
    maternal: 0,
    other: 0,
  }

  for (const segment of segments) {
    counts[classifyPersonLineage(segment.personId, palette, byId)]++
  }

  if (counts.paternal >= counts.maternal && counts.paternal >= counts.other && counts.paternal > 0) {
    return 'paternal'
  }
  if (counts.maternal >= counts.other && counts.maternal > 0) return 'maternal'
  if (counts.paternal > 0) return 'paternal'
  return 'other'
}

export function lineageStrokeColor(
  side: LineageSide | 'other',
  palette: LineagePalette,
  confidence: 'documented' | 'inferred',
): string {
  const alpha = confidence === 'documented' ? 0.52 : 0.3
  if (side === 'paternal') {
    return `rgba(214, 181, 108, ${alpha})`
  }
  if (side === 'maternal') {
    return `rgba(139, 163, 154, ${alpha})`
  }
  return confidence === 'documented' ? palette.otherColor : `rgba(138, 145, 174, ${alpha})`
}

export function lineageFlowColor(
  side: LineageSide | 'other',
  palette: LineagePalette,
): string {
  if (side === 'paternal') return palette.paternal.glowColor
  if (side === 'maternal') return palette.maternal.glowColor
  return palette.otherGlowColor
}

export function lineageTravelerColor(
  side: LineageSide | 'other',
  palette: LineagePalette,
): string {
  if (side === 'paternal') return palette.paternal.color
  if (side === 'maternal') return palette.maternal.color
  return palette.otherColor
}

export function lineageLegendItems(palette: LineagePalette): {
  side: LineageSide
  label: string
  color: string
}[] {
  return [
    { side: 'paternal', label: `${palette.paternal.label} line`, color: palette.paternal.color },
    { side: 'maternal', label: `${palette.maternal.label} line`, color: palette.maternal.color },
  ]
}
