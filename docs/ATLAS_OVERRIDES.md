# Atlas Overrides (Phase 2B)

Persistent, non-destructive corrections sit **above** GEDCOM import and automated inference:

```text
GEDCOM / imported data
→ normalization / resolution / inference
→ persistent Atlas override layer  (atlas_overrides)
→ existing rendering pipelines
```

Overrides never mutate source GEDCOM files.

## Precedence

### Places

1. Active human override (`confirm_resolution` | `set_coordinates` | `set_label`)
2. Curated / exact canonical registry match
3. Automated canonical resolution
4. Legacy Journey/Explore fallback
5. Unresolved

**Provenance:**

- `canonical_selection` — human confirmed a registry place id
- `manual_coordinates` — human set lat/lng directly

### Events

1. Active event override
2. Imported / curated event
3. Inferred synthesis

`force_include` means **eligible for display consideration only**. It does **not** bypass clustering, semantic zoom, density limits, or layout collision rules.

`suppress` removes the event before landmark/layout selection.

### Person dates

1. Active `set_date` override (effective birth/death used by Timeline, Journey, Health, Review)
2. `confirm_date` (keeps the GEDCOM reading, removes the customer Review prompt)
3. Imported GEDCOM date

Person date overrides never write `atlas_people.birth_year` / `death_year` and never use event `correct_year`. The original GEDCOM string stays in `dateSource`.

## Identity / reimport

| Entity | `entity_key` | `source_signature` |
|---|---|---|
| Place | `placeFingerprint(normalized)` | `place\|fp:…\|compact:…\|auto:{canonicalId}` |
| Event | `canonicalEventId` | richer `eventFingerprint` |
| Person date | `{atlasPersonId}:birth` or `{atlasPersonId}:death` | `person\|birth\|{rawGedcomDate}` |
| Diagnostic | `place:…` or `event:…` + category | disposition payload |

Rebind rules:

- key + matching signature → keep `active`
- key matches but signature **materially changed** → `needs_review` (never silent apply)
- multiple key matches → `needs_review` / `ambiguous`
- no key match → `orphaned`

## API

| Method | Path | Auth |
|---|---|---|
| GET | `/api/overrides` | atlas-scoped read |
| GET | `/api/overrides?id=` | read one |
| GET | `/api/overrides?lookup=1&entityType=&entityKey=` | lookup active |
| PUT | `/api/overrides` | edit cookie |
| DELETE | `/api/overrides?id=` | edit cookie (soft revert) |

## Runtime

- Sync cache: `src/overrides/overrideCache.ts` (loaded at app start)
- `resolveAtlasPlace` / `resolveCanonicalPlace(Sync)` apply place overrides
- `applyEventEligibilityOverrides` in TimelineContext (suppress / year / place only)
- DEV controls: `?atlasDebug=1` Place + Event tabs; Health **Review findings**
- Customer **Atlas Review** (`source: atlas-review`) uses the same APIs; see [ATLAS_REVIEW.md](./ATLAS_REVIEW.md)

## Local development

Writes need Neon + edit unlock. Prefer:

```bash
npm run dev
```

Open **http://localhost:5173/?atlasDebug=1** — the Vite `atlasApiPlugin` serves `/api/overrides` locally.

`npm run dev:vercel` (port 3000) also works when SPA rewrites do not swallow Vite `/src` modules.
