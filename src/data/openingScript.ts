import { familyDatabase } from './familyDatabase'
import type { DocumentaryCamera, DocumentaryScene, DocumentarySection } from '../types/documentary'

export const OPENING_SECTIONS: DocumentarySection[] = [
  { id: 'opening', title: 'Opening' },
  { id: 'origins', title: 'Origins' },
]

const { earliestYear, earliestName } = familyDatabase.stats

const originsCamera = (span = 175, animateMs = 4800): DocumentaryCamera => ({
  center: 1510,
  span,
  animateMs,
})

const ENGLISH_COAST_MAP = {
  mapImage:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Clement_Reid_-_Submerged_forest.jpg/960px-Clement_Reid_-_Submerged_forest.jpg',
  mapImageAlt: 'Historic English coastline, early twentieth-century illustration',
  mapCredit: 'Clement Reid / Wikimedia Commons (public domain).',
  mapPosition: 'center 52%',
}

const CHESHIRE_MAP = {
  mapImage:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/John_Speed_Cheshire_1610.jpg/960px-John_Speed_Cheshire_1610.jpg',
  mapImageAlt: 'Historic map of Cheshire by John Speed, 1610',
  mapCredit: 'John Speed / Wikimedia Commons (public domain).',
  mapPosition: 'center 48%',
}

const GAWSWORTH = { x: 62, y: 58, label: 'Gawsworth', delayMs: 1200 }
const CHESHIRE_CENTER = { x: 48, y: 52, label: 'Cheshire', delayMs: 800 }

const DEFAULT_MIGRATION_ROUTES = [
  'M120 420 C 260 340, 380 300, 520 270 S 720 230, 860 210',
  'M240 520 C 380 460, 520 410, 680 380',
]

/**
 * Ken Burns documentary opening — visual balance (~103s):
 * Maps 40% · Documents 25% · Portraits 20% · Atlas 10% · Title cards 5%
 *
 * Flow: title → map → document → portrait → map → atlas (brief) → end
 */
