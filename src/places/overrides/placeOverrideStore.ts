import type { PlaceOverrideRecord } from '../types'

/**
 * Production persistence for place overrides belongs in the Atlas database/backend.
 * This interface is the long-term contract; implementations are swappable.
 */
export interface PlaceOverrideStore {
  get(atlasId: string, fingerprint: string): Promise<PlaceOverrideRecord | null>
  listForAtlas(atlasId: string): Promise<PlaceOverrideRecord[]>
  save(record: PlaceOverrideRecord): Promise<void>
  delete(atlasId: string, overrideId: string): Promise<void>
}
