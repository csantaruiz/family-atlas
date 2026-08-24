/** Sentinel import id until Phase 2D.3B introduces gedcom_imports. */
export const SEED_IMPORT_ID = 'seed'

export const ATLAS_PERSON_STATUSES = ['active', 'source_removed', 'needs_review'] as const
export type AtlasPersonStatus = (typeof ATLAS_PERSON_STATUSES)[number]

export const ALIAS_MATCH_KINDS = ['exact', 'strong_match', 'seeded', 'manual'] as const
export type AliasMatchKind = (typeof ALIAS_MATCH_KINDS)[number]
