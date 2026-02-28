# Global Planner

Global Planner is a static Next.js app that renders a weather-free v1 flight globe for major airports and direct connections. The app ships prebuilt JSON datasets, runs entirely in the browser at runtime, and is designed for Vercel deployment.

## Stack

- Next.js App Router
- React + TypeScript
- `react-globe.gl` / Three.js
- Vitest + Testing Library
- Playwright

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Place the raw OpenFlights CSVs in the ignored `data/` directory:

- `data/airports.csv`
- `data/routes.csv`

3. Generate the shipped browser datasets:

```bash
npm run build:data
```

4. Start the app:

```bash
npm run dev
```

## Commands

- `npm run dev`: start the Next.js dev server
- `npm run build:data`: generate `public/generated/*.json` from local CSVs
- `npm run build`: create the production build
- `npm run test`: run unit and component tests
- `npm run test:e2e`: run Playwright smoke tests
- `npm run test:all`: run both test layers

## Data Pipeline

The app does not fetch runtime flight data. Instead it loads three committed static files:

- `public/generated/manifest.v1.json`
- `public/generated/airports.v1.json`
- `public/generated/routes.v1.json`

The build script filters the raw CSVs down to:

- nonstop routes only
- airports with undirected degree `>= 30`
- one displayed route per airport pair

See [docs/data-pipeline.md](/Users/mattfaltyn/Desktop/travel/global_planner/docs/data-pipeline.md) for full details.

## Testing

See [docs/testing.md](/Users/mattfaltyn/Desktop/travel/global_planner/docs/testing.md) for the full test strategy and manual QA checklist.

## Deployment Notes

- Generated JSON assets are committed so Vercel does not need raw CSVs at build time.
- The app has no backend, database, or runtime third-party API dependency.
- Fonts and globe textures are shipped locally from `public/`.

## Known V1 Limits

- Weather and climate data are intentionally excluded.
- The globe is desktop-first; touch devices use tap-to-select instead of hover tooltips.
- Routes are displayed as undirected arcs, with one-way vs bidirectional metadata shown in the detail panel.
