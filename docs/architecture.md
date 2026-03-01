# Architecture Overview

This document describes the implemented v1 architecture, not the original product spec architecture.

## High-Level Shape

Global Planner is a client-heavy Next.js application with a static data model:

- Next.js serves HTML, JS, CSS, fonts, textures, and generated JSON
- the browser fetches `public/generated/*.json`
- React reducer state drives selection, search, filters, and panel UI
- `react-globe.gl` renders the globe, airport points, and route arcs

There is no server runtime logic beyond standard asset delivery.

## Rendering Architecture

V1 uses a single Three.js-based renderer via `react-globe.gl`.

Why:

- one camera model instead of cross-canvas synchronization
- simpler hover and click picking
- lower risk than the spec's deck.gl `GlobeView` overlay
- easier testability for a first release

The governing decision record is [ADR 0001](/Users/mattfaltyn/Desktop/travel/global_planner/docs/adr/0001-threejs-single-renderer.md).

## Main Runtime Components

### `app/page.tsx`

Entrypoint that renders the globe experience.

### `components/globe/GlobeShell.tsx`

The shell owns:

- dataset loading
- reducer state
- touch-mode detection
- URL hydration and synchronization
- E2E-only test API registration
- composition of search, panel, tooltip, legend, loading, and error states

### `components/globe/GlobeCanvas.tsx`

The canvas owns:

- `react-globe.gl` configuration
- point and arc rendering
- resize handling
- hover coordinate lookup
- camera fly-to transitions
- click routing back to the shell

### `components/ui/*`

UI components are intentionally dumb and focused:

- `SearchBox` and `SearchResults` handle search interaction
- `SidePanel` handles airport and route detail rendering
- `Tooltip`, `LoadingOverlay`, `ErrorState`, and `EmptyState` cover shell states

## State Model

The app uses `useReducer` rather than a global state library.

State lives in [appState.ts](/Users/mattfaltyn/Desktop/travel/global_planner/lib/state/appState.ts) and includes:

- dataset load status
- hover state
- selection state
- search query
- panel filter query
- panel sort key
- touch-device mode
- URL hydration flag

Pure derivations such as selected airport lookup, selected route lookup, destination filtering, sorting, and URL parsing live in [selectors.ts](/Users/mattfaltyn/Desktop/travel/global_planner/lib/state/selectors.ts).

## Data Flow

1. `loadDataset()` fetches `manifest.v1.json`, `airports.v1.json`, and `routes.v1.json`.
2. The loader builds runtime indexes:
   - `airportsById`
   - `routesById`
   - `routeIdsByAirportId`
3. The shell hydrates the initial selection from `window.location.search`.
4. Search, click, hover, and panel actions dispatch reducer events.
5. Selection changes update the URL using `history.replaceState`.

## Deep Linking

Supported query params:

- `?airport=<airportId>`
- `?airport=<airportId>&route=<routeId>`

Rules:

- invalid airport IDs resolve to no selection
- invalid route IDs fall back to airport selection if the airport is valid
- routes must belong to the selected airport or they are ignored

## Touch And Hover Behavior

Touch mode is inferred from:

```text
(hover: none), (pointer: coarse)
```

When touch mode is active:

- hover tooltips are disabled
- selection remains available via tap
- the side panel switches to its mobile layout class

## E2E-Specific Behavior

When `NEXT_PUBLIC_E2E=1`:

- `GlobeShell` dynamically uses `TestGlobeCanvas` instead of the real globe canvas
- the browser exposes `window.__GLOBAL_PLANNER_TEST_API__`

That hook exists only to stabilize Playwright coverage for route selection and URL-state assertions. It is not part of the product API.

## Non-Goals For V1

- no deck.gl overlay
- no runtime data fetching from third parties
- no climate or weather fields
- no server persistence
- no authentication or saved state
