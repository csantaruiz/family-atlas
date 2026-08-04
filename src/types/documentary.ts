export type DocumentaryPhase =
  | 'idle'
  | 'welcome'
  | 'transition'
  | 'playing'
  | 'ending'
  | 'complete'

/** Five storytelling scene types — Atlas appears only for atlas-orientation. */
export type DocumentaryVisualType =
  | 'title-card'
  | 'historical-map'
  | 'document'
  | 'portrait'
  | 'atlas-orientation'

export type DocumentarySection = {
  id: string
  title: string
}

export type DocumentaryCamera = {
  center: number
  span: number
  animateMs?: number
}

export type DocumentaryKenBurns = {
  scaleStart?: number
  scaleEnd?: number
  xStart?: number
  xEnd?: number
  yStart?: number
  yEnd?: number
}

export type DocumentaryMapLocation = {
  x: number
  y: number
  label?: string
  delayMs?: number
}

export type DocumentaryVisualConfig = {
  /** Ken Burns pan/zoom for maps, documents, and portraits. */
  kenBurns?: DocumentaryKenBurns
  /** Camera glide — only used during atlas-orientation scenes. */
  camera?: DocumentaryCamera
  mapImage?: string
  mapImageAlt?: string
  mapCredit?: string
  mapPosition?: string
  mapHighlightYears?: { start: number; end: number } | null
  mapLocations?: DocumentaryMapLocation[]
  /** SVG path `d` attributes for migration routes. */
  migrationRoutes?: string[]
  anchorPersonId?: string | null
  anchorYear?: number | null
  portraitPersonId?: string
  portraitCaption?: string
  portraitSubcaption?: string
  revealNameAfterMs?: number
  documentTitle?: string
  documentLines?: string[]
  highlightPersonId?: string | null
  thinkingFocusRange?: { start: number; end: number } | null
}

export type DocumentaryScene = {
  id: string
  sectionId: string
  sectionTitle?: string
  visual: DocumentaryVisualType
  durationMs: number
  narration?: string
  lines?: string[]
  lineIntervalMs?: number
  visualConfig?: DocumentaryVisualConfig
}

export type DocumentaryStats = {
  generations: number
  yearSpan: number
  earliestYear: number
  latestYear: number
  countries: number
  documentedMembers: number
  migrations: number
  historicalEras: number
  countryNames: string[]
}

export type DocumentarySceneProgress = {
  elapsedMs: number
  durationMs: number
  ratio: number
}
