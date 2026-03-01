# Architecture Overview

This document describes the implemented V1.2 architecture.

## Product Shape

Global Planner is now an itinerary-first globe, not a global route-network browser.

The runtime experience is:

- seed an editable trip after dataset load
- render only itinerary stops and itinerary legs
- keep the globe as the primary visual surface
- drive animation from one whole-trip timeline
- expose editing through a secondary dock state

There is no backend runtime logic beyond static asset delivery.

## Runtime Stack

- Next.js serves HTML, JS, CSS, fonts, textures, and generated JSON
- the browser fetches `public/generated/*.json`
- `useReducer` owns itinerary, selection, search, dock, and playback state
- `react-globe.gl` renders the Earth, borders, path-based legs, and traveler marker

## Main Runtime Components

### `app/page.tsx`

Entrypoint that renders `GlobeShell`.

### `components/globe/GlobeShell.tsx`

The shell owns:

- dataset loading
- itinerary seeding from airport data
- reducer state
- touch-mode detection
- URL hydration and synchronization
- `requestAnimationFrame` playback ticking
- E2E test API registration
- composition of search, dock, playback bar, tooltip, loading, and error states

### `components/globe/GlobeCanvas.tsx`

The canvas owns:

- `react-globe.gl` configuration
- country border polygons
- stop marker rendering
- itinerary leg rendering through `pathsData`
- traveler marker rendering
- hover coordinate lookup
- playback and selection camera framing

Important rendering rule:

- air legs do not use `arcsData`
- both air and ground legs render from explicit sampled `pathPoints`

That guarantees lower, more controllable paths with exact endpoint anchoring.

### `components/ui/TripPlaybackBar.tsx`

The floating playback bar owns:

- play / pause / reset
- previous / next stop navigation
- speed selection
- whole-trip progress slider
- current route summary
- entry into edit mode

### `components/ui/ItineraryDock.tsx`

The dock owns two modes:

- `Playback`: compact summary-first view
- `Edit`: stop and leg editing tools

The dock is collapsible and is intentionally lighter than the old always-heavy side panel.

### `components/ui/ItineraryPanel.tsx`

The edit panel owns:

- stop list
- stop reordering and removal
- stop editing
- anchor replacement
- leg mode editing
- per-leg playback jump actions

## State Model

State lives in [appState.ts](/Users/mattfaltyn/Desktop/travel/global_planner/lib/state/appState.ts).

Top-level state includes:

- dataset load state
- hover state
- itinerary selection
- URL hydration flag
- search query and search intent
- touch-device flag
- dock mode and collapsed state
- itinerary stops and derived legs
- whole-trip playback state

Playback is canonicalized around trip progress:

- `tripProgress`
- `activeLegIndex`
- `activeLegProgress`
- `phase`

The slider and transport controls operate on this trip-wide timeline rather than a single-leg timeline.

Pure derivations live in [selectors.ts](/Users/mattfaltyn/Desktop/travel/global_planner/lib/state/selectors.ts).

## Itinerary And Timeline Flow

1. `loadDataset()` fetches `manifest.v1.json`, `airports.v1.json`, and `routes.v1.json`.
2. The shell resolves the seeded Vancouver -> Iberia trip against airport anchors.
3. `deriveLegs()` creates adjacent itinerary legs.
4. `buildLegPathPoints()` generates explicit sampled path points:
   - air: low globe arcs with zero-altitude endpoints
   - ground: near-surface paths with zero-altitude endpoints
5. `buildTimelineSegments()` creates the whole-trip playback timeline.
6. Playback helpers convert `tripProgress` into:
   - active leg
   - intra-leg progress
   - travel vs dwell phase

## URL Model

The product now uses itinerary-centric query params:

- `?stop=<stopId>`
- `?leg=<legId>`

Rules:

- invalid params resolve to no selection
- playback progress is not encoded in the URL
- old `?airport=` and `?route=` params are not part of the current product model

## Camera Model

The renderer uses three framing modes:

- default idle overview: itinerary-fit view with Vancouver and Iberia visible together
- autoplay playback: stable overview, not per-leg camera chasing
- manual selection: focused stop or buffered leg framing

This is intentionally calmer than the earlier per-leg fly-to behavior.

## Touch And Hover

Touch mode is inferred from:

```text
(hover: none), (pointer: coarse)
```

When touch mode is active:

- hover tooltips are disabled
- tap selection still works
- the dock shifts toward the mobile layout behavior

## E2E-Specific Behavior

When `NEXT_PUBLIC_E2E=1`:

- `GlobeShell` dynamically uses `TestGlobeCanvas`
- the browser exposes `window.__GLOBAL_PLANNER_TEST_API__`

The test hook exists only to stabilize browser automation for itinerary selection and playback assertions. It is not part of the product API.

## Deliberate Non-Goals

- no deck.gl overlay
- no global route graph rendering
- no runtime routing API
- no climate or weather features
- no persistence layer
- no authentication
