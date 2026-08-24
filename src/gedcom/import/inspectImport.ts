import type { GedcomImportStatus } from './constants'
import { isPrivateImportPath } from './importPaths'
import type { CandidateBlocker } from './blockers'

export type InspectableGedcomImport = {
  id: string
  filename: string
  checksum: string
  byteSize: number
  status: GedcomImportStatus
  personCount: number | null
  familyCount: number | null
  createdAt: string
  processedAt: string | null
  errorCode: string | null
  errorMessage: string | null
  diffSummary: unknown
  reconciliationSummary: unknown
  blockers: CandidateBlocker[]
  identity?: unknown
  diffDetails?: unknown
  updatedPersonCount?: number
  storage: {
    gedcomPath: string
    snapshotPath: string | null
  }
}

export function updatedPersonCountFromDiff(diffDetails: unknown): number {
  const row = diffDetails && typeof diffDetails === 'object' ? (diffDetails as Record<string, unknown>) : null
  if (!row) return 0
  const ids = new Set<string>()
  for (const key of ['nameChanges', 'dateChanges', 'placeChanges', 'relationshipChanges']) {
    const list = row[key]
    if (!Array.isArray(list)) continue
    for (const item of list) {
      const current = item && typeof item === 'object' ? (item as Record<string, unknown>) : null
      const currentId = current?.currentId
      if (typeof currentId === 'string') ids.add(currentId)
    }
  }
  return ids.size
}

export function toInspectableImport(row: {
  id: string
  originalFilename: string
  checksum: string
  byteSize: number
  status: GedcomImportStatus
  personCount: number | null
  familyCount: number | null
  createdAt: string
  processedAt: string | null
  errorCode: string | null
  errorMessage: string | null
  diffSummary: unknown
  reconciliationSummary: unknown
  blockers: unknown
  identity?: unknown
  diffDetails?: unknown
  updatedPersonCount?: number
  gedcomPath: string
  snapshotPath: string | null
  atlasId: string
}): InspectableGedcomImport {
  const paths = `${row.gedcomPath}\n${row.snapshotPath ?? ''}`
  if (/https?:\/\//i.test(paths)) {
    throw new Error('Inspect payload must not include public URLs.')
  }
  if (!isPrivateImportPath(row.gedcomPath, row.atlasId)) {
    throw new Error('GEDCOM path must stay atlas-private.')
  }
  return {
    id: row.id,
    filename: row.originalFilename,
    checksum: row.checksum,
    byteSize: row.byteSize,
    status: row.status,
    personCount: row.personCount,
    familyCount: row.familyCount,
    createdAt: row.createdAt,
    processedAt: row.processedAt,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    diffSummary: row.diffSummary,
    reconciliationSummary: row.reconciliationSummary,
    blockers: Array.isArray(row.blockers) ? (row.blockers as CandidateBlocker[]) : [],
    identity: row.identity,
    diffDetails: row.diffDetails,
    updatedPersonCount: row.updatedPersonCount ?? updatedPersonCountFromDiff(row.diffDetails),
    storage: {
      gedcomPath: row.gedcomPath,
      snapshotPath: row.snapshotPath,
    },
  }
}
