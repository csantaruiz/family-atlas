# Atlas Review (Phase 2C)

Customer-facing, one-at-a-time help for details where **family knowledge adds value**. The same overlay may show a place card or a date card. There is no separate Date Review destination.

This is not the DEV debugger. `?atlasDebug=1` Review Findings is unchanged.

## Product rule

Do not ask the family to review problems Unified Places already resolved with a confident, coherent answer.

Gloucester-style Explore/Documentary conflicts that Unified already maps to Gloucester City, New Jersey stay **off** the customer queue.

## Presentation states

The queue is unchanged. The overlay chooses a layout:

| State | When | Question |
|---|---|---|
| **recommended** | One Atlas reading to confirm | Is this the right place? |
| **candidates** | Two or more safe registry matches | Which place does your family record mean? |
| **unresolved** | No safe match | Do you recognize this place? |

Unresolved items do **not** offer “I know this place” until place search exists.

## Actions

| Customer action | Persistence |
|---|---|
| **Yes, that’s right** / **Use this place** | Phase 2B `confirm_resolution` + diagnostic `confirmed` (`source: atlas-review`) |
| **Choose another place** | Same confirm, using an existing registry/canonical alternative |
| **I’m not sure** / **I don’t recognize this place** | Session skip — no override; may appear again later |
| **That’s not the right place** / **None of these** / **Don’t ask me about this again** | Diagnostic `ignored` after a confirm dialog — GEDCOM unchanged; removed from normal Review |
| **Keep this date** | Person `confirm_date` — GEDCOM unchanged; Review stops asking |
| **Change this date** + save | Person `set_date` with a parseable year / month-year / full date / Abt / Bef / Aft |
| **I’m not sure** (date) | Session skip — no write |
| **Don’t ask again** (date) | Diagnostic `ignored` only — person date unchanged |

## Entry

Quiet header chip: `Atlas Review · N`. First open in a session shows a short intro. Overlay, not a sixth primary view.

## Architecture

- Queue: `src/atlas-review/selectCustomerReviews.ts` over Health / Unified Places
- Layout: `src/atlas-review/reviewPresentation.ts`
- Persistence: existing `/api/overrides`, atlas-scoped `ATLAS_ID`
- One correction system for DEV and customer
