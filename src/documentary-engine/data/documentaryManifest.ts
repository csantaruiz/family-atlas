import { getDocumentaryStats } from '../../data/documentaryStats'
import type { SceneManifestEntry } from '../types/manifest'

const stats = getDocumentaryStats()

const DISSOLVE = { in: 'dissolve' as const, out: 'dissolve' as const, durationMs: 1400 }
const FADE = { in: 'fade' as const, out: 'fade' as const, durationMs: 1200 }

/**
 * V2.4 manifest — first 60 seconds rebuilt for single overlay + screen-space labels.
 */
export const DOCUMENTARY_MANIFEST: SceneManifestEntry[] = [
  // ── OPENING (0:00–0:08) ──
  {
    id: 'opening',
    title: 'Opening',
    chapter: 'Opening',
    narrationStartMs: 0,
    narrationEndMs: 8_000,
    sceneType: 'world-establishing',
    choreography: {
      cameraRelation: 'continue-camera',
      geographicScale: 'world',
      approvedPeople: [],
      narrativeOverlay: {
        title: 'Every family leaves a trail.',
        start: 0.2,
        end: 0.95,
      },
    },
    transition: FADE,
  },

  // ── TIME ORIENTATION (0:08–0:18) — time layer only, no narrative ──
  {
    id: 'opening-time',
    title: 'Span of Time',
    chapter: 'Opening',
    narrationStartMs: 8_000,
    narrationEndMs: 18_000,
    sceneType: 'world-establishing',
    choreography: {
      cameraRelation: 'hold',
      geographicScale: 'world',
      holdCamera: true,
      approvedPeople: [],
    },
    transition: FADE,
  },

  // ── BRITAIN (0:18–0:28) ──
  {
    id: 'britain',
    title: 'Britain',
    chapter: 'England',
    narrationStartMs: 18_000,
    narrationEndMs: 28_000,
    sceneType: 'world-establishing',
    choreography: {
      cameraRelation: 'continue-camera',
      geographicScale: 'continental',
      focusPlaceIds: ['britain'],
      activePlaceId: 'britain',
      approvedPeople: [],
      narrativeOverlay: {
        insight: 'A story that begins in Britain.',
        start: 0.2,
        end: 0.88,
      },
    },
    transition: DISSOLVE,
  },

  // ── ENGLAND (0:28–0:44) — map label only; holds through Lowndes cue ──
  {
    id: 'england',
    title: 'England',
    chapter: 'England',
    narrationStartMs: 28_000,
    narrationEndMs: 44_000,
    sceneType: 'country-reveal',
    choreography: {
      cameraRelation: 'continue-camera',
      geographicScale: 'country',
      focusPlaceIds: ['england'],
      activePlaceId: 'england',
      approvedPeople: [],
    },
    transition: DISSOLVE,
  },

  // ── GAWSWORTH — WILLIAM LOWNDES (0:44–0:52) — cue: lowndes ──
  {
    id: 'gawsworth-william',
    title: 'William Lowndes',
    chapter: 'Origins in Cheshire',
    narrationStartMs: 44_000,
    narrationEndMs: 52_000,
    sceneType: 'local-place',
    location: 'Gawsworth, Cheshire',
    people: ['I18150788585'],
    choreography: {
      cameraRelation: 'continue-camera',
      geographicScale: 'regional',
      focusPlaceIds: ['gawsworth'],
      activePlaceId: 'gawsworth',
      approvedPeople: [
        {
          personId: 'I18150788585',
          displayName: 'William Lowndes',
          role: 'active',
          year: 1473,
          placeId: 'gawsworth',
          start: 0.12,
          end: 0.92,
        },
      ],
    },
    transition: DISSOLVE,
  },

  // ── HOLD (0:52–0:58) — map only ──
  {
    id: 'cheshire-hold',
    title: 'Cheshire',
    chapter: 'Origins in Cheshire',
    narrationStartMs: 52_000,
    narrationEndMs: 58_000,
    sceneType: 'generational-continuity',
    location: 'Gawsworth, Cheshire',
    choreography: {
      cameraRelation: 'hold',
      geographicScale: 'regional',
      focusPlaceIds: ['gawsworth'],
      activePlaceId: 'gawsworth',
      holdCamera: true,
      approvedPeople: [],
    },
    transition: DISSOLVE,
  },

  // ── CHESHIRE COUNTY (0:58–1:06) — Gawsworth → Cheshire map ──
  {
    id: 'cheshire-records',
    title: 'Cheshire',
    chapter: 'Origins in Cheshire',
    narrationStartMs: 58_000,
    narrationEndMs: 66_000,
    sceneType: 'region-reveal',
    location: 'Cheshire, England',
    choreography: {
      cameraRelation: 'continue-camera',
      geographicScale: 'regional',
      focusPlaceIds: ['cheshire'],
      activePlaceId: 'cheshire',
      approvedPeople: [],
      narrativeOverlay: {
        insight: 'The earliest surviving thread.',
        start: 0.15,
        end: 0.9,
      },
    },
    transition: DISSOLVE,
  },

  // ── FIVE CENTURIES (1:06–1:18) — cue: cheshire_map ──
  {
    id: 'cheshire-timeline',
    title: 'Five Centuries',
    chapter: 'Origins in Cheshire',
    narrationStartMs: 66_000,
    narrationEndMs: 78_000,
    sceneType: 'timeline-orientation',
    timelineWindow: { start: 1465, end: 1590, label: 'Five centuries' },
    choreography: {
      cameraRelation: 'zoom-out',
      geographicScale: 'regional',
      focusPlaceIds: ['cheshire'],
      activePlaceId: 'cheshire',
      visiblePlaceIds: ['cheshire', 'gawsworth'],
      branch: 'british',
      approvedPeople: [],
      narrativeOverlay: {
        insight: 'Five centuries in time',
        start: 0.2,
        end: 0.75,
      },
    },
    transition: DISSOLVE,
  },

  // ── BRIDGE (1:18–1:34) — ease out of Cheshire before Spain branch ──
  {
    id: 'cheshire-bridge',
    title: 'Leaving Cheshire',
    chapter: 'Origins in Cheshire',
    narrationStartMs: 78_000,
    narrationEndMs: 94_000,
    sceneType: 'generational-continuity',
    location: 'Cheshire, England',
    choreography: {
      cameraRelation: 'zoom-out',
      geographicScale: 'continental',
      focusPlaceIds: ['cheshire', 'britain'],
      activePlaceId: 'cheshire',
      visiblePlaceIds: ['cheshire', 'gawsworth', 'britain'],
      branch: 'british',
      approvedPeople: [],
    },
    transition: DISSOLVE,
  },

  // ── SPAIN (1:34–2:00) — cue: spain ──
  {
    id: 'spain-branch',
    title: 'Spain',
    chapter: 'Spain & Chihuahua',
    narrationStartMs: 94_000,
    narrationEndMs: 120_000,
    sceneType: 'branch-transition',
    location: 'Spain',
    choreography: {
      cameraRelation: 'chapter-transition',
      geographicScale: 'country',
      focusPlaceIds: ['spain'],
      activePlaceId: 'spain',
      visiblePlaceIds: ['spain'],
      branch: 'spanish-mexican',
      approvedPeople: [],
      narrativeOverlay: {
        subtitle: 'Spain',
        insight: 'The trail continues across the sea',
        start: 0.15,
        end: 0.88,
      },
    },
    transition: DISSOLVE,
  },

  // ── CHIHUAHUA (2:00–2:15) — cue: chihuahua ──
  {
    id: 'chihuahua-arrival',
    title: 'Chihuahua',
    chapter: 'Spain & Chihuahua',
    narrationStartMs: 120_000,
    narrationEndMs: 135_000,
    sceneType: 'region-reveal',
    location: 'Chihuahua, Mexico',
    choreography: {
      cameraRelation: 'fit-route',
      geographicScale: 'regional',
      focusPlaceIds: ['spain', 'chihuahua'],
      activePlaceId: 'chihuahua',
      visiblePlaceIds: ['chihuahua'],
      branch: 'spanish-mexican',
      routes: [{ fromId: 'spain', toId: 'chihuahua', evidence: 'branch', drawAfter: 0.12 }],
      approvedPeople: [],
      narrativeOverlay: {
        subtitle: 'Chihuahua',
        insight: 'Northern Mexico — branch transition',
        start: 0.35,
        end: 0.92,
      },
    },
    transition: DISSOLVE,
  },

  // ── OJINAGA (2:15–2:30) ──
  {
    id: 'ojinaga-town',
    title: 'Ojinaga',
    chapter: 'Spain & Chihuahua',
    narrationStartMs: 135_000,
    narrationEndMs: 150_000,
    sceneType: 'local-place',
    location: 'Ojinaga, Chihuahua',
    choreography: {
      cameraRelation: 'continue-camera',
      geographicScale: 'regional',
      focusPlaceIds: ['ojinaga'],
      activePlaceId: 'ojinaga',
      visiblePlaceIds: ['chihuahua', 'ojinaga'],
      branch: 'spanish-mexican',
      approvedPeople: [],
      narrativeOverlay: {
        subtitle: 'Ojinaga',
        start: 0.15,
        end: 0.85,
      },
    },
    transition: DISSOLVE,
  },
  {
    id: 'migration-border',
    title: 'El Paso',
    chapter: 'Migration',
    narrationStartMs: 150_000,
    narrationEndMs: 168_000,
    sceneType: 'migration',
    location: 'Ojinaga to El Paso',
    choreography: {
      cameraRelation: 'fit-route',
      geographicScale: 'regional',
      focusPlaceIds: ['ojinaga', 'el-paso'],
      activePlaceId: 'el-paso',
      visiblePlaceIds: ['ojinaga', 'el-paso'],
      routes: [{ fromId: 'ojinaga', toId: 'el-paso', evidence: 'confirmed', drawAfter: 0.2 }],
      branch: 'spanish-mexican',
      approvedPeople: [],
      narrativeOverlay: {
        insight: 'One life crossing the border',
        start: 0.35,
        end: 0.82,
      },
    },
    transition: DISSOLVE,
  },
  {
    id: 'migration-el-paso',
    title: 'El Paso',
    chapter: 'Migration',
    narrationStartMs: 168_000,
    narrationEndMs: 188_000,
    sceneType: 'local-place',
    location: 'El Paso, Texas',
    choreography: {
      cameraRelation: 'continue-camera',
      geographicScale: 'regional',
      focusPlaceIds: ['el-paso'],
      activePlaceId: 'el-paso',
      visiblePlaceIds: ['el-paso'],
      branch: 'spanish-mexican',
      approvedPeople: [],
      narrativeOverlay: { subtitle: 'El Paso, Texas', start: 0.12, end: 0.85 },
    },
    transition: DISSOLVE,
  },
  {
    id: 'migration-california',
    title: 'California',
    chapter: 'Migration',
    narrationStartMs: 188_000,
    narrationEndMs: 210_000,
    sceneType: 'migration',
    location: 'California',
    choreography: {
      cameraRelation: 'fit-route',
      geographicScale: 'regional',
      focusPlaceIds: ['el-paso', 'california'],
      activePlaceId: 'california',
      visiblePlaceIds: ['el-paso', 'california'],
      routes: [{ fromId: 'el-paso', toId: 'california', evidence: 'generational', drawAfter: 0.15 }],
      approvedPeople: [],
      narrativeOverlay: {
        insight: 'Westward — toward the Pacific',
        start: 0.35,
        end: 0.85,
      },
    },
    transition: DISSOLVE,
  },
  {
    id: 'convergence-threads',
    title: 'Convergence',
    chapter: 'Convergence',
    narrationStartMs: 210_000,
    narrationEndMs: 230_000,
    sceneType: 'branch-convergence',
    location: 'United States',
    choreography: {
      cameraRelation: 'hold',
      geographicScale: 'continental',
      focusPlaceIds: ['england', 'chihuahua', 'california'],
      activePlaceId: 'california',
      visiblePlaceIds: ['england', 'chihuahua', 'california'],
      holdCamera: true,
      approvedPeople: [],
      narrativeOverlay: {
        insight: 'Separate histories begin to converge',
        start: 0.2,
        end: 0.88,
      },
    },
    transition: DISSOLVE,
  },
  {
    id: 'convergence-present',
    title: 'Present Day',
    chapter: 'Convergence',
    narrationStartMs: 230_000,
    narrationEndMs: 250_000,
    sceneType: 'present-day-arrival',
    location: 'Santa Clara, California',
    choreography: {
      cameraRelation: 'hold',
      geographicScale: 'continental',
      focusPlaceIds: ['santa-clara'],
      activePlaceId: 'santa-clara',
      visiblePlaceIds: ['santa-clara'],
      holdCamera: true,
      branch: 'eastern-us',
      approvedPeople: [],
      narrativeOverlay: {
        subtitle: 'California',
        insight: 'Late twentieth century',
        start: 0.2,
        end: 0.82,
      },
    },
    transition: DISSOLVE,
  },
  {
    id: 'atlas-timeline',
    title: 'The Atlas',
    chapter: 'Enter the Atlas',
    narrationStartMs: 250_000,
    narrationEndMs: 280_000,
    sceneType: 'timeline-orientation',
    timelineWindow: { start: stats.earliestYear, end: new Date().getFullYear(), label: 'The full family span' },
    choreography: {
      cameraRelation: 'hold',
      geographicScale: 'world',
      focusPlaceIds: ['gawsworth', 'chihuahua', 'santa-clara'],
      visiblePlaceIds: ['gawsworth', 'chihuahua', 'santa-clara'],
      holdCamera: true,
      approvedPeople: [],
      narrativeOverlay: {
        insight: 'Every generation — waiting in the timeline',
        start: 0.2,
        end: 0.8,
      },
    },
    transition: DISSOLVE,
  },
  {
    id: 'atlas-closing',
    title: 'Enter the Atlas',
    chapter: 'Enter the Atlas',
    narrationStartMs: 280_000,
    narrationEndMs: 387_000,
    sceneType: 'closing',
    caption: 'Explore the Atlas — your family history awaits.',
    choreography: {
      cameraRelation: 'hold',
      geographicScale: 'world',
      focusPlaceIds: ['santa-clara'],
      visiblePlaceIds: ['santa-clara'],
      holdCamera: true,
      approvedPeople: [],
      narrativeOverlay: {
        title: 'Explore the Atlas',
        insight: 'Your family history awaits.',
        start: 0.2,
        end: 0.92,
      },
    },
    transition: FADE,
  },
]

export const DOCUMENTARY_MANIFEST_END_MS =
  DOCUMENTARY_MANIFEST[DOCUMENTARY_MANIFEST.length - 1]?.narrationEndMs ?? 387_000
