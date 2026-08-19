# Atlas Health (Phase 1 — Observability)

Family Atlas should increasingly explain itself:

1. What did the GEDCOM contain?
2. What did Family Atlas understand?
3. What is uncertain?
4. What was intentionally hidden?
5. What failed — and why?

Phase 1 adds **observation-only** diagnostics. It does **not** unify Explore and Documentary geography, change coordinates, alter landmark selection, or introduce user corrections.

## Confidence vocabulary

Shared across diagnostics:

| Value | Meaning |
|---|---|
| `CONFIRMED` | Human-verified (reserved; unused in Phase 1 writes) |
| `HIGH` | Strong automatic match (e.g. explore exact override; documentary `verified`) |
| `MEDIUM` | Plausible but heuristic (e.g. explore pattern match; documentary `medium`) |
| `LOW` | Coarse fallback (e.g. country/region center) |
| `UNRESOLVED` | No usable resolution |

Documentary registry values map as: `verified` → `CONFIRMED`, `high` → `HIGH`, `medium` → `MEDIUM`, `unresolved` → `UNRESOLVED`.

## Core records

### `PlaceResolutionRecord`

For a GEDCOM place string, records:

- **original** — verbatim database string (malformed values preserved)
- **normalized** — diagnostic normalization only
- Explore / Documentary resolution (method, confidence, precision, lat/lng, projected x/y)
- **comparison** category:
  - `GEOGRAPHIC_CONFLICT` — both resolve but to incompatible geography
  - `RESOLUTION_GAP` — one pipeline resolves, the other does not
  - `PRECISION_MISMATCH` — compatible geography, different specificity (city vs region vs country)
  - `CONFIDENCE_MISMATCH` — equivalent geography/precision; confidence only differs
  - `AGREEMENT` — materially equivalent
- Effective **precision**: `exact/city` | `state/region` | `country` | `approximate-region` | `unresolved`
- `humanConfirmed: false` (placeholder for Phase 2)

Pipelines are compared, never merged. Health findings are sorted by severity:
geographic conflict → resolution gap → precision mismatch → confidence mismatch.

### `EventLifecycleRecord`

For a family event + viewport context, records synthesis provenance, filters, viewport eligibility, semantic zoom, landmark/placement/fold/chapter residual outcomes, final visibility, hidden reason, and classification:

- `EXPECTED` — product behavior (filters, budgets, clusters)
- `SUSPICIOUS` — worth human review (inferred moves + place disagreement, missing ids, etc.)
- `BUG_SUSPECTED` — passed known layout stages but still not explained

## Module map

| Path | Role |
|---|---|
| `src/atlas-health/types.ts` | Shared types |
| `src/atlas-health/placeResolution.ts` | Dual-pipeline place diagnostics |
| `src/atlas-health/eventProvenance.ts` | Synthesis / place extraction |
| `src/atlas-health/explainVisibility.ts` | On-demand visibility explainer |
| `src/atlas-health/healthCheck.ts` | On-demand Atlas Health aggregation |
| `src/atlas-health/dev/AtlasDebuggerPanel.tsx` | DEV debugger UI |
| `src/data/placeCoordinates.ts` | `diagnoseExplorePlace` (same path as resolve) |
| `src/documentary-engine/core/gedcomMigrationDirector.ts` | `diagnoseGedcomPlaceResolution` (same path as resolve) |

## Atlas Debugger

Enable in development only:

```
?atlasDebug=1
```

Inspect **Health**, **Person**, **Event**, and **Place**. Event explanations use the **current timeline window and filters**.

Health Check and place audits are **on demand**. They are not invoked from Timeline pan/zoom render paths.

## Performance rules

- Do not run `runAtlasHealthCheck()` or full place scans during animation/render.
- `explainEventVisibility` may re-run layout offline when the debugger requests it — never per-frame.
- Production builds omit the debugger (`import.meta.env.DEV` gate).

## Out of scope (later phases)

- Story-impact prioritization
- Location confirmation / override store UI
- Flipping Explore / Documentary / Journey to unified resolver (Phase 2A shadow only)
- Customer-facing Health Check chrome
- Support telemetry packages
- Automatic repair

## Phase 2A shadow resolver

When `?atlasDebug=1`, the **Place** and **Health** tabs also show the **unified shadow** resolver (`src/places/`). This runs alongside legacy Explore + Documentary pipelines without changing map, timeline, journey, or documentary behavior.

Unified vs legacy comparison categories:

| Category | Meaning |
|---|---|
| `UNIFIED_AGREES_ACCEPTABLE` | Compatible with geography already judged acceptable |
| `UNIFIED_CORRECTS_LEGACY` | Fixes resolution gap or geographic conflict |
| `UNIFIED_COARSER_THAN_ACCEPTABLE` | Coarser but macro-compatible |
| `UNIFIED_AMBIGUOUS_SAFE` | Deliberately ambiguous (prefer safe over false precision) |
| `UNIFIED_REGRESSION` | Contradicts acceptable legacy geography |
| `NO_ACCEPTABLE_BASELINE` | Legacy pipelines conflicted — no single baseline |

## Tests

Parity tests assert that diagnostic wrappers do not change:

- explore coordinates / resolved flags
- documentary canonical ids
- landmark layout event ids / cluster counts (existing suite)
- Follow journey eligibility (existing suite)
