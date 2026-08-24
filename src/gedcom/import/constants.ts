export const GEDCOM_IMPORT_STATUSES = [
  'uploaded',
  'processing',
  'ready',
  'failed',
  'active',
  'superseded',
] as const
export type GedcomImportStatus = (typeof GEDCOM_IMPORT_STATUSES)[number]

export const OPEN_GEDCOM_IMPORT_STATUSES: readonly GedcomImportStatus[] = [
  'uploaded',
  'processing',
  'ready',
]

export const MAX_GEDCOM_BYTES = 4 * 1024 * 1024
export const SEED_IMPORT_ID = 'seed'
