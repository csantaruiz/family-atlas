import type { PlaceOverrideRecord } from '../types'

export type { PlaceOverrideRecord }

/** Temporary in-memory implementation for dev/test — not production persistence. */
export class InMemoryPlaceOverrideStore {
  private records = new Map<string, PlaceOverrideRecord>()

  async get(atlasId: string, fingerprint: string): Promise<PlaceOverrideRecord | null> {
    for (const record of this.records.values()) {
      if (record.atlasId === atlasId && record.fingerprint === fingerprint) return record
    }
    return null
  }

  async listForAtlas(atlasId: string): Promise<PlaceOverrideRecord[]> {
    return [...this.records.values()].filter((record) => record.atlasId === atlasId)
  }

  async save(record: PlaceOverrideRecord): Promise<void> {
    this.records.set(record.id, record)
  }

  async delete(atlasId: string, overrideId: string): Promise<void> {
    const record = this.records.get(overrideId)
    if (record?.atlasId === atlasId) this.records.delete(overrideId)
  }
}

export const devPlaceOverrideStore = new InMemoryPlaceOverrideStore()
