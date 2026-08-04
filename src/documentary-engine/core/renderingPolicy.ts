/** V2.4 rendering freeze — re-enable per feature after first 60s is clean. */
export const DOCUMENTARY_V24 = {
  /** Migration arcs render when choreographed or on the wide closing map. */
  disableRoutes: false,
  /** No expanded timeline panel. */
  disableTimelineExpansion: true,
  /** No insight / eyebrow / secondary editorial lines in narrative overlay. */
  disableInsightOverlays: true,
  /** At most one geographic label (active place only). */
  singleGeoLabel: true,
  /** Narrative must not repeat the active map label text. */
  dedupePlaceNames: true,
} as const

export const FIRST_MINUTE_MS = 60_000

export function isFirstMinute(timeMs: number): boolean {
  return timeMs < FIRST_MINUTE_MS
}
