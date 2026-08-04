import { V3_LABELS, V3_PLACES } from './gedcomPlaces'
import type { CameraCue } from '../types'

/** Static camera cue list — first ~45 seconds. Centers match GEDCOM marker coords. */
export const CAMERA_CUES: CameraCue[] = [
  {
    id: 'world',
    time: 0,
    action: 'jump',
    center: V3_PLACES.world,
    zoom: 2.2,
    marker: null,
    label: null,
  },
  {
    id: 'britain',
    time: 12,
    action: 'fly',
    center: V3_PLACES.britain,
    zoom: 4.4,
    marker: V3_PLACES.britain,
    label: V3_LABELS.britain,
  },
  {
    id: 'cheshire',
    time: 25,
    action: 'fly',
    center: V3_PLACES.cheshire,
    zoom: 7.8,
    marker: V3_PLACES.cheshire,
    label: V3_LABELS.cheshire,
  },
  {
    id: 'gawsworth',
    time: 38,
    action: 'fly',
    center: V3_PLACES.gawsworth,
    zoom: 11.2,
    marker: V3_PLACES.gawsworth,
    label: V3_LABELS.gawsworth,
  },
]

export const POC_DURATION_SECONDS = 45

export function findActiveCameraCue(timeSeconds: number): CameraCue {
  let active = CAMERA_CUES[0]
  for (const cue of CAMERA_CUES) {
    if (timeSeconds >= cue.time) active = cue
    else break
  }
  return active
}
