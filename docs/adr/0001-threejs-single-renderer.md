# ADR 0001: Use A Single Three.js-Based Renderer For V1

## Status

Accepted

## Context

The original product spec proposed a dual-canvas composition:

- Three.js for the Earth beauty layer
- deck.gl `GlobeView` for airport and route overlays

That architecture increases implementation complexity and depends on `GlobeView`, which deck.gl still documents as experimental. The documented camera limitations conflict with the desired synced-orbit experience for v1.

References:

- [deck.gl GlobeView API](https://deck.gl/docs/api-reference/core/globe-view)
- [deck.gl Views Overview](https://deck.gl/docs/api-reference/core/views)

## Decision

V1 uses a single Three.js-based renderer via `react-globe.gl`.

The library provides:

- textured globe rendering
- atmosphere/background support
- point and arc layers
- orbit controls
- picking hooks
- camera fly-to APIs

Application state, dataset transforms, search, tooltip rendering, and detail panel behavior remain in local app code.

## Consequences

Positive:

- simpler orbit camera behavior
- no cross-canvas sync layer
- lower implementation and test risk
- easier route and airport picking

Tradeoffs:

- less faithful to the original deck.gl layering spec
- fewer low-level rendering customization points than a fully bespoke Three.js scene

## Follow-Up

If v2 needs more specialized visual layers or higher airport/route density, reevaluate a custom Three.js scene or a more mature globe-overlay stack.
