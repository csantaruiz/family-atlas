import { getDocumentaryStats } from '../../data/documentaryStats'
import type { ApprovedPerson, TimeLayerState } from '../types/choreography'
import type { SceneManifestEntry } from '../types/manifest'
import { AUDIO_ANALYZED_DURATION_MS, AUDIO_CAMERA_CUES } from './audioSyncDirector'
import type { NarrativeOverlayState } from './narrativeOverlayDirector'

type YearKeyframe = { timeMs: number; year: number }

const TIME_LAYER_VISIBLE_FROM_MS = 8_000

const ERA_PHRASE_YEARS: ReadonlyArray<[RegExp, number]> = [
  [/early 18th century/i, 1720],
  [/late 20th century/i, 1985],
  [/21st century/i, 2001],
]

function parseYear(value: number | string | undefined): number | null {
  if (value == null) return null
  const year = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(year) ? year : null
}

function presentYear(): number {
  return new Date().getFullYear()
}

function yearFromNarrationText(text: string | undefined): number | null {
  if (!text) return null

  for (const [pattern, year] of ERA_PHRASE_YEARS) {
    if (pattern.test(text)) return year
  }

  const matches = text.match(/\b(1[4-9]\d{2}|20[0-2]\d)\b/g)
  if (!matches?.length) return null
  return Number.parseInt(matches[matches.length - 1]!, 10)
}

function documentaryEndMs(manifest: SceneManifestEntry[]): number {
  return manifest[manifest.length - 1]?.narrationEndMs ?? AUDIO_ANALYZED_DURATION_MS
}

function dedupeKeyframes(keyframes: YearKeyframe[]): YearKeyframe[] {
  const sorted = [...keyframes].sort((a, b) => a.timeMs - b.timeMs || a.year - b.year)
  const deduped: YearKeyframe[] = []

  for (const frame of sorted) {
    const prev = deduped[deduped.length - 1]
    if (prev && prev.timeMs === frame.timeMs) {
      prev.year = frame.year
    } else {
      deduped.push({ ...frame })
    }
  }

  return deduped
}

/** Story years must never move backward — atlas recap scenes included. */
function enforceMonotonicKeyframes(keyframes: YearKeyframe[]): YearKeyframe[] {
  const sorted = dedupeKeyframes(keyframes)
  if (sorted.length === 0) return sorted

  let maxYear = sorted[0]!.year
  return sorted.map((frame) => {
    maxYear = Math.max(maxYear, frame.year)
    return { timeMs: frame.timeMs, year: maxYear }
  })
}

function collectStoryYearKeyframes(manifest: SceneManifestEntry[]): YearKeyframe[] {
  const stats = getDocumentaryStats()
  const endYear = presentYear()
  const endMs = documentaryEndMs(manifest)
  const keyframes: YearKeyframe[] = [{ timeMs: TIME_LAYER_VISIBLE_FROM_MS, year: stats.earliestYear }]

  for (const scene of manifest) {
    const start = scene.narrationStartMs
    const end = scene.narrationEndMs
    const duration = Math.max(1, end - start)

    const sceneYear = parseYear(scene.activeYear)
    if (sceneYear != null) {
      keyframes.push({ timeMs: start, year: sceneYear })
    }

    if (scene.timelineWindow && scene.id !== 'atlas-timeline') {
      keyframes.push({ timeMs: start, year: scene.timelineWindow.start })
      keyframes.push({ timeMs: end, year: scene.timelineWindow.end })
    }

    if (scene.id === 'atlas-timeline') {
      keyframes.push({ timeMs: start, year: Math.max(endYear - 30, stats.earliestYear + 400) })
      keyframes.push({ timeMs: end, year: endYear })
    }

    for (const person of scene.choreography?.approvedPeople ?? []) {
      const year = parseYear(person.year)
      if (year != null) {
        keyframes.push({ timeMs: start + person.start * duration, year })
      }
    }

    const overlay = scene.choreography?.narrativeOverlay
    const overlayYear = parseYear(overlay?.date)
    if (overlay && overlayYear != null) {
      keyframes.push({ timeMs: start + overlay.start * duration, year: overlayYear })
    }
  }

  for (const cue of AUDIO_CAMERA_CUES) {
    const year = yearFromNarrationText(cue.matchedText)
    if (year != null) {
      keyframes.push({ timeMs: cue.timeMs, year })
    }
  }

  keyframes.push({ timeMs: endMs, year: endYear })

  return enforceMonotonicKeyframes(keyframes)
}

function interpolateScriptYear(timeMs: number, keyframes: YearKeyframe[]): number {
  if (keyframes.length === 0) return getDocumentaryStats().earliestYear
  if (timeMs <= keyframes[0]!.timeMs) return keyframes[0]!.year
  if (timeMs >= keyframes[keyframes.length - 1]!.timeMs) {
    return keyframes[keyframes.length - 1]!.year
  }

  for (let i = 0; i < keyframes.length - 1; i += 1) {
    const from = keyframes[i]!
    const to = keyframes[i + 1]!
    if (timeMs >= from.timeMs && timeMs <= to.timeMs) {
      const span = to.timeMs - from.timeMs
      if (span <= 0) return to.year
      const t = (timeMs - from.timeMs) / span
      return Math.round(from.year + (to.year - from.year) * t)
    }
  }

  return keyframes[keyframes.length - 1]!.year
}

export function resolveTimeLayer(
  manifest: SceneManifestEntry[],
  timeMs: number,
  narrative: NarrativeOverlayState | null,
  approvedPeople: ApprovedPerson[],
): TimeLayerState {
  const stats = getDocumentaryStats()
  const { earliestYear } = stats
  const endYear = presentYear()

  if (timeMs < TIME_LAYER_VISIBLE_FROM_MS) {
    return { mode: 'hidden', opacity: 0, rangeStart: earliestYear, rangeEnd: endYear }
  }

  const subtleOpacity = timeMs < 18_000 ? Math.min(1, (timeMs - TIME_LAYER_VISIBLE_FROM_MS) / 4_000) : 0.72
  const keyframes = collectStoryYearKeyframes(manifest)
  let scriptYear = interpolateScriptYear(timeMs, keyframes)

  const narrativeYear = narrative?.date ? parseYear(narrative.date) : null
  if (narrativeYear != null) {
    scriptYear = narrativeYear
  }

  const activePerson = approvedPeople.find((p) => narrative?.title === p.displayName)
  const personYear = activePerson ? parseYear(activePerson.year) : null
  if (personYear != null) {
    scriptYear = personYear
  }

  const span = Math.max(1, endYear - earliestYear)
  const playheadRatio = Math.min(1, Math.max(0, (scriptYear - earliestYear) / span))

  return {
    mode: 'subtle',
    opacity: subtleOpacity,
    rangeStart: earliestYear,
    rangeEnd: endYear,
    activeYear: scriptYear,
    activePerson: activePerson?.displayName,
    playheadRatio,
  }
}

/** @internal test helper */
export function storyYearAtTime(manifest: SceneManifestEntry[], timeMs: number): number {
  return interpolateScriptYear(timeMs, collectStoryYearKeyframes(manifest))
}
