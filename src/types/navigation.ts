export type AppView = 'journey' | 'people' | 'tree' | 'map' | 'about'

export const VIEW_PATHS: Record<AppView, string> = {
  journey: '/journey',
  people: '/people',
  tree: '/tree',
  map: '/map',
  about: '/about',
}

export const PATH_TO_VIEW: Record<string, AppView> = {
  '/': 'journey',
  '/journey': 'journey',
  '/people': 'people',
  '/tree': 'tree',
  '/map': 'map',
  '/about': 'about',
}

export function viewFromPath(path: string): AppView {
  const normalized = path.replace(/^#/, '').split('?')[0] || '/journey'
  return PATH_TO_VIEW[normalized] ?? 'journey'
}
