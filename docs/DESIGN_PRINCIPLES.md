# Design Principles

Family Atlas inherits its visual language from the **V4 prototype**. Every design decision should reinforce a museum-like atmosphere: quiet confidence, warmth, and clarity.

---

## Visual Foundation

### Dark Textured Background

The canvas is a deep, textured dark surface — not flat black. Texture adds depth and warmth, suggesting aged paper, stone, or gallery walls. The background recedes so that timeline content remains the focal plane.

### Dual-Layer Color System

| Layer | Color | Role |
|---|---|---|
| **Family** | Warm gold | Events, cards, highlights, and interactive affordances above the axis |
| **World history** | Muted teal | Contextual events below the axis; visually subordinate to family content |

These two hues must never compete. Gold draws the eye; teal provides grounding context.

### Typography

- **Serif typefaces** for headings, event labels, and narrative text — elegant, readable, and timeless.
- **Restrained sizing hierarchy** — few distinct sizes, generous line height, no decorative type treatments.
- Body text in detail panels may use a complementary sans-serif for long-form readability, but the primary voice is serif.

### Negative Space

Whitespace (or "dark space") is a first-class design element. Elements breathe. The timeline axis should feel unhurried. Crowding is a layout failure, not a data problem — clustering resolves it before the visitor sees overlap.

### Motion

Motion is **restrained and purposeful**:

- Subtle fades and slides for panel transitions.
- Gentle scale on cluster zoom.
- Carousel cards transition with soft opacity and positional easing — never bounce or snap.
- No gratuitous parallax, particle effects, or loading theatrics.

If an animation does not aid comprehension or orientation, remove it.

---

## Event Visual Weight

Not all events deserve equal visual presence.

| Event Type | Visual Treatment |
|---|---|
| Birth | Minimal — a quiet marker, small label |
| Death | Minimal — same restraint as birth |
| Migration | Moderate — may include route or place name |
| Military service | Moderate to rich — dates, branch, brief context |
| Occupation | Moderate — role and period |
| Family story | Rich — eligible for carousel highlights and full detail panel |

The principle: **life bookends are quiet; the lived experience is expressive.**

---

## Highlight Carousel

The carousel surfaces curated family stories — not every event, only those chosen for narrative impact.

- **Warm tinted cards** with soft edges and subtle inner glow.
- **Subtle transitions** between cards; no hard cuts.
- Cards preview a story title, a date range, and optionally a thumbnail or icon.
- The carousel sits within the museum shell without obscuring the timeline.

---

## Detail Panel

Opening a detail panel must **preserve timeline context**:

- The panel slides or fades in over a dimmed overlay — the timeline remains visible beneath.
- Closing the panel returns the visitor to the exact zoom level and scroll position.
- Long-form story text, images, and source citations live here.
- Panel chrome is minimal: title, date, body, close affordance.

---

## Accessibility & Legibility

- Minimum contrast ratios against the dark background for all text.
- Interactive targets large enough for touch and pointer.
- Motion respects `prefers-reduced-motion`.
- Semantic HTML structure for screen readers despite the visual richness.

---

## What to Avoid

- Bright saturated colors outside the gold/teal palette.
- Dense information panels that feel like spreadsheets.
- Overlapping or stacked event markers.
- Generic "dashboard" or "SaaS" UI patterns.
- Icon-heavy interfaces without typographic anchors.
