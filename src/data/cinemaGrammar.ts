import type { DocumentaryScene, DocumentaryVisualType } from '../types/documentary'

export function sceneShowsAtlas(scene: DocumentaryScene): boolean {
  return scene.visual === 'atlas-orientation'
}

export function isCinematicScene(scene: DocumentaryScene): boolean {
  return !sceneShowsAtlas(scene)
}

export function sceneTypeLabel(visual: DocumentaryVisualType): string {
  switch (visual) {
    case 'title-card':
      return 'Title'
    case 'historical-map':
      return 'Map'
    case 'document':
      return 'Document'
    case 'portrait':
      return 'Portrait'
    case 'atlas-orientation':
      return 'Atlas'
  }
}

export function shouldShowNarration(scene: DocumentaryScene): boolean {
  if (scene.visual === 'historical-map' || scene.visual === 'document' || scene.visual === 'portrait') {
    return false
  }
  return Boolean(scene.narration || scene.lines?.length)
}
