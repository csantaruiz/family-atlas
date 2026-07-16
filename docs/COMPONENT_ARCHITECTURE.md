# Component Architecture

Proposed React component structure for Family Atlas. This document describes the intended architecture only — **no application components have been created or modified yet.**

---

## Top-Level Layout

```
App
└── MuseumShell
    ├── TimelineEngine
    │   ├── TimelineAxis
    │   ├── FamilyEventLayer
    │   │   ├── EventMarker (minimal | rich)
    │   │   └── EventCluster
    │   └── WorldHistoryLayer
    │       ├── WorldEventMarker
    │       └── WorldEventCluster
    ├── HighlightCarousel
    │   └── CarouselCard
    ├── DetailPanel
    │   ├── DetailHeader
    │   ├── DetailBody
    │   └── DetailSources
    └── ZoomControls (optional chrome)
```

---

## Component Responsibilities

### `App`

Root component. Provides global context providers (timeline state, family data, theme) and renders `MuseumShell`.

### `MuseumShell`

The museum frame: dark textured background, layout grid, and orchestration of the timeline, carousel, and detail panel. Owns no timeline logic — it composes and positions child regions.

**Props:** none (consumes context)

**Responsibilities:**
- Apply the dark textured background and global typography.
- Manage layout regions (timeline viewport, carousel dock, detail panel overlay).
- Coordinate z-index layering so the detail panel floats above without hiding the timeline.

---

### `TimelineEngine`

The core interactive timeline. Manages zoom level, visible time window, pan position, and event layout.

**Props:**
- `familyEvents: FamilyEvent[]`
- `worldEvents: WorldHistoryEvent[]`
- `zoomLevel: ZoomLevel`
- `viewport: TimeRange`
- `onZoomChange: (level: ZoomLevel, focalDate: Date) => void`
- `onEventSelect: (event: FamilyEvent | WorldHistoryEvent) => void`
- `onClusterClick: (cluster: EventCluster) => void`

**Responsibilities:**
- Compute event positions along the axis from dates.
- Detect crowding and emit clusters.
- Handle scroll/pinch zoom and pan gestures.
- Delegate rendering to layer components.

**Internal hooks (suggested):**
- `useTimelineLayout(events, viewport, zoomLevel)` — position and cluster computation
- `useSemanticZoom()` — zoom level transitions and detail disclosure rules
- `useTimelineGestures(ref)` — pan, pinch, double-click handlers

---

### `TimelineAxis`

Renders the horizontal axis with tick marks appropriate to the current zoom level.

**Props:**
- `viewport: TimeRange`
- `zoomLevel: ZoomLevel`

**Responsibilities:**
- Draw axis line, tick marks, and date labels.
- Adapt tick density to zoom (centuries → decades → years → months).

---

### `FamilyEventLayer`

Renders all family events above the axis.

**Props:**
- `events: FamilyEvent[]`
- `clusters: EventCluster[]`
- `zoomLevel: ZoomLevel`
- `onEventSelect: (event: FamilyEvent) => void`
- `onClusterClick: (cluster: EventCluster) => void`

**Children:**
- `EventMarker` — individual event rendering
- `EventCluster` — grouped event rendering

---

### `EventMarker`

A single family event on the timeline.

**Variants:**
- `minimal` — birth, death (small dot or tick, name on hover/near zoom)
- `rich` — migration, military, occupation, story (icon + label + optional summary text at near zoom)

**Props:**
- `event: FamilyEvent`
- `variant: 'minimal' | 'rich'`
- `zoomLevel: ZoomLevel`
- `position: number` (px offset from axis origin)
- `onSelect: () => void`

---

### `EventCluster`

Grouped marker when events overlap.

**Props:**
- `cluster: EventCluster`
- `position: number`
- `onClick: () => void` — always triggers zoom inward

**Rules enforced here:**
- Display event count badge.
- Warm gold styling consistent with family layer.
- Click handler must only call `onClick` (zoom) — no alternate behaviors.

---

### `WorldHistoryLayer`

Mirrors `FamilyEventLayer` but renders below the axis with muted teal styling.

**Props:**
- `events: WorldHistoryEvent[]`
- `clusters: EventCluster[]`
- `zoomLevel: ZoomLevel`
- `onEventSelect: (event: WorldHistoryEvent) => void`

---

### `WorldEventMarker`

Individual world-history event. Always moderate visual weight — never competes with family events above.

