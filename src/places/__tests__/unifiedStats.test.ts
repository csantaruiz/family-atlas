import { describe, expect, it } from 'vitest'
import { familyDatabase } from '../../data/familyDatabase'
import { familyMarriages } from '../../data/familyMarriages'
import { runAtlasHealthCheck } from '../../atlas-health/healthCheck'
import { buildPlaceResolutionRecord, collectUniquePlaceStrings } from '../../atlas-health/placeResolution'

/** Emits distribution counts for Phase 2A completion reports. */
describe('unified shadow stats (reporting)', () => {
  const places = collectUniquePlaceStrings({
    people: familyDatabase.people,
    marriagePlaces: familyMarriages.map((m) => m.place),
  })

  it('records 166-place distribution from health check', () => {
    const health = runAtlasHealthCheck()
    expect(health.places.uniquePlaceStrings).toBe(166)
    expect(health.places.unifiedRegressions).toBe(0)

    // Pin expected distribution band — update if registry grows materially.
    const resolved = health.places.unifiedResolved
    const coarse = health.places.unifiedCoarse
    const ambiguous = health.places.unifiedAmbiguous
    const unresolved = health.places.unifiedUnresolved

    expect(resolved + coarse + ambiguous + unresolved).toBe(166)

    // Distribution snapshot (Phase 2A shadow — update if material registry change).
    expect({ resolved, coarse, ambiguous, unresolved }).toMatchInlineSnapshot(`
      {
        "ambiguous": 2,
        "coarse": 102,
        "resolved": 54,
        "unresolved": 8,
      }
    `)
    expect(health.places.unifiedCorrections).toMatchInlineSnapshot(`23`)
  })

  it('snapshots unified unresolved place strings', () => {
    const records = places.map((p) => buildPlaceResolutionRecord(p))
    const unresolved = records
      .filter((r) => r.unified.status === 'unresolved')
      .map((r) => r.original)
      .sort()
    expect(unresolved).toMatchInlineSnapshot(`
      [
        "Anderr",
        "Iceland",
        "Minshull",
        "Not Located - Appears in 1871 Census",
        "Not, Graz-Umgebung, Styria, Austria",
        "Reinos de Castilla, Espagne",
        "Rode, Brabant Wallon, Belgium",
        "Salonika, Greece",
      ]
    `)
  })
})
