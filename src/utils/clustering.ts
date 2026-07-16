import type {
  BirthCluster,
  FamilyEvent,
  FamilyEventGroup,
  Person,
  PlacedPerson,
  ZoomMode,
} from '../types'
import { yearX } from './timelineMath'

export function chooseFocus(people: Person[], max: number): Person[] {
  const scored = people
    .map((p) => {
      let score = 0
      if (p.focus) score += 100
      if (p.generation != null) score += Math.max(0, 30 - p.generation)
      score += Math.min(15, (p.children?.length ?? 0) * 3)
      if (p.spouses?.length) score += 4
      if (p.birthPlace) score += 2
      return { p, score }
    })
    .sort((a, b) => b.score - a.score || (a.p.birthYear ?? 0) - (b.p.birthYear ?? 0))
  return scored.slice(0, max).map((x) => x.p).sort((a, b) => (a.birthYear ?? 0) - (b.birthYear ?? 0))
}

export function placeLabels(
  people: Person[],
  start: number,
  span: number,
  width: number,
  height: number,
): PlacedPerson[] {
  const lanes = [58, 108, 158, 208]
  const last = lanes.map(() => -1e9)
  const items: PlacedPerson[] = []

  for (const p of people) {
    if (!p.birthYear) continue
    const x = yearX(p.birthYear, start, span, width)
    const labelW = span < 30 ? 180 : span < 90 ? 165 : 145
    let best = -1
    for (let i = 0; i < lanes.length; i++) {
      if (x - last[i] > labelW) {
        best = i
        break
      }
    }
    if (best < 0) {
      items.push({ person: p, x, y: height * 0.54, show: false })
      continue
    }
    last[best] = x
    items.push({
      person: p,
      x,
      y: Math.max(176, height * 0.54 - lanes[best]),
      show: true,
    })
  }
  return items
}

export function buildBirthClusters(
  birthPeople: Person[],
  start: number,
  end: number,
  span: number,
  width: number,
  height: number,
  presentYear: number,
): BirthCluster[] {
  const bin = span > 430 ? 100 : span > 280 ? 50 : 25
  const groups: { y: number; people: Person[] }[] = []

  for (let y = Math.floor(start / bin) * bin; y <= end; y += bin) {
    const people = birthPeople.filter(
      (p) =>
        p.birthYear &&
        p.birthYear >= Math.max(start, y) &&
        p.birthYear < Math.min(end, y + bin),
    )
    if (people.length) groups.push({ y, people })
  }

  return groups.map((g, i) => {
    const mid = Math.max(
      start,
      Math.min(
        end,
        g.people.reduce((a, p) => a + (p.birthYear ?? 0), 0) / g.people.length,
      ),
    )
    const x = yearX(mid, start, span, width)
    const displayY = Math.max(184, height * 0.54 - (i % 2 ? 145 : 82))
    const from = g.y
    const to = Math.min(g.y + bin - 1, presentYear)
    return { y: g.y, people: g.people, from, to, x, displayY }
  })
}

export function clusterThresholdForMode(mode: ZoomMode): number {
  if (mode === 'eras') return 185
  if (mode === 'generations') return 165
  if (mode === 'decades') return 140
  return 95
}

export function eventBudgetForMode(mode: ZoomMode): number {
  if (mode === 'eras') return 5
  if (mode === 'generations') return 7
  if (mode === 'decades') return 9
  return 12
}

export function peopleBudgetForMode(mode: ZoomMode): number {
  if (mode === 'eras') return 3
  if (mode === 'generations') return 4
  if (mode === 'decades') return 4
  return 6
}

export function groupFamilyEvents(
  events: FamilyEvent[],
  start: number,
  span: number,
  width: number,
  mode: ZoomMode,
): FamilyEventGroup[] {
  const clusterThreshold = clusterThresholdForMode(mode)
  const sorted = [...events].sort((a, b) => a.year - b.year)
  const groups: FamilyEventGroup[] = []

  for (const e of sorted) {
    const x = yearX(e.year, start, span, width)
    const prev = groups[groups.length - 1]
    if (prev && x - prev.lastX < clusterThreshold) {
      prev.events.push(e)
      prev.lastX = x
      prev.x = prev.events.reduce((s, v) => s + yearX(v.year, start, span, width), 0) / prev.events.length
    } else {
      groups.push({ events: [e], x, lastX: x, importance: 0 })
    }
  }

  groups.forEach(
    (g) =>
      (g.importance =
        Math.max(...g.events.map((e) => e.importance || 0)) + Math.min(4, g.events.length)),
  )

  const eventBudget = eventBudgetForMode(mode)
  if (groups.length <= eventBudget) return groups

  const ranked = [...groups]
    .sort(
      (a, b) =>
        b.importance - a.importance || Math.abs(a.x - width / 2) - Math.abs(b.x - width / 2),
    )
    .slice(0, eventBudget)
  return ranked.sort((a, b) => a.x - b.x)
}

export function assignEventLanes(
  groups: FamilyEventGroup[],
  height: number,
): { group: FamilyEventGroup; x: number; y: number }[] {
  const lanes = [64, 112, 160, 208]
  const laneLast = lanes.map(() => -1e9)

  return groups.map((g) => {
    const x = g.x
    let lane = 0
    for (let i = 0; i < lanes.length; i++) {
      if (x - laneLast[i] > 125) {
        lane = i
        break
      }
    }
    laneLast[lane] = x
    const y = Math.max(176, height * 0.54 - lanes[lane])
    return { group: g, x, y }
  })
}