**Props:**
- `event: WorldHistoryEvent`
- `zoomLevel: ZoomLevel`
- `position: number`
- `onSelect: () => void`

---

### `HighlightCarousel`

Curated story carousel docked within the museum shell.

**Props:**
- `stories: FamilyStory[]` (filtered to current viewport)
- `onStorySelect: (story: FamilyStory) => void`

**Children:**
- `CarouselCard` — individual warm tinted card

**Responsibilities:**
- Filter stories to the visible time window.
- Animate card transitions (Framer Motion).
- On card select: pan/zoom timeline to story date, then trigger detail panel.

---

### `CarouselCard`

A single carousel entry.

**Props:**
- `story: FamilyStory`
- `isActive: boolean`
- `onSelect: () => void`

**Visual:** warm tinted card, serif title, date range, subtle hover/active states.

---

### `DetailPanel`

Slide-over or fade-in panel for full event or story detail. Timeline remains visible beneath.

**Props:**
- `item: FamilyEvent | FamilyStory | WorldHistoryEvent | null`
- `isOpen: boolean`
- `onClose: () => void`

**Children:**
- `DetailHeader` — title, date, event type badge
- `DetailBody` — narrative text, images, structured facts
- `DetailSources` — GEDCOM source citations, external links

**Rules enforced here:**
- Opening does not change zoom level or pan position.
- Closing restores exact prior state.
- Supports rich content for stories; minimal content for birth/death.

---

## Context Providers (Suggested)

| Provider | State |
|---|---|
| `TimelineContext` | zoom level, viewport, pan offset, focal date |
| `FamilyDataContext` | parsed GEDCOM events, relationships, stories |
| `WorldHistoryContext` | curated world-history events |
| `SelectionContext` | currently selected event/story, detail panel open state |

---

## Data Types (Suggested)

```typescript
type EventType =
  | 'birth'
  | 'death'
  | 'migration'
  | 'military'
  | 'occupation'
  | 'story'

type FamilyEvent = {
  id: string
  type: EventType
  label: string
  startDate: Date
  endDate?: Date
  place?: string
  summary?: string
  detailContent?: string
  sourceRefs?: string[]
}

type WorldHistoryEvent = {
  id: string
  label: string
  startDate: Date
  endDate?: Date
  summary: string
  category: string
}

type EventCluster = {
  id: string
  eventIds: string[]
  layer: 'family' | 'world'
  timeRange: TimeRange
  count: number
}

type FamilyStory = {
  id: string
  title: string
  dateRange: TimeRange
  excerpt: string
  detailContent: string
  relatedEventIds: string[]
  mediaUrls?: string[]
}

type ZoomLevel = 'far' | 'mid' | 'near' | 'close'

type TimeRange = {
  start: Date
  end: Date
}
```

---

## Library Usage by Component

| Component | Libraries |
|---|---|
| `TimelineEngine`, layers, markers | D3 (scales, layout, clustering) |
| `HighlightCarousel`, `DetailPanel`, transitions | Framer Motion |
| All iconography | Lucide React |
| All styling | Tailwind CSS |

---

## File Structure (Proposed)

```
src/
├── components/
│   ├── shell/
│   │   └── MuseumShell.tsx
│   ├── timeline/
│   │   ├── TimelineEngine.tsx
│   │   ├── TimelineAxis.tsx
│   │   ├── FamilyEventLayer.tsx
│   │   ├── WorldHistoryLayer.tsx
│   │   ├── EventMarker.tsx
│   │   ├── EventCluster.tsx
│   │   └── WorldEventMarker.tsx
│   ├── carousel/
│   │   ├── HighlightCarousel.tsx
│   │   └── CarouselCard.tsx
│   └── detail/
│       ├── DetailPanel.tsx
│       ├── DetailHeader.tsx
│       ├── DetailBody.tsx
│       └── DetailSources.tsx
├── context/
│   ├── TimelineContext.tsx
│   ├── FamilyDataContext.tsx
│   ├── WorldHistoryContext.tsx
│   └── SelectionContext.tsx
├── hooks/
│   ├── useTimelineLayout.ts
│   ├── useSemanticZoom.ts
│   └── useTimelineGestures.ts
├── types/
│   └── index.ts
├── data/
│   └── (GEDCOM parser, world-history seed data)
└── lib/
    └── (D3 helpers, date utilities, clustering)
```

This structure separates concerns by feature domain (timeline, carousel, detail, shell) and keeps data/context/hooks independent of presentation components.
