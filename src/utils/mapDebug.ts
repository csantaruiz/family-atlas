/** Dev-only map debug overlay — add ?mapDebug=1 to the URL. */
export const MAP_DEBUG =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('mapDebug')
