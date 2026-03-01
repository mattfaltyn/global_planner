# Testing Strategy

This repo uses three test layers:

- unit tests for pure itinerary and dataset logic
- component tests for reducer-driven UI behavior
- Playwright smoke tests for integrated browser flows

Vitest also enforces a full coverage gate.

## Commands

```bash
npm run test
npm run test:e2e
npm run test:all
npx vitest run --coverage
```

If Playwright browsers are not installed yet:

```bash
npx playwright install
```

## Coverage Policy

Vitest requires:

- `100%` statements
- `100%` branches
- `100%` functions
- `100%` lines

Coverage applies across:

- `app/`
- `components/`
- `lib/`

Configuration lives in [vitest.config.ts](/Users/mattfaltyn/Desktop/travel/global_planner/vitest.config.ts).

## Unit Tests

Unit tests cover deterministic logic such as:

- dataset normalization
- airport validation and route filtering
- seed itinerary resolution
- repeated-city stop handling
- day-count computation
- leg derivation and mode inference
- low-altitude air and ground path generation
- whole-trip timeline segment math
- trip-progress playback helpers
- URL parse and serialize helpers
- itinerary selectors and summary helpers

Key files:

- [buildDataset.test.ts](/Users/mattfaltyn/Desktop/travel/global_planner/tests/unit/buildDataset.test.ts)
- [search-and-selectors.test.ts](/Users/mattfaltyn/Desktop/travel/global_planner/tests/unit/search-and-selectors.test.ts)
- [runtime-utils.test.ts](/Users/mattfaltyn/Desktop/travel/global_planner/tests/unit/runtime-utils.test.ts)

## Component Tests

Component tests exercise React behavior without depending on real WebGL output.

Covered areas:

- dataset loading and seeded itinerary hydration
- stop and leg selection
- whole-trip playback controls and scrubber behavior
- search-as-add-stop behavior
- dock playback/edit mode switching
- stop editing and anchor replacement
- hover tooltip content
- path-based globe render props
- traveler marker behavior at timeline boundaries
- dynamic renderer selection for test mode

Key files:

- [GlobeShell.test.tsx](/Users/mattfaltyn/Desktop/travel/global_planner/tests/component/GlobeShell.test.tsx)
- [GlobeCanvas.test.tsx](/Users/mattfaltyn/Desktop/travel/global_planner/tests/component/GlobeCanvas.test.tsx)
- [GlobeShell.dynamic.test.tsx](/Users/mattfaltyn/Desktop/travel/global_planner/tests/component/GlobeShell.dynamic.test.tsx)
- [UIAndApp.test.tsx](/Users/mattfaltyn/Desktop/travel/global_planner/tests/component/UIAndApp.test.tsx)

## Browser E2E Tests

Playwright runs against an isolated local server started by [playwright.config.ts](/Users/mattfaltyn/Desktop/travel/global_planner/playwright.config.ts).

The browser server command is:

```bash
NEXT_PUBLIC_E2E=1 npm run build && NEXT_PUBLIC_E2E=1 npm run start -- --port 3100
```

That mode intentionally changes two things:

- `GlobeShell` uses `TestGlobeCanvas` instead of the real WebGL globe
- the browser exposes `window.__GLOBAL_PLANNER_TEST_API__`

The isolated server avoids reusing an already-running local dev server, which keeps `NEXT_PUBLIC_E2E=1` deterministic and prevents WebGL-only code paths from leaking into browser automation.

The E2E suite is meant to validate:

- itinerary-first loading
- playback bar wiring
- dock mode behavior
- URL synchronization
- stable browser-level state transitions

It is not meant to validate pixel-perfect WebGL fidelity.

Current smoke flows:

- initial load shows dataset status, playback UI, and itinerary summary
- search adds a stop and opens edit mode
- whole-trip playback advances and updates progress
- the test API can jump to itinerary legs and expose state

Specs live in [globe.spec.ts](/Users/mattfaltyn/Desktop/travel/global_planner/tests/e2e/globe.spec.ts).

## Shared Test Infrastructure

Shared setup lives in [tests/setup.ts](/Users/mattfaltyn/Desktop/travel/global_planner/tests/setup.ts).

Important doubles:

- `loadDataset()` is mocked in shell tests
- `next/dynamic` is mocked in shell tests
- `react-globe.gl` is mocked in globe canvas tests
- `matchMedia` is stubbed for touch-mode logic
- `ResizeObserver` is stubbed for sizing logic

## Flake Prevention Rules

- do not assert pixel output from the real globe canvas
- prefer state and semantic text assertions over animation timing details
- use the hidden dataset status region to confirm readiness
- use the guarded E2E test API for itinerary selection when browser pointer automation would be brittle
- keep timeline and interpolation logic in pure helpers under `lib/`

## Manual QA Checklist

Desktop Chrome:

- page loads without console errors
- no global route network is visible by default
- country borders, itinerary stops, and itinerary legs render
- play/pause/reset/next/previous controls work
- the traveler marker moves across the whole trip, not just one leg
- switching the dock between `Playback` and `Edit` works

Desktop Safari:

- layout remains stable
- the floating playback bar stays usable
- search and edit tools remain responsive

Mobile viewport:

- search stays visible
- playback bar stays above the bottom edge
- dock remains usable as a reduced mobile sheet

Deep links:

- `?stop=<id>` hydrates the correct stop
- `?leg=<id>` hydrates the correct leg
- invalid params fall back cleanly

Data sanity:

- dataset status matches the committed manifest counts
- no weather fields appear in the UI
