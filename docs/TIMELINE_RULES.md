# Timeline Rules

These rules govern layout, interaction, and zoom behavior for the Family Atlas timeline. They are constraints, not suggestions — violating them breaks the museum experience.

---

## Axis & Layer Placement

```
  ┌─────────────────────────────────────────────┐
  │         FAMILY EVENTS (warm gold)           │  ← above axis
  ├─────────────────────────────────────────────┤
  │  ═══════════════ TIMELINE AXIS ═══════════  │
  ├─────────────────────────────────────────────┤
  │      WORLD-HISTORY EVENTS (muted teal)      │  ← below axis
  └─────────────────────────────────────────────┘
```

- The timeline axis is the horizontal anchor. All spatial relationships derive from it.
- **Family events always render above the axis.**
- **World-history events always render below the axis.**
- The axis itself is visually quiet — a thin, understated line or gradient, never a heavy bar.

---

## Event Types & Content Density

| Category | Layer | Content Allowed |
|---|---|---|
| Birth | Family (above) | Minimal: name, date, place |
| Death | Family (above) | Minimal: name, date, place |
| Migration | Family (above) | Rich: origin, destination, date, optional narrative |
| Military service | Family (above) | Rich: branch, rank, dates, conflict context |
| Occupation | Family (above) | Rich: role, employer, date range |
| Family story | Family (above) | Rich: title, summary, link to detail panel |
| World-history event | World (below) | Moderate: event name, date, brief description |

**Rule:** Birth and death markers must remain visually minimal at every zoom level. They are punctuation, not paragraphs.

---

## Clustering

When events in a time range would overlap or crowd:

1. **Cluster them** into a single grouped marker showing a count (e.g., "7 events").
2. Clusters inherit the dominant layer color of their contents.
3. **Clicking a cluster always zooms inward** — never opens a list, never navigates away. Zoom is the only cluster interaction.
4. At the new zoom level, the cluster dissolves into its constituent events (or into sub-clusters if still crowded).
5. There must be **zero visible overlap** at any zoom level. If overlap is detected, clustering has failed.

---

## Semantic Zoom

Zoom is not merely magnification — it is **progressive disclosure of detail**.

| Zoom Level | What Appears |
|---|---|
| **Far (centuries)** | Axis ticks, major clusters, world-history landmarks |
| **Mid (decades)** | Individual family events, smaller clusters, event type icons |
| **Near (years)** | Full labels, explanatory text for rich events, relationship hints |
| **Close (months/days)** | Complete detail previews, story excerpts, source citations |

Rules:

- Detail that is hidden at a far zoom must not leak visually (no truncated text, no clipped markers).
- Zoom transitions are animated smoothly; the axis recenters on the focal point.
- Zoom level is preserved when opening and closing the detail panel.
- Pinch, scroll-wheel, and double-click all trigger semantic zoom consistently.

---

## Highlight Carousel Integration

- The carousel reflects the **currently visible time window** — stories relevant to what the visitor is looking at.
- Selecting a carousel card **pans and zooms** the timeline to the story's time range, then opens the detail panel.
- The carousel does not filter or hide timeline events; it curates attention.

---

## World-History Context Layer

- World-history events provide **context, not competition** — they explain what was happening in the world while the family lived their lives.
- They never appear above the axis.
- At far zoom, only major world events are visible. At near zoom, more appear, but always below the family layer.
- World-history data is curated separately from GEDCOM and may be edited without affecting family data integrity.

---

## Temporal Integrity

- Events are positioned by **start date** on the axis. Events with date ranges (occupations, migrations) render as spans.
- Events with unknown dates are placed in an "undated" region at the timeline edge, visually distinct but accessible.
- The timeline supports BCE/CE and multiple calendar systems as GEDCOM provides them.

---

## Interaction Summary

| Action | Result |
|---|---|
| Click cluster | Zoom inward |
| Click minimal event (birth/death) | Small tooltip or detail panel with basic facts |
| Click rich event (story, migration, etc.) | Open detail panel; timeline context preserved |
| Click carousel card | Pan + zoom to story; open detail panel |
| Scroll / pinch | Semantic zoom toward cursor/focal point |
| Click world-history event | Tooltip or lightweight detail below axis |
