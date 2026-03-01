# Deployment Notes

This repo is structured for static deployment on Vercel.

## What Production Needs

The production app only needs:

- the application source
- installed dependencies
- the committed files in `public/generated`
- the committed local textures and fonts in `public/`

It does not need:

- `data/airports.csv`
- `data/routes.csv`
- a database
- API credentials
- server-side background jobs

## Vercel Model

At build time:

- Next.js builds the application bundle
- static assets are copied into the deploy output

At runtime:

- the browser loads the main application
- `GlobeShell` fetches the generated JSON assets from `/generated/*.json`
- all interaction happens client-side

## Recommended Deployment Workflow

1. Regenerate the dataset locally when source data changes.
2. Commit changes to `public/generated`.
3. Run:

```bash
npm run test
npm run build
```

4. Push the branch and let Vercel build from the committed assets.

If you are changing core behavior, also run:

```bash
npx vitest run --coverage
npm run test:e2e
```

## Preview Validation Checklist

- app loads without console errors
- globe renders and accepts orbit input
- search selects an airport and updates the URL
- route selection opens route detail
- refreshing a deep link preserves the selected state
- `public/generated/manifest.v1.json` counts match the visible dataset status

## Common Failure Modes

### Missing generated assets

Symptoms:

- loading overlay never clears
- fetches to `/generated/*.json` fail

Fix:

- ensure `public/generated/*.json` exists in the branch being deployed

### Raw CSVs missing during local regeneration

Symptoms:

- `npm run build:data` fails with file read errors

Fix:

- create `data/airports.csv` and `data/routes.csv` locally before regenerating

### Playwright failures in CI

Symptoms:

- browser smoke tests fail before page interaction starts

Fix:

- ensure Playwright browsers are installed
- verify the local dev server can start under `NEXT_PUBLIC_E2E=1`

## Environment Variables

Only one project-specific environment flag is used:

- `NEXT_PUBLIC_E2E=1`

Purpose:

- switches the shell to the E2E test canvas
- enables `window.__GLOBAL_PLANNER_TEST_API__`

This flag should be limited to automated browser testing, not normal production deploys.
