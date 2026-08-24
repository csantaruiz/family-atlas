import type { InspectableGedcomImport } from '../gedcom/import/inspectImport'
import type { CandidateBlocker } from '../gedcom/import/blockers'
import { updatedPersonCountFromDiff } from '../gedcom/import/inspectImport'

export type IdentityQuestion = {
  currentName: string
  candidateName: string
  currentLife: string
  candidateLife: string
}

export type CustomerChangePreview = {
  currentPeople: number
  candidatePeople: number
  added: number
  noLongerInFile: number
  updated: number
  exactMatches: number
  photosKept: number
  storiesKept: number
  filmKept: number
  placesKept: boolean
  needsHelp: number
  identityQuestions: IdentityQuestion[]
  canUpdate: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function keptCount(row: Record<string, unknown> | null): number {
  return num(row?.preserved) + num(row?.rebound)
}

function lifeLine(year: unknown, place: unknown): string {
  const yearText = typeof year === 'number' ? String(year) : ''
  const placeText = typeof place === 'string' ? place : ''
  return [yearText, placeText].filter(Boolean).join(' · ')
}

export function identityQuestionsFromInspect(
  blockers: CandidateBlocker[],
  identity: unknown,
): IdentityQuestion[] {
  const rows = Array.isArray(identity) ? identity : []
  const questions: IdentityQuestion[] = []
  for (const row of rows) {
    const item = asRecord(row)
    if (!item || item.tier !== 'ambiguous') continue
    questions.push({
      currentName: typeof item.currentName === 'string' ? item.currentName : 'Someone in your Atlas',
      candidateName: typeof item.candidateName === 'string' ? item.candidateName : 'Someone in the new file',
      currentLife: lifeLine(item.currentBirthYear, item.currentBirthPlace),
      candidateLife: lifeLine(item.candidateBirthYear, item.candidateBirthPlace),
    })
  }
  if (questions.length) return questions
  return blockers
    .filter((row) => row.code === 'ambiguous_identity_with_content')
    .map((row) => ({
      currentName: row.detail.split(' needs ')[0] || 'Someone in your Atlas',
      candidateName: 'Someone in the new file',
      currentLife: '',
      candidateLife: '',
    }))
}

export function customerPreviewFromInspect(
  inspect: InspectableGedcomImport,
  currentPeople: number,
): CustomerChangePreview {
  const diff = asRecord(inspect.diffSummary)
  const recon = asRecord(inspect.reconciliationSummary)
  const media = asRecord(recon?.media)
  const stories = asRecord(recon?.stories)
  const documentary = asRecord(recon?.documentary)
  const places = asRecord(recon?.placeOverrides)
  const identityCounts = asRecord(recon?.identity)
  const extra = inspect as InspectableGedcomImport & {
    identity?: unknown
    diffDetails?: unknown
    updatedPersonCount?: number
  }
  const added = num(diff?.addedPeople)
  const removed = num(diff?.removedPeople)
  const updated =
    typeof extra.updatedPersonCount === 'number'
      ? extra.updatedPersonCount
      : updatedPersonCountFromDiff(extra.diffDetails)
  const needsHelp = inspect.blockers.length
  return {
    currentPeople: num(diff?.currentPeople) || currentPeople,
    candidatePeople: inspect.personCount ?? (num(diff?.candidatePeople) || currentPeople),
    added,
    noLongerInFile: removed,
    updated,
    exactMatches: num(identityCounts?.exact),
    photosKept: keptCount(media),
    storiesKept: keptCount(stories),
    filmKept: keptCount(documentary),
    placesKept: keptCount(places) > 0 || num(places?.orphaned) === 0,
    needsHelp,
    identityQuestions: identityQuestionsFromInspect(inspect.blockers, extra.identity),
    canUpdate: inspect.status === 'ready' && inspect.blockers.length === 0,
  }
}
