import { buildIndexes } from "../../lib/data/indexes";
import type { LoadedDataset } from "../../lib/data/types";

export const fixtureAirports = [
  {
    id: "3797",
    name: "John F Kennedy International Airport",
    city: "New York",
    country: "United States",
    iata: "JFK",
    icao: "KJFK",
    lat: 40.6413,
    lon: -73.7781,
    altitudeFt: 13,
    tzName: "America/New_York",
    routeCount: 2,
    searchText:
      "john f kennedy international airport new york united states jfk kjfk",
  },
  {
    id: "507",
    name: "Heathrow Airport",
    city: "London",
    country: "United Kingdom",
    iata: "LHR",
    icao: "EGLL",
    lat: 51.47,
    lon: -0.4543,
    altitudeFt: 83,
    tzName: "Europe/London",
    routeCount: 2,
    searchText: "heathrow airport london united kingdom lhr egll",
  },
  {
    id: "3484",
    name: "Los Angeles International Airport",
    city: "Los Angeles",
    country: "United States",
    iata: "LAX",
    icao: "KLAX",
    lat: 33.9416,
    lon: -118.4085,
    altitudeFt: 125,
    tzName: "America/Los_Angeles",
    routeCount: 2,
    searchText: "los angeles international airport los angeles united states lax klax",
  },
] as const;

export const fixtureRoutes = [
  {
    id: "3797__507",
    airportAId: "3797",
    airportBId: "507",
    distanceKm: 5540,
    estimatedDurationMin: 451,
    directionality: "bidirectional",
  },
  {
    id: "3484__3797",
    airportAId: "3484",
    airportBId: "3797",
    distanceKm: 3974,
    estimatedDurationMin: 331,
    directionality: "bidirectional",
  },
] as const;

export function createFixtureDataset(): LoadedDataset {
  const airports = fixtureAirports.map((airport) => ({ ...airport }));
  const routes = fixtureRoutes.map((route) => ({ ...route }));

  return {
    manifest: {
      version: "v1",
      generatedAt: "2026-02-28T00:00:00.000Z",
      source: "openflights",
      airportCount: airports.length,
      routeCount: routes.length,
      filters: {
        routeStops: 0,
        minimumUndirectedDegree: 30,
      },
    },
    airports,
    routes,
    indexes: buildIndexes(airports, routes),
  };
}
