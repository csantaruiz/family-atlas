# Roadmap

Work is divided into eight phases. Each phase produces a demonstrable increment. Phases are ordered by dependency — later phases build on earlier ones.

---

## 1. Museum Shell

**Goal:** Establish the visual environment and layout frame.

**Deliverables:**
- Dark textured background applied globally.
- Serif typography system configured (headings, body, captions).
- Gold and teal color tokens defined in Tailwind theme.
- Layout grid: timeline viewport (center), carousel dock (bottom or side), detail panel overlay region.
- Responsive shell that preserves generous negative space at all breakpoints.
- `prefers-reduced-motion` baseline respected.

**Exit criteria:** Empty shell renders with correct visual atmosphere. No timeline logic yet.

---

## 2. Timeline Engine

**Goal:** Build the interactive horizontal timeline with semantic zoom.

**Deliverables:**
- D3 time scale mapping dates to pixel positions.
- Horizontal axis with adaptive tick marks (centuries → years → months).
- Pan and scroll/zoom gesture handling.
- Four semantic zoom levels with progressive detail disclosure.
- Viewport state management (visible time range, zoom level, focal date).
- Smooth animated zoom transitions (Framer Motion or D3 transitions).

**Exit criteria:** An empty axis pans and zooms through four levels with correct tick density. No events rendered yet.

---

## 3. Family Events

**Goal:** Render family events above the timeline axis.

**Deliverables:**
- Event marker components: minimal (birth/death) and rich (migration, military, occupation, story).
- Event positioning from dates/ranges on the family layer.
- Visual differentiation by event type per design principles.
- Cluster detection and rendering when events crowd.
- Cluster click → zoom inward behavior.
- Event click → detail panel trigger (stub panel acceptable).

**Exit criteria:** Seed family data renders above the axis with zero overlap. Clusters zoom correctly.

---

## 4. World-History Context

**Goal:** Add the muted teal world-history layer below the axis.

**Deliverables:**
- World-history event markers below the axis.
- Separate data source from family events (curated JSON or API).
- World-history clustering independent of family clustering.
- Visual subordination to family layer (smaller, quieter markers).
- Zoom-level visibility rules (major events at far zoom, more at near).

**Exit criteria:** Family and world-history layers coexist without visual competition. Both layers cluster independently.

---

## 5. Detail Panel

**Goal:** Open rich detail without losing timeline context.

**Deliverables:**
- Slide/fade detail panel overlay with timeline visible beneath.
- Detail header (title, date, type badge).
- Detail body (narrative text, structured facts, images).
- Source citations section.
- Open/close preserves zoom level and pan position.
- Differentiated layouts for minimal events (birth/death) vs. rich events (stories).

**Exit criteria:** Clicking any event opens the correct detail view. Closing returns to the exact prior timeline state.

---

## 6. GEDCOM Import

**Goal:** Make uploaded GEDCOM the canonical family-data source.

**Deliverables:**
- GEDCOM file upload interface.
- Parser extracting individuals, events (birth, death, marriage, occupation, etc.), relationships, and places.
- Mapping GEDCOM record types to Family Atlas event types.
- Data validation and error reporting for malformed files.
- Parsed data populates `FamilyDataContext`.
- Timeline re-renders from imported data.

**Exit criteria:** A real GEDCOM file imports successfully and drives all family events on the timeline.

---

## 7. Story Engine

**Goal:** Curate and surface family stories through the highlight carousel.

**Deliverables:**
- Story data model linked to GEDCOM individuals and events.
- Highlight carousel component with warm tinted cards.
- Carousel filtered to the currently visible time window.
- Card select → pan/zoom to story date → open detail panel.
- Story authoring or annotation layer (manual curation on top of GEDCOM data).
- Subtle Framer Motion transitions between carousel cards.

**Exit criteria:** Curated stories appear in the carousel, navigate to the timeline, and open rich detail panels.

---

## 8. Maps and Bloodline Mode

**Goal:** Extend the atlas with geographic and genealogical perspectives.

**Deliverables:**
- **Maps:** Migration events render as routes on a map view tied to the timeline time window. Map and timeline sync on pan/zoom.
- **Bloodline mode:** Alternate view tracing a single ancestral line vertically or as a connected graph, linked to timeline selection.
- Toggle between timeline, map, and bloodline views within the museum shell.
- Geographic data derived from GEDCOM place fields.

**Exit criteria:** Visitor can switch between timeline exploration, geographic migration view, and bloodline tracing without losing context.

---

## Phase Dependencies

```
Museum Shell
    └── Timeline Engine
            ├── Family Events
            │       └── Detail Panel
            │               └── Story Engine
            └── World-History Context
                    └── Detail Panel

GEDCOM Import → Family Events (replaces seed data)

Family Events + World-History Context → Maps and Bloodline Mode
```

---

## Current Status

| Phase | Status |
|---|---|
| Museum Shell | Not started |
| Timeline Engine | Not started |
| Family Events | Not started |
| World-History Context | Not started |
| Detail Panel | Not started |
| GEDCOM Import | Not started |
| Story Engine | Not started |
| Maps and Bloodline Mode | Not started |

The Vite + React + TypeScript scaffold is in place with Tailwind CSS, Framer Motion, Lucide React, and D3 installed. Application components have not been built yet.
