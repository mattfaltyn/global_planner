# Global Planner

Global Planner is a static Next.js application that renders a weather-free v1 globe of major airports and direct flight connections. The runtime is entirely client-side: the app loads prebuilt JSON datasets from `public/generated`, renders the globe with `react-globe.gl`, and does not depend on any external API, database, or backend service.

The committed v1 dataset currently contains:

- `336` airports
- `7,537` direct route pairs

Those counts come from the checked-in [manifest.v1.json](/Users/mattfaltyn/Desktop/travel/global_planner/public/generated/manifest.v1.json).

## V1 Scope

Included:

- interactive 3D globe with orbit and zoom
- airport points
- direct route arcs
- airport and route hover tooltips
- search by airport name, city, IATA, and ICAO
- click-driven side panel for airport and route detail
- deep links via `?airport=` and `?route=`

Explicitly excluded from v1:

- weather and climate data
- live flight or routing APIs
- multi-leg trip planning
- persistence, auth, or saved itineraries

## Stack

- Next.js App Router
- React 19 + TypeScript
- `react-globe.gl` and Three.js
- plain CSS modules plus `app/globals.css`
- Vitest + Testing Library for unit and component coverage
- Playwright for browser smoke coverage

## Quick Start

If you only want to run the checked-in app, the committed generated assets are enough.

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Regenerating The Dataset

You only need the raw CSV files if you want to rebuild `public/generated`.

1. Create a local `data/` directory.
2. Place these files in it:
   - `data/airports.csv`
   - `data/routes.csv`
3. Run:

```bash
npm run build:data
```

This rewrites:

- `public/generated/manifest.v1.json`
- `public/generated/airports.v1.json`
- `public/generated/routes.v1.json`

Raw CSVs are intentionally git-ignored. Generated JSON is the deploy artifact.

## Commands

- `npm run dev`: start the local Next.js dev server
- `npm run build:data`: rebuild the generated dataset from local CSVs
- `npm run build`: create the production build
- `npm run start`: run the production build locally
- `npm run test`: run unit and component tests
- `npm run test:watch`: run Vitest in watch mode
- `npm run test:e2e`: run Playwright smoke tests
- `npm run test:all`: run Vitest and Playwright
- `npx vitest run --coverage`: run the 100% coverage gate

If Playwright browsers are not installed yet:

```bash
npx playwright install
```

## Project Layout

```text
app/                  Next.js entrypoints and global styles
components/globe/     Globe shell, renderer, legend, and E2E fallback canvas
components/ui/        Search, tooltip, panel, loading, and error components
lib/data/             Dataset types, loaders, indexes, search, and transforms
lib/globe/            Camera, color, and route-geometry helpers
lib/state/            Reducer and selection/filter selectors
scripts/              Build-time dataset generation
public/generated/     Committed v1 dataset
docs/                 ADRs and contributor documentation
tests/                Unit, component, and E2E coverage
```

## Runtime Architecture

The runtime flow is:

1. `app/page.tsx` renders `GlobeShell`.
2. `GlobeShell` fetches the three static JSON files from `public/generated`.
3. The shell builds indexes, hydrates selection state from the URL, and renders the search/panel UI.
4. `GlobeCanvas` renders the actual globe, airport points, and route arcs.
5. User interactions update reducer state, which in turn updates the URL and side panel.

The app intentionally uses a single globe renderer instead of the original spec's dual Three.js plus deck.gl approach. The decision record is in [ADR 0001](/Users/mattfaltyn/Desktop/travel/global_planner/docs/adr/0001-threejs-single-renderer.md).

More detail:

- [Architecture](/Users/mattfaltyn/Desktop/travel/global_planner/docs/architecture.md)
- [Data Pipeline](/Users/mattfaltyn/Desktop/travel/global_planner/docs/data-pipeline.md)
- [Testing](/Users/mattfaltyn/Desktop/travel/global_planner/docs/testing.md)
- [Deployment](/Users/mattfaltyn/Desktop/travel/global_planner/docs/deployment.md)

## Testing And Quality

The repo enforces a full Vitest coverage gate:

- `100%` statements
- `100%` branches
- `100%` functions
- `100%` lines

Testing layers:

- unit tests for data transforms and selectors
- component tests for search, panel, URL sync, and shell behavior
- Playwright smoke tests for real browser integration

The E2E suite runs the app with `NEXT_PUBLIC_E2E=1`, which enables a guarded test-only canvas fallback and exposes `window.__GLOBAL_PLANNER_TEST_API__` for stable route selection in browser automation.

## Deployment Notes

- The app is suitable for Vercel static hosting.
- There is no backend, API route, or database.
- The production build only requires the committed `public/generated` files.
- Local textures and fonts are bundled from `public/`.

For more detail, see [docs/deployment.md](/Users/mattfaltyn/Desktop/travel/global_planner/docs/deployment.md).

## Known V1 Limits

- Weather and climate attributes from the original spec are intentionally omitted.
- Route arcs are displayed as undirected pairs with directionality metadata, not as separate directed lines.
- Hover tooltips are disabled on touch-first devices; tap selection remains supported.
- The Playwright suite validates app behavior and routing, not real WebGL rendering fidelity.
