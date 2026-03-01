# Global Planner

Global Planner is a static Next.js itinerary globe. It renders a map-first 3D Earth with country borders, a seeded Vancouver -> Iberia trip, low-altitude travel paths, and whole-trip playback. The app is fully client-side: it loads committed JSON datasets from `public/generated`, does not call any third-party API at runtime, and does not require a backend.

## Current Product

V1.2 replaces the earlier airport-network explorer with an itinerary-first experience:

- no global route network is shown by default
- only itinerary stops and itinerary legs render
- air and ground travel both render from explicit sampled path points
- playback runs across the entire trip timeline, not one leg at a time
- the right side UI is a playback/edit dock instead of an airport-route inspector

The seeded trip starts in Vancouver and continues through Portugal and Spain. The playback model is UI-timeline-based and designed for trip visualization, not schedule-accurate transport simulation.

## Included

- interactive 3D globe with orbit and zoom
- local Earth textures and country borders
- seeded editable itinerary
- airport-backed stop search and insertion
- air and ground leg rendering
- whole-trip playback with play, pause, next, previous, reset, speed, and scrub controls
- stop and leg editing in the dock
- deep links via `?stop=` and `?leg=`

## Excluded

- weather and climate data
- live routing, rail, or road APIs
- persistence or saved trips
- authentication
- free-text geocoding outside the committed airport dataset

## Stack

- Next.js App Router
- React 19 + TypeScript
- `react-globe.gl` and Three.js
- plain CSS modules plus `app/globals.css`
- Vitest + Testing Library
- Playwright

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Commands

- `npm run dev`: start the local dev server
- `npm run build:data`: rebuild the committed datasets from local CSVs
- `npm run build`: create the production build
- `npm run start`: run the production build locally
- `npm run test`: run unit and component tests
- `npm run test:e2e`: run Playwright smoke tests
- `npm run test:all`: run Vitest and Playwright
- `npx vitest run --coverage`: run the coverage gate

If Playwright browsers are not installed yet:

```bash
npx playwright install
```

## Dataset

The committed dataset still comes from the OpenFlights-style airport and route CSVs. Those route records are used for airport coverage and search anchoring, but the runtime no longer visualizes the full global route graph.

The checked-in manifest is:

- [manifest.v1.json](/Users/mattfaltyn/Desktop/travel/global_planner/public/generated/manifest.v1.json)

If you want to rebuild the dataset locally:

1. Create a local `data/` directory.
2. Place:
   - `data/airports.csv`
   - `data/routes.csv`
3. Run:

```bash
npm run build:data
```

That rewrites:

- `public/generated/manifest.v1.json`
- `public/generated/airports.v1.json`
- `public/generated/routes.v1.json`

Raw CSVs stay git-ignored. Generated JSON is the deploy artifact.

## Project Layout

```text
app/                  Next.js entrypoints and global styles
components/globe/     Globe shell, renderer, and test fallback canvas
components/ui/        Search, dock, playback bar, tooltip, loading, and error UI
lib/data/             Dataset types, loaders, indexes, search, and transforms
lib/globe/            Camera and globe styling helpers
lib/itinerary/        Seed resolution, path interpolation, timeline, and playback logic
lib/state/            Reducer and selectors
scripts/              Build-time dataset generation
public/generated/     Committed static dataset
docs/                 Architecture, pipeline, testing, deployment, and ADRs
tests/                Unit, component, and E2E coverage
```

## Runtime Flow

1. `app/page.tsx` renders `GlobeShell`.
2. `GlobeShell` fetches the static dataset and seeds the itinerary.
3. The shell hydrates `?stop=` or `?leg=` selection state from the URL.
4. `GlobeCanvas` renders country borders, stop markers, itinerary paths, and the traveler marker.
5. `TripPlaybackBar` controls the whole-trip timeline.
6. `ItineraryDock` exposes playback summary by default and editing tools when switched to `Edit`.

## Quality

Vitest is configured with a full coverage gate:

- `100%` statements
- `100%` branches
- `100%` functions
- `100%` lines

Tests currently cover:

- itinerary seeding and stop resolution
- low-altitude path generation and timeline math
- reducer behavior and URL sync
- globe render props and traveler positioning
- dock, edit, and playback UI
- browser-level smoke flows through Playwright

## Deployment

- static-host friendly
- no API routes
- no database
- no runtime remote dependencies

See:

- [Architecture](/Users/mattfaltyn/Desktop/travel/global_planner/docs/architecture.md)
- [Data Pipeline](/Users/mattfaltyn/Desktop/travel/global_planner/docs/data-pipeline.md)
- [Testing](/Users/mattfaltyn/Desktop/travel/global_planner/docs/testing.md)
- [Deployment](/Users/mattfaltyn/Desktop/travel/global_planner/docs/deployment.md)
- [ADR 0001](/Users/mattfaltyn/Desktop/travel/global_planner/docs/adr/0001-threejs-single-renderer.md)
