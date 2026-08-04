import type { PersonImage } from '../types'

/**
 * Curated family portraits that ship with the app (GitHub → Vercel).
 *
 * Drop files here named by person id:
 *   src/assets/portraits/people/I112185241264.jpg
 *
 * Supported: .jpg .jpeg .png .webp
 * Person ids are the GEDCOM-style ids on each person (e.g. Pedro G Luna → I112185241264).
 */
const portraitModules = import.meta.glob('../assets/portraits/people/*.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

function personIdFromModulePath(path: string): string | null {
  const file = path.split('/').pop()
  if (!file) return null
  const id = file.replace(/\.(jpe?g|png|webp)$/i, '')
  return id || null
}

const CURATED_BY_ID: Record<string, string> = {}
for (const [path, src] of Object.entries(portraitModules)) {
  const id = personIdFromModulePath(path)
  if (id) CURATED_BY_ID[id] = src
}

export function getCuratedPersonPortrait(
  personId: string,
  personName: string,
): PersonImage | undefined {
  const src = CURATED_BY_ID[personId]
  if (!src) return undefined
  return {
    src,
    alt: `Portrait of ${personName}`,
  }
}

export function curatedPersonPortraitIds(): string[] {
  return Object.keys(CURATED_BY_ID)
}
