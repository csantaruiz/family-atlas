/** Dev-only landmark selection diagnostics — add ?landmarkDebug=1 to the URL. */
export const LANDMARK_DEBUG =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('landmarkDebug')

export type TemporalZone = 'left' | 'center' | 'right'

export type LandmarkDebugSnapshot = {
  visibleStart: number
  visibleEnd: number
  qualifyingByZone: Record<TemporalZone, number>
  selectedByZone: Record<TemporalZone, number>
  rejected: { eventId: string; reason: string; zone: TemporalZone }[]
  replacements: { fromZone: TemporalZone; toZone: TemporalZone; eventId: string }[]
}

let lastSnapshot: LandmarkDebugSnapshot | null = null

export function getLastLandmarkDebugSnapshot(): LandmarkDebugSnapshot | null {
  return lastSnapshot
}

export function reportLandmarkDebug(snapshot: LandmarkDebugSnapshot): void {
  lastSnapshot = snapshot
  if (!LANDMARK_DEBUG) return

  console.group('[landmarkSelection] viewport diagnostics')
  console.log('visible range', snapshot.visibleStart, '–', snapshot.visibleEnd)
  console.log('qualifying by zone', snapshot.qualifyingByZone)
  console.log('selected by zone', snapshot.selectedByZone)
  if (snapshot.rejected.length) console.table(snapshot.rejected)
  if (snapshot.replacements.length) console.table(snapshot.replacements)

  const zones: TemporalZone[] = ['left', 'center', 'right']
  for (const zone of zones) {
    if (snapshot.qualifyingByZone[zone] > 0 && snapshot.selectedByZone[zone] === 0) {
      console.warn(
        `[landmarkSelection] qualifying ${zone} events exist but none were selected — check spread or collision`,
      )
    }
  }
  console.groupEnd()
}
