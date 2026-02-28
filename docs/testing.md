# Testing Strategy

## Layers

### Unit

Unit tests cover:

- CSV normalization
- nonstop route filtering
- degree thresholding
- route dedupe and canonical IDs
- distance and duration helpers
- search ranking
- URL query serialization and parsing
- destination filtering and sorting

### Component

Component tests focus on app behavior while mocking the WebGL globe:

- loading state
- dataset load failure
- search interaction
- URL updates after selection
- route detail rendering via deep link hydration
- panel filtering and sorting
- mobile panel class selection

### E2E

Playwright smoke tests cover the browser-integrated path with the app running under `NEXT_PUBLIC_E2E=1`.

The app exposes a guarded `window.__GLOBAL_PLANNER_TEST_API__` only in that mode to avoid brittle canvas pointer automation for route selection.

## Commands

```bash
npm run test
npm run test:e2e
npm run test:all
```

## Mocking Notes

- `loadDataset()` is mocked in component tests.
- `next/dynamic` is mocked so component tests do not load `react-globe.gl`.
- `matchMedia` and `ResizeObserver` are stubbed in the shared test setup.

## Flake Prevention

- Avoid pixel assertions for the globe canvas.
- Use the hidden dataset status region to confirm hydration in E2E.
- Prefer search and explicit test API methods over drag/hover automation for browser smoke tests.

## Manual QA Checklist

- Desktop Chrome: load, orbit, hover, select airport, select route
- Desktop Safari: layout, panel overflow, search behavior
- Mobile viewport: bottom-sheet panel, tap selection, search placement
- Confirm URL deep links rehydrate the correct airport or route state
- Confirm generated dataset counts match the manifest
