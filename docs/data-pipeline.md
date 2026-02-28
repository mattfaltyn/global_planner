# Data Pipeline

## Source Data

The v1 dataset is built from local OpenFlights CSV files placed in the ignored `data/` directory:

- `data/airports.csv`
- `data/routes.csv`

The app never loads these raw CSVs at runtime.

## Filtering Rules

The build script applies these rules in order:

1. Parse airport and route CSVs.
2. Normalize `\N` placeholder values to `null`.
3. Keep only routes with `Stops === 0`.
4. Drop routes with missing source or destination airport IDs.
5. Build an undirected adjacency graph from the nonstop routes.
6. Keep airports whose undirected degree is at least `30`.
7. Keep only routes where both endpoint airports survive the airport filter.
8. Collapse duplicate airline rows into one canonical undirected airport pair.
9. Mark each route as `bidirectional` or `one-way`.
10. Compute haversine distance and estimated duration.

## Output Schemas

### `manifest.v1.json`

- dataset version
- generation timestamp
- source name
- airport and route counts
- fixed v1 filters

### `airports.v1.json`

- airport identity and location
- IATA / ICAO
- altitude and timezone name
- route count
- precomputed lowercase `searchText`

### `routes.v1.json`

- canonical route ID
- airport pair IDs
- distance in km
- estimated duration in minutes
- `directionality`

## Route Dedupe Policy

Routes are displayed as one arc per airport pair, not one arc per airline row or directed record. This keeps the globe readable while still preserving whether the original data is one-way or bidirectional.

Canonical route ID format:

```text
minAirportId__maxAirportId
```

## Duration Formula

The v1 heuristic is:

```text
round(25 + (distanceKm / 780) * 60)
```

This is intentionally approximate and is used for UI context only.

## Regeneration

```bash
npm run build:data
```

This writes:

- `public/generated/manifest.v1.json`
- `public/generated/airports.v1.json`
- `public/generated/routes.v1.json`

The generated JSON files are committed. Raw CSVs remain local-only and ignored by git.

## Determinism

Generated records are sorted deterministically:

- airports by `name`, then `id`
- routes by `airportAId`, then `airportBId`

Only `generatedAt` changes across equivalent rebuilds.

## Attribution Notes

- Flight data source: OpenFlights-style CSV inputs supplied locally.
- Local globe textures are shipped from `public/textures/` as repo-owned assets for v1.
