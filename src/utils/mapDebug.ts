/** Dev-only map debug overlay — add ?mapDebug=1 to the URL. */
export const MAP_DEBUG =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('mapDebug')

/** Compact camera HUD — add ?mapCamera=1. Never shown in production builds. */
export const MAP_CAMERA_DEBUG =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('mapCamera')
