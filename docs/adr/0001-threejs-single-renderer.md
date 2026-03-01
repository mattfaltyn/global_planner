# ADR 0001: Use A Single Three.js-Based Globe Renderer For V1

## Status

Accepted

## Date

2026-03-01

## Context

The original product spec proposed a dual-layer rendering model:

- a custom Three.js globe for the Earth and atmosphere
- a transparent deck.gl `GlobeView` overlay for airports and routes

That design is attractive in theory, but it introduces extra coordination cost:

- two rendering surfaces
- two camera models
- cross-layer interaction synchronization
- more complex testing and debugging

For v1, the product needed a reliable path to:

- orbit and zoom interactions
- hover and click picking
- smooth airport fly-to
- static deployment on Vercel
- maintainable tests

The original spec also depended on deck.gl `GlobeView`, which the official docs still describe as experimental and document with camera limitations that do not align cleanly with the intended synced-orbit experience.

References:

- [deck.gl GlobeView API](https://deck.gl/docs/api-reference/core/globe-view)
- [deck.gl Views Overview](https://deck.gl/docs/api-reference/core/views)

## Decision

V1 uses a single Three.js-based globe renderer via `react-globe.gl`.

The chosen stack provides:

- globe rendering
- atmosphere support
- background imagery
- airport point rendering
- route arc rendering
- orbit controls
- hover and click hooks
- camera `pointOfView` fly-to support

Application logic remains local to the repo:

- dataset generation
- dataset loading
- search
- URL state
- selection reducers
- side-panel UI
- tooltip rendering

## Why This Was Better For V1

This decision optimizes for shipping a robust first release, not for maximum rendering purity.

Benefits:

- one camera system instead of syncing two
- simpler interaction handling
- lower implementation risk
- lower regression risk during refactors
- easier component testing with focused mocks

## Consequences

Positive:

- faster path to a stable product
- less custom rendering glue code
- easier onboarding for contributors
- cleaner mental model for debugging selection and hover issues

Tradeoffs:

- less faithful to the original spec architecture
- fewer low-level rendering extension points than a bespoke Three.js scene
- future extremely high-density rendering work may require reevaluation

## Alternatives Considered

### Three.js + deck.gl `GlobeView`

Rejected for v1 because:

- experimental API surface
- more moving parts
- more difficult camera and picking coordination

### Fully custom Three.js scene

Rejected for v1 because:

- more time to implement
- custom picking and route rendering would add product risk
- unnecessary complexity for the current data size

## Revisit Criteria

Revisit this ADR if one of these becomes true:

- the route or airport density materially outgrows current renderer performance
- v2 requires specialized layered effects not supported cleanly by `react-globe.gl`
- the project needs lower-level rendering control than the current abstraction can provide
