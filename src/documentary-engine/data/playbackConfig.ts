/** Silent dramatic hold before narration and scene motion begin. */
export const DOCUMENTARY_PREROLL_MS = 3_000

/** Crossfade between ending screen and Atlas UI. */
export const DOCUMENTARY_UI_FADE_MS = 1_400

/** Intro screen fades out to black. */
export const DOCUMENTARY_ENTER_PLAYBACK_OUT_MS = 1_200

/** Hold on black before the documentary appears. */
export const DOCUMENTARY_ENTER_PLAYBACK_BLACK_MS = 500

/** Documentary fades in from black. */
export const DOCUMENTARY_ENTER_PLAYBACK_IN_MS = 1_800

export const DOCUMENTARY_ENTER_PLAYBACK_TOTAL_MS =
  DOCUMENTARY_ENTER_PLAYBACK_OUT_MS +
  DOCUMENTARY_ENTER_PLAYBACK_BLACK_MS +
  DOCUMENTARY_ENTER_PLAYBACK_IN_MS

/** Ending/welcome fades out to black before Atlas. */
export const DOCUMENTARY_ENTER_ATLAS_OUT_MS = 220

/** Hold on black before the Atlas appears. */
export const DOCUMENTARY_ENTER_ATLAS_BLACK_MS = 60

/** Atlas fades in from black. */
export const DOCUMENTARY_ENTER_ATLAS_IN_MS = 280

export const DOCUMENTARY_ENTER_ATLAS_TOTAL_MS =
  DOCUMENTARY_ENTER_ATLAS_OUT_MS +
  DOCUMENTARY_ENTER_ATLAS_BLACK_MS +
  DOCUMENTARY_ENTER_ATLAS_IN_MS

/** Delay before Atlas/overlay reveal begins (fade-out + black hold). */
export const DOCUMENTARY_ENTER_ATLAS_REVEAL_DELAY_MS =
  DOCUMENTARY_ENTER_ATLAS_OUT_MS + DOCUMENTARY_ENTER_ATLAS_BLACK_MS

/** ViewBox catch-up rate — lower values = slower, smoother camera moves. */
export const DOCUMENTARY_CAMERA_SMOOTHNESS = 2.0

/** Max catch-up rate for long cross-continental moves (still eased, never instant). */
export const DOCUMENTARY_CAMERA_MAX_SMOOTHNESS = 5.5

/** Hard cap on documentary map zoom — prevents tight local framing. */
export const DOCUMENTARY_MAX_CAMERA_SCALE = 2.35

/** Max zoom-in delta per scene target relative to the previous camera. */
export const DOCUMENTARY_MAX_SCALE_DELTA = 0.28

/** Scale moves slower than pan during interpolation (higher = gentler zoom). */
export const DOCUMENTARY_SCALE_INTERP_EXPONENT = 1.45

/** ViewBox width/height catch-up vs pan — lower = subtler zoom motion. */
export const DOCUMENTARY_VIEWBOX_ZOOM_LERP = 0.38

/** Narrative on-screen text — quick enter, 5s hold, slow exit. */
export const NARRATIVE_FADE_IN_MS = 600
export const NARRATIVE_HOLD_MS = 5_000
export const NARRATIVE_FADE_OUT_MS = 4_500
export const NARRATIVE_OVERLAY_LIFECYCLE_MS =
  NARRATIVE_FADE_IN_MS + NARRATIVE_HOLD_MS + NARRATIVE_FADE_OUT_MS
