import { OPEN_GEDCOM_IMPORT_STATUSES, type GedcomImportStatus } from './constants'

export type ImportChecksumRow = {
  atlasId: string
  checksum: string
  status: GedcomImportStatus
  id: string
}

export function findDuplicateOpenImport(
  existing: ImportChecksumRow[],
  atlasId: string,
  checksum: string,
): ImportChecksumRow | null {
  return (
    existing.find(
      (row) =>
        row.atlasId === atlasId &&
        row.checksum === checksum &&
        OPEN_GEDCOM_IMPORT_STATUSES.includes(row.status),
    ) ?? null
  )
}
