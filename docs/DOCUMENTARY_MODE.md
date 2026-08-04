# Documentary Mode

## Purpose

Documentary Mode is a cinematic storytelling experience — not a recording of the Atlas UI.

## Documentary Engine V1

The production engine lives in `src/documentary-engine/` as a **separate application** from the Atlas.

- **Master clock:** `public/documentary/santa-ruiz-story.mp3`
- **Screenplay:** `docs/documentary_script.md`
- **Scene manifest:** `src/documentary-engine/data/openingManifest.ts`
- **Cue sheet:** `public/documentary/documentary-cues.json`

When `phase !== 'complete'`, the app renders only `DocumentaryEngineRoot`. The Journey page is not mounted.

## Principles

- Narration drives the experience.
- Audio is the master timeline — no independent scene timers.
- Visuals support the narration.
- Maps, documents, evidence, and typography are equal storytelling tools.
- Each scene communicates one idea.
- Transitions are film-like cross-dissolves — never Journey timeline zoom mechanics.
- Evidence is always labeled: authentic, reconstructed, or contextual.
- Never fabricate portraits when no authentic image exists.

## Architecture boundary

| Documentary Engine owns | Atlas owns |
|---|---|
| Scene management | Exploration |
| Narration sync | Zooming & filtering |
| Transitions & camera | Navigation |
| Captions & pacing | Interactive discovery |

Shared dependencies only: family data, media assets, domain models, AI Historian outputs (future).

The legacy prototype under `src/components/documentary/` is deprecated and no longer wired into the app.
