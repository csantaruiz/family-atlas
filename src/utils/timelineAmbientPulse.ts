export const AMBIENT_PULSE_INTERVAL_MIN_MS = 8_000
export const AMBIENT_PULSE_INTERVAL_MAX_MS = 11_000
export const AMBIENT_HISTORY_PULSE_MS = 1_500
export const AMBIENT_AXIS_PULSE_MS = 1_500
export const AMBIENT_FAMILY_STAGGER_MS = 160
export const AMBIENT_FAMILY_PULSE_MS = 1_250
export const AMBIENT_FAMILY_RESPONSE_BASE_MS = 380
export const AMBIENT_PULSE_CLEAR_BUFFER_MS = 120

export type PulseTarget = { key: string; year: number; x: number }

export function ambientPulseIntervalMs(): number {
  const span = AMBIENT_PULSE_INTERVAL_MAX_MS - AMBIENT_PULSE_INTERVAL_MIN_MS
  return AMBIENT_PULSE_INTERVAL_MIN_MS + Math.random() * span
}

export function ambientYearProximityWindow(span: number): number {
  return Math.max(12, Math.min(48, span * 0.075))
}

export function pickWeightedHistoryTarget(
  targets: PulseTarget[],
  centerYear: number,
): PulseTarget | null {
  if (!targets.length) return null

  const weights = targets.map((target) => {
    const distance = Math.abs(target.year - centerYear)
    return { target, weight: 1 / (1 + distance / 35) }
  })

  const total = weights.reduce((sum, entry) => sum + entry.weight, 0)
  let roll = Math.random() * total

  for (const entry of weights) {
    roll -= entry.weight
    if (roll <= 0) return entry.target
  }

  return weights[weights.length - 1]?.target ?? null
}

export function findRespondingFamilyTargets(
  family: PulseTarget[],
  historyYear: number,
  windowYears: number,
  maxCount: number,
): PulseTarget[] {
  if (!family.length) return []

  const ranked = family
    .map((target) => ({ ...target, distance: Math.abs(target.year - historyYear) }))
    .sort((a, b) => a.distance - b.distance || a.year - b.year)

  const nearest = ranked[0]
  const responders = [nearest]

  for (const target of ranked.slice(1)) {
    if (responders.length >= maxCount) break
    if (target.distance <= windowYears) responders.push(target)
  }

  return responders
}

export function ambientPulseClearDelayMs(responderCount: number): number {
  const lastFamilyDelay =
    responderCount > 0
      ? AMBIENT_FAMILY_RESPONSE_BASE_MS +
        Math.max(0, responderCount - 1) * AMBIENT_FAMILY_STAGGER_MS
      : 0

  const longestAnimationEnd = Math.max(
    AMBIENT_HISTORY_PULSE_MS,
    AMBIENT_AXIS_PULSE_MS,
    lastFamilyDelay + AMBIENT_FAMILY_PULSE_MS,
    lastFamilyDelay + AMBIENT_AXIS_PULSE_MS,
  )

  return longestAnimationEnd + AMBIENT_PULSE_CLEAR_BUFFER_MS
}
