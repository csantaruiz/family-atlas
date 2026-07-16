/** Temporary timeline markers for spacing demonstration. Remove when Timeline Engine is wired. */
export type PlaceholderMarker = {
  id: string
  label: string
  /** Horizontal position along the axis, 0–100 percent */
  position: number
  layer: 'family' | 'world'
  variant: 'minimal' | 'moderate'
}

export const placeholderMarkers: PlaceholderMarker[] = [
  { id: 'f1', label: '1892', position: 12, layer: 'family', variant: 'minimal' },
  { id: 'f2', label: 'Migration west', position: 28, layer: 'family', variant: 'moderate' },
  { id: 'f3', label: '1924', position: 42, layer: 'family', variant: 'minimal' },
  { id: 'f4', label: 'Ironworker', position: 55, layer: 'family', variant: 'moderate' },
  { id: 'f5', label: '1968', position: 72, layer: 'family', variant: 'minimal' },
  { id: 'w1', label: 'World War I', position: 22, layer: 'world', variant: 'moderate' },
  { id: 'w2', label: 'Great Depression', position: 38, layer: 'world', variant: 'moderate' },
  { id: 'w3', label: 'World War II', position: 58, layer: 'world', variant: 'moderate' },
]