export const OPENING_SCENES: DocumentaryScene[] = [
  // ── Title cards (~5%) ──
  {
    id: 'open-title-trail',
    sectionId: 'opening',
    visual: 'title-card',
    durationMs: 2000,
    narration: 'Every family leaves a trail.',
  },
  {
    id: 'open-title-fade',
    sectionId: 'opening',
    visual: 'title-card',
    durationMs: 2000,
    narration: 'Most of those trails fade.',
  },

  // ── Maps (~40%) ──
  {
    id: 'map-english-coast',
    sectionId: 'opening',
    visual: 'historical-map',
    durationMs: 8000,
    visualConfig: {
      ...ENGLISH_COAST_MAP,
      kenBurns: { scaleStart: 1.05, scaleEnd: 1.22, xStart: 2, xEnd: -6, yStart: 1, yEnd: -4 },
      mapLocations: [{ x: 44, y: 46, label: 'England', delayMs: 600 }],
      migrationRoutes: [DEFAULT_MIGRATION_ROUTES[0]],
    },
  },
  {
    id: 'map-cheshire-wide',
    sectionId: 'opening',
    visual: 'historical-map',
    durationMs: 8000,
    visualConfig: {
      ...CHESHIRE_MAP,
      kenBurns: { scaleStart: 1, scaleEnd: 1.18, xStart: 4, xEnd: -5, yStart: 2, yEnd: -3 },
      mapLocations: [CHESHIRE_CENTER],
      migrationRoutes: DEFAULT_MIGRATION_ROUTES,
    },
  },
  {
    id: 'map-gawsworth-bridge',
    sectionId: 'opening',
    visual: 'historical-map',
    durationMs: 6000,
    visualConfig: {
      ...CHESHIRE_MAP,
      kenBurns: { scaleStart: 1.14, scaleEnd: 1.28, xStart: -8, xEnd: -14, yStart: -4, yEnd: -8 },
      mapLocations: [GAWSWORTH],
    },
  },

  // ── Documents (~25%) ──
  {
    id: 'doc-parish-register',
    sectionId: 'opening',
    visual: 'document',
    durationMs: 13000,
    visualConfig: {
      documentTitle: 'Parish Register',
      documentLines: [
        'Passenger lists',
        'Military records',
        'Stories passed quietly onward',
      ],
      kenBurns: { scaleStart: 1, scaleEnd: 1.14, xStart: 3, xEnd: -8, yStart: 2, yEnd: -5 },
    },
  },
  {
    id: 'doc-cheshire-record',
    sectionId: 'origins',
    sectionTitle: 'Origins',
    visual: 'document',
    durationMs: 13000,
    visualConfig: {
      anchorPersonId: 'I18150788585',
      anchorYear: earliestYear,
      documentTitle: 'Cheshire Parish Record',
      documentLines: [
        'Peter Lowndes · b. 1493',
        'Gawsworth, Cheshire, England',
        'William Overton Lowndes · b. 1525',
      ],
      kenBurns: { scaleStart: 1.02, scaleEnd: 1.16, xStart: -2, xEnd: 6, yStart: 1, yEnd: -6 },
    },
  },

  // ── Portraits (~20%) ──
  {
    id: 'portrait-earliest',
    sectionId: 'origins',
    visual: 'portrait',
    durationMs: 11000,
    narration: `${earliestName} appears in the surviving record in ${earliestYear}.`,
    visualConfig: {
      portraitPersonId: 'I18150788585',
      portraitCaption: earliestName,
      portraitSubcaption: `Documented ${earliestYear}`,
      revealNameAfterMs: 3200,
      kenBurns: { scaleStart: 1, scaleEnd: 1.1, xStart: 0, xEnd: -2, yStart: 0, yEnd: -3 },
    },
  },
  {
    id: 'portrait-lineage',
    sectionId: 'origins',
    visual: 'portrait',
    durationMs: 10000,
    narration: 'Generation after generation — long before the modern world.',
    visualConfig: {
      portraitPersonId: 'I18150785925',
      portraitCaption: 'Peter Lowndes',
      portraitSubcaption: 'b. 1493 · Gawsworth',
      revealNameAfterMs: 2800,
      kenBurns: { scaleStart: 1.04, scaleEnd: 1.12, xStart: 2, xEnd: -3, yStart: 1, yEnd: -2 },
    },
  },

  // ── Maps (continued — migration connective tissue) ──
  {
    id: 'map-migration-routes',
    sectionId: 'origins',
    visual: 'historical-map',
    durationMs: 8000,
    visualConfig: {
      ...ENGLISH_COAST_MAP,
      kenBurns: { scaleStart: 1.08, scaleEnd: 1.24, xStart: -4, xEnd: -10, yStart: 0, yEnd: -5 },
      mapLocations: [
        { x: 38, y: 50, label: 'England', delayMs: 400 },
        { x: 72, y: 38, label: 'Across the sea', delayMs: 2200 },
      ],
      migrationRoutes: DEFAULT_MIGRATION_ROUTES,
    },
  },
  {
    id: 'map-lineage-geography',
    sectionId: 'origins',
    visual: 'historical-map',
    durationMs: 7000,
    visualConfig: {
      ...CHESHIRE_MAP,
      kenBurns: { scaleStart: 1, scaleEnd: 1.15, xStart: 6, xEnd: -4, yStart: 3, yEnd: -2 },
      mapLocations: [GAWSWORTH, { x: 54, y: 44, label: 'Cheshire', delayMs: 1400 }],
      migrationRoutes: [DEFAULT_MIGRATION_ROUTES[1]],
    },
  },
  {
    id: 'map-continental-bridge',
    sectionId: 'origins',
    visual: 'historical-map',
    durationMs: 5000,
    visualConfig: {
      ...ENGLISH_COAST_MAP,
      kenBurns: { scaleStart: 1.12, scaleEnd: 1.2, xStart: -6, xEnd: -12, yStart: -2, yEnd: -6 },
      migrationRoutes: DEFAULT_MIGRATION_ROUTES,
    },
  },

  // ── Title card ──
  {
    id: 'title-five-centuries',
    sectionId: 'origins',
    visual: 'title-card',
    durationMs: 2000,
    narration: 'More than five centuries — preserved in the Atlas.',
  },

  // ── Atlas orientation (~10%) ──
  {
    id: 'atlas-orientation',
    sectionId: 'origins',
    visual: 'atlas-orientation',
    durationMs: 10000,
    narration: 'The earliest generations — waiting in the timeline.',
    visualConfig: {
      camera: originsCamera(165, 6800),
      highlightPersonId: 'I18150788585',
      thinkingFocusRange: { start: 1465, end: 1585 },
      mapHighlightYears: { start: 1465, end: 1590 },
    },
  },
]

export const OPENING_TOTAL_MS = OPENING_SCENES.reduce((total, scene) => total + scene.durationMs, 0)

export function formatDocumentaryDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function sectionIndexForScene(sceneIndex: number): number {
  const scene = OPENING_SCENES[sceneIndex]
  if (!scene) return 0
  return OPENING_SECTIONS.findIndex((section) => section.id === scene.sectionId)
}

export function sceneProgress(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0
  return Math.min(1, Math.max(0, elapsedMs / durationMs))
}

/** Smooth fold/unfold envelope: rises 0→1 in first third, holds, falls in last quarter. */
export function revelationEnvelope(ratio: number, holdUntil = 0.72): number {
  if (ratio <= 0) return 0
  if (ratio < 0.22) return ratio / 0.22
  if (ratio < holdUntil) return 1
  if (ratio >= 1) return 0
  return 1 - (ratio - holdUntil) / (1 - holdUntil)
}
