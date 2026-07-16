Read `/reference/reference-v4-10.html` completely before making any code changes.

This file is the canonical source of truth for the current Family Atlas design and behavior. Do not invent a new visual direction. Reproduce the reference in the existing React + TypeScript + Tailwind + Framer Motion app as faithfully as possible.

Primary goal:
Port the working V4.10 prototype into maintainable React components while preserving its styling, layout, data, and interactions.

Requirements:

1. Preserve the reference visual language exactly:
- dark textured background
- warm gold family layer
- muted teal world-history layer
- serif editorial typography for stories and names
- sans-serif for UI, labels, and metadata
- highlight carousel in the upper-left
- family events above the timeline axis
- world-history events below the timeline axis
- bottom controls and timeline spacing

2. Preserve all working interactions from V4.10:
- mouse-wheel zoom
- range-slider zoom
- drag/pan timeline
- smooth animated transitions between zoom levels
- historical-context toggle
- Return to Craig
- highlight carousel with auto-advance, pause-on-hover, dots, and chevrons
- clickable family events
- clickable world-history events
- right-side detail panel
- edge padding so earliest and latest items are not clipped
- collision-aware density reduction
- event clustering at crowded zoom levels
- clicking a gold cluster must ALWAYS zoom inward and recenter on that cluster; it must never zoom out

3. Preserve the semantic event system:
- births: sunrise icon + “BIRTH OF” + person name
- deaths: cross icon + “DEATH OF” + person name
- migrations: richer contextual second line
- family stories: richer contextual second line
- world-history events remain visually distinct below the axis

4. Component architecture:
- Header
- HighlightCarousel
- TimelineViewport
- FamilyLayer
- WorldHistoryLayer
- TimelineControls
- DetailPanel

Shared timeline math, clustering, collision handling, and animation state should live in reusable hooks or utilities rather than being duplicated across components.

5. Data:
- Port the complete embedded family data and historical event data from the reference file into typed files under `src/data/`.
- Create TypeScript types under `src/types/`.
- Do not replace the real reference data with generic placeholder data.

6. Styling:
- Prefer reusable CSS classes and variables.
- Tailwind may be used for layout, but preserve the reference’s exact visual result.
- Do not simplify the design merely to make the port easier.

7. Workflow and safety:
- Before editing, run `git status`.
- Create a safety commit if there are uncommitted changes.
- Keep the current app available in Git history.
- Implement the port incrementally.
- Run `npm run build` and fix all errors.
- Run the app locally and verify that every required interaction works.

8. Stop conditions:
Do not add maps, AI-generated text, authentication, Supabase, or new product features yet. This task is only to faithfully port V4.10 into the React application.

When finished, report:
- every file created or changed
- which V4.10 interactions were verified
- any behavior that could not be ported exactly
