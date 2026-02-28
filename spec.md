# Product Spec

## Goal

Deploy a **single Vercel-hosted** web app (no external backend/services) that renders a **beautiful, interactive 3D Earth globe** with airports and direct-flight connections.

## Core Experience

### Globe

* 3D Earth with smooth orbit/zoom and search + hover/select interactions.

### Airports (nodes)

* Render **all major airports** as static points.
* Hover/select shows airport attributes.

**Schema**

* `name`: string
* `iata` / `icao` (optional): string
* `lat`, `lon`: number
* `closest_city`: string
* `climate.monthly_high_c`: number[12]
* `climate.monthly_low_c`: number[12]
* `climate.monthly_rain_mm`: number[12]
* `climate.monthly_snow_cm`: number[12]
* `climate.avg_wind_kmh`: number

### Direct flight paths (edges)

* Render all **direct routes** between listed airports as static arcs.
* Hover/select shows route attributes.

**Schema**

* `from_airport_id`: string
* `to_airport_id`: string
* `distance_km`: number
* `estimated_duration_min`: number

## Constraints

* Must run fully in-browser (static assets + client compute).
* Data shipped with the app build (no runtime dependency on third-party APIs).

---

## Tech Stack

### Framework / Build

* **Next.js (App Router) on Vercel**
* Static asset hosting for textures + datasets (`/public`)

### Rendering

**Base globe (beauty layer)**

* **Three.js** renders:

  * Earth sphere with high-res equirectangular texture(s) (day + optional night lights)
  * Atmosphere shell (slightly larger sphere) with additive glow shader/material
  * Optional starfield background
  * Cinematic lighting (directional “sun” + subtle ambient)

**Data visualization (interaction layer)**

* **deck.gl (vis.gl)** renders on a transparent canvas overlay:

  * `GlobeView` for globe projection
  * `ScatterplotLayer` for airports (GPU picking + hover)
  * `ArcLayer` for flight paths (GPU picking + hover)
  * Tooltip/selection state management (hover = lightweight; click = detailed panel)

**Composition**

* Two stacked canvases:

  1. Three.js canvas (Earth + atmosphere)
  2. deck.gl canvas (airports + arcs), transparent background
* Camera sync:

  * Three.js controls the orbit camera (damping/easing)
  * deck.gl `viewState` is derived from the Three.js camera each frame to keep arcs/nodes perfectly aligned

### Visual Polish (deck.gl styling)

* “Glow” via layer stacking:

  * Draw arcs twice (wide, low-opacity underlay + thin bright core)
  * Optionally same technique for airport points
* Horizon fade:

  * Reduce opacity near the limb for points/arcs to avoid harsh edges
* Distance-based arc height/thickness:

  * Longer routes get slightly higher arcs and thicker core lines

### Post-processing (optional)

* deck.gl **Effects**:

  * Anti-aliasing pass (e.g., FXAA) for smoother arcs/points
  * Subtle bloom-like treatment if implemented as a post-process pass (kept minimal)

### Data / Formats

* Airports + routes bundled at build time as:

  * JSON (simple) or binary-friendly format (e.g., Arrow) converted client-side
* ID indexing for fast lookup:

  * `airport_id -> record`
  * `airport_id -> outgoing_routes[]`

### UI

* Search box (airport name / IATA / city) with “fly-to” animation
* Hover tooltip (small, 2–4 key fields)
* Click side panel (full feature vectors + route list/filtering)

### Performance Targets

* Smooth interaction with ~8k airports + ~20k arcs on modern laptops
* Progressive rendering/LOD:

  * Reduce arc opacity/density when zoomed out
  * Show full detail on selection or closer zoom levels