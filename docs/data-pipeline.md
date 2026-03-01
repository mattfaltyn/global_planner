# Data Pipeline

This document describes how the committed v1 dataset is produced.

## Inputs

The build step reads two local CSV files from the git-ignored `data/` directory:

- `data/airports.csv`
- `data/routes.csv`

These are OpenFlights-style CSV exports. They are never shipped to the browser.

## Output Files

The pipeline writes three committed JSON artifacts:

- [manifest.v1.json](/Users/mattfaltyn/Desktop/travel/global_planner/public/generated/manifest.v1.json)
- [airports.v1.json](/Users/mattfaltyn/Desktop/travel/global_planner/public/generated/airports.v1.json)
- [routes.v1.json](/Users/mattfaltyn/Desktop/travel/global_planner/public/generated/routes.v1.json)

The current checked-in manifest reports:

- `336` airports
- `7,537` route pairs
- nonstop-only routes
- minimum undirected airport degree of `30`

## Why The Dataset Is Prebuilt

The product constraint for v1 is a static, client-only runtime:

- no runtime backend
- no third-party flight API
- no server-side dataset transformation

Precomputing the dataset keeps the browser path simple and ensures Vercel deploys do not require the raw CSVs.

## Transformation Steps

The implementation lives in [buildDataset.ts](/Users/mattfaltyn/Desktop/travel/global_planner/lib/data/buildDataset.ts) and [build-datasets.ts](/Users/mattfaltyn/Desktop/travel/global_planner/scripts/build-datasets.ts).

The pipeline performs these steps:

1. Parse airport rows.
2. Parse route rows.
3. Normalize placeholder values:
   - `\N` becomes `null`
   - empty strings become `null`
4. Drop airport rows that are not `Type === "airport"`.
5. Drop airport rows with invalid latitude or longitude.
6. Keep only route rows with `Stops === 0`.
7. Drop route rows with missing source or destination airport IDs.
8. Build an undirected adjacency map from the filtered nonstop routes.
9. Keep airports whose undirected degree is at least `30`.
10. Keep only routes whose endpoints both survive the airport filter and exist in the normalized airport set.
11. Collapse duplicate airline rows into one canonical undirected airport pair.
12. Compute route distance with haversine.
13. Compute estimated duration with the v1 heuristic.
14. Compute `routeCount` for each retained airport.
15. Precompute `searchText` for client-side search.
16. Sort the output deterministically.

## Inclusion Rules

### Airports

An airport is retained only if:

- its row is typed as an airport
- its latitude and longitude are valid numbers
- it participates in the nonstop route graph
- its undirected nonstop degree is `>= 30`

This is the v1 definition of a "major airport."

### Routes

A route is retained only if:

- it is nonstop
- both endpoint airport IDs are present
- both endpoint airports survive the airport filter

The displayed route graph is one arc per airport pair, not one arc per airline row.

## Canonical Route Identity

Routes are stored with this ID format:

```text
minAirportId__maxAirportId
```

That same ID is used in:

- `routes.v1.json`
- runtime indexes
- route selection URLs
- tests

## Directionality

Although only one arc is rendered per airport pair, the pipeline still tracks whether the original data showed service in one or both directions:

- `bidirectional`
- `one-way`

This value is displayed in the route detail panel.

## Duration Heuristic

The route duration estimate is intentionally approximate:

```text
round(25 + (distanceKm / 780) * 60)
```

It is UI context only and should not be interpreted as schedule data.

## Output Schemas

### Manifest

```ts
type DatasetManifest = {
  version: "v1";
  generatedAt: string;
  source: "openflights";
  airportCount: number;
  routeCount: number;
  filters: {
    routeStops: 0;
    minimumUndirectedDegree: 30;
  };
};
```

### Airports

```ts
type AirportRecord = {
  id: string;
  name: string;
  city: string;
  country: string;
  iata: string | null;
  icao: string | null;
  lat: number;
  lon: number;
  altitudeFt: number | null;
  tzName: string | null;
  routeCount: number;
  searchText: string;
};
```

### Routes

```ts
type RouteRecord = {
  id: string;
  airportAId: string;
  airportBId: string;
  distanceKm: number;
  estimatedDurationMin: number;
  directionality: "bidirectional" | "one-way";
};
```

## Determinism

For equivalent input CSVs, the output is deterministic except for `generatedAt`.

Sort rules:

- airports by `name`, then `id`
- routes by `airportAId`, then `airportBId`

This matters for:

- clean diffs in `public/generated`
- predictable tests
- stable selection IDs

## Regeneration Workflow

```bash
npm run build:data
```

What happens:

1. raw CSVs are read from `data/`
2. the dataset is transformed
3. JSON files are written into `public/generated`
4. the script prints the generated airport and route counts

## Source Control Policy

- raw CSVs stay local and ignored by git
- generated JSON is committed
- Vercel builds from committed JSON assets, not the raw sources

## Failure Modes

Typical regeneration failures:

- missing `data/airports.csv`
- missing `data/routes.csv`
- malformed CSV headers
- invalid or inconsistent airport IDs in the source data

The pipeline already defends against missing endpoints and invalid airport rows, but it assumes the CSV column layout matches the expected OpenFlights-style schema.
