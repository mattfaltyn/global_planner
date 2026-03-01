# Testing Strategy

This repo uses three complementary test layers:

- unit tests for deterministic logic
- component tests for UI and state behavior
- Playwright smoke tests for real browser integration

The Vitest configuration also enforces a full coverage gate.

## Commands

```bash
npm run test
npm run test:e2e
npm run test:all
npx vitest run --coverage
```

If Playwright browsers are not present yet:

```bash
npx playwright install
```

## Coverage Policy

Vitest is configured to require:

- `100%` statements
- `100%` branches
- `100%` functions
- `100%` lines

Coverage applies across:

- `app/`
- `components/`
- `lib/`

The configuration lives in [vitest.config.ts](/Users/mattfaltyn/Desktop/travel/global_planner/vitest.config.ts).

## Unit Tests

Unit tests cover pure logic and data transforms.

Primary areas:

- CSV normalization
- placeholder-to-null conversion
- airport validation
- nonstop route filtering
- degree thresholding
- route deduplication
- distance and duration helpers
- search ranking
- URL query parsing and serialization
- destination filtering and sorting

Key files:

- [buildDataset.test.ts](/Users/mattfaltyn/Desktop/travel/global_planner/tests/unit/buildDataset.test.ts)
- [search-and-selectors.test.ts](/Users/mattfaltyn/Desktop/travel/global_planner/tests/unit/search-and-selectors.test.ts)
- [runtime-utils.test.ts](/Users/mattfaltyn/Desktop/travel/global_planner/tests/unit/runtime-utils.test.ts)

## Component Tests

Component tests exercise React behavior without depending on real WebGL rendering.

Covered behaviors include:

- loading and error states
- dataset hydration
- search input behavior and keyboard navigation
- airport and route selection
- URL synchronization
- side-panel filtering and sorting
- hover tooltip content
- touch-mode panel layout
- dynamic renderer selection behavior

Key files:

- [GlobeShell.test.tsx](/Users/mattfaltyn/Desktop/travel/global_planner/tests/component/GlobeShell.test.tsx)
- [GlobeCanvas.test.tsx](/Users/mattfaltyn/Desktop/travel/global_planner/tests/component/GlobeCanvas.test.tsx)
- [GlobeShell.dynamic.test.tsx](/Users/mattfaltyn/Desktop/travel/global_planner/tests/component/GlobeShell.dynamic.test.tsx)
- [UIAndApp.test.tsx](/Users/mattfaltyn/Desktop/travel/global_planner/tests/component/UIAndApp.test.tsx)

## Browser E2E Tests

Playwright covers the integrated browser path using a local dev server started by [playwright.config.ts](/Users/mattfaltyn/Desktop/travel/global_planner/playwright.config.ts).

The configured server command is:

```bash
NEXT_PUBLIC_E2E=1 npm run dev
```

That mode intentionally changes two things:

- the shell uses `TestGlobeCanvas` instead of the real WebGL globe canvas
- the browser exposes `window.__GLOBAL_PLANNER_TEST_API__`

Why:

- real canvas pointer automation is brittle for route selection
- the browser tests are intended to validate app-state wiring, URL sync, and panel rendering

Current smoke scenarios:

- initial load exposes dataset status and search
- search selects an airport and updates the URL
- test API can select a route and open route detail

The E2E specs live in [globe.spec.ts](/Users/mattfaltyn/Desktop/travel/global_planner/tests/e2e/globe.spec.ts).

## Shared Test Infrastructure

Shared setup lives in [tests/setup.ts](/Users/mattfaltyn/Desktop/travel/global_planner/tests/setup.ts).

Important test doubles:

- `loadDataset()` is mocked in shell tests
- `next/dynamic` is mocked in shell component tests
- `react-globe.gl` is mocked in globe canvas tests
- `matchMedia` is stubbed for touch-mode logic
- `ResizeObserver` is stubbed for canvas sizing logic

## Flake Prevention Rules

- do not assert pixel output from the globe canvas
- prefer semantic text and state assertions over animation timing
- use the hidden dataset status region to confirm dataset readiness
- use the E2E test API for route selection instead of brittle pointer choreography
- keep pure logic in `lib/` testable without DOM or browser dependencies

## Manual QA Checklist

Run this after meaningful UI or rendering changes.

Desktop Chrome:

- page loads without console errors
- globe orbits and zooms smoothly
- hover tooltip appears for airports and routes
- airport selection opens airport detail
- route selection opens route detail

Desktop Safari:

- layout remains stable
- side panel scrolls correctly
- search and result list remain usable

Mobile viewport:

- top search box remains visible
- side panel uses the mobile layout
- tap selection works without hover dependency

Deep links:

- `?airport=<id>` hydrates the correct airport
- `?airport=<id>&route=<routeId>` hydrates the correct route when valid
- invalid route IDs fall back to airport detail

Data sanity:

- visible dataset status matches the committed manifest counts
- route and airport detail panels show no weather fields
