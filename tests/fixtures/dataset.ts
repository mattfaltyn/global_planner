import { buildIndexes } from "../../lib/data/indexes";
import type { LoadedDataset } from "../../lib/data/types";
import { deriveLegs } from "../../lib/itinerary/deriveLegs";
import { resolveSeededItinerary } from "../../lib/itinerary/resolveStops";

export const fixtureAirports = [
  {
    id: "1",
    name: "Vancouver International Airport",
    city: "Vancouver",
    country: "Canada",
    iata: "YVR",
    icao: "CYVR",
    lat: 49.1947,
    lon: -123.1792,
    altitudeFt: 14,
    tzName: "America/Vancouver",
    routeCount: 140,
    searchText: "vancouver international airport vancouver canada yvr cyvr",
  },
  {
    id: "2",
    name: "Francisco Sa Carneiro Airport",
    city: "Porto",
    country: "Portugal",
    iata: "OPO",
    icao: "LPPR",
    lat: 41.2481,
    lon: -8.6814,
    altitudeFt: 228,
    tzName: "Europe/Lisbon",
    routeCount: 112,
    searchText: "francisco sa carneiro airport porto portugal opo lppr",
  },
  {
    id: "3",
    name: "Humberto Delgado Airport",
    city: "Lisbon",
    country: "Portugal",
    iata: "LIS",
    icao: "LPPT",
    lat: 38.7742,
    lon: -9.1342,
    altitudeFt: 374,
    tzName: "Europe/Lisbon",
    routeCount: 160,
    searchText: "humberto delgado airport lisbon portugal lis lppt",
  },
  {
    id: "4",
    name: "Cascais Municipal Aerodrome",
    city: "Lisbon",
    country: "Portugal",
    iata: null,
    icao: "LPCS",
    lat: 38.7249,
    lon: -9.3552,
    altitudeFt: 325,
    tzName: "Europe/Lisbon",
    routeCount: 5,
    searchText: "cascais municipal aerodrome lisbon portugal lpcs",
  },
  {
    id: "5",
    name: "Faro Airport",
    city: "Faro",
    country: "Portugal",
    iata: "FAO",
    icao: "LPFR",
    lat: 37.0144,
    lon: -7.9659,
    altitudeFt: 24,
    tzName: "Europe/Lisbon",
    routeCount: 80,
    searchText: "faro airport faro portugal fao lpfr",
  },
  {
    id: "6",
    name: "Barcelona El Prat Airport",
    city: "Barcelona",
    country: "Spain",
    iata: "BCN",
    icao: "LEBL",
    lat: 41.2974,
    lon: 2.0833,
    altitudeFt: 12,
    tzName: "Europe/Madrid",
    routeCount: 170,
    searchText: "barcelona el prat airport barcelona spain bcn lebl",
  },
  {
    id: "7",
    name: "Valencia Airport",
    city: "Valencia",
    country: "Spain",
    iata: "VLC",
    icao: "LEVC",
    lat: 39.4893,
    lon: -0.4816,
    altitudeFt: 240,
    tzName: "Europe/Madrid",
    routeCount: 75,
    searchText: "valencia airport valencia spain vlc levc",
  },
  {
    id: "8",
    name: "Alicante Elche Airport",
    city: "Alicante",
    country: "Spain",
    iata: "ALC",
    icao: "LEAL",
    lat: 38.2822,
    lon: -0.5582,
    altitudeFt: 142,
    tzName: "Europe/Madrid",
    routeCount: 74,
    searchText: "alicante elche airport alicante spain alc leal",
  },
  {
    id: "9",
    name: "Adolfo Suarez Madrid-Barajas Airport",
    city: "Madrid",
    country: "Spain",
    iata: "MAD",
    icao: "LEMD",
    lat: 40.4983,
    lon: -3.5676,
    altitudeFt: 2000,
    tzName: "Europe/Madrid",
    routeCount: 180,
    searchText: "adolfo suarez madrid-barajas airport madrid spain mad lemd",
  },
] as const;

export const fixtureRoutes = [
  {
    id: "1__2",
    airportAId: "1",
    airportBId: "2",
    distanceKm: 7490,
    estimatedDurationMin: 601,
    directionality: "bidirectional",
  },
  {
    id: "2__3",
    airportAId: "2",
    airportBId: "3",
    distanceKm: 275,
    estimatedDurationMin: 46,
    directionality: "bidirectional",
  },
  {
    id: "3__5",
    airportAId: "3",
    airportBId: "5",
    distanceKm: 216,
    estimatedDurationMin: 42,
    directionality: "bidirectional",
  },
  {
    id: "3__6",
    airportAId: "3",
    airportBId: "6",
    distanceKm: 1006,
    estimatedDurationMin: 102,
    directionality: "bidirectional",
  },
  {
    id: "6__7",
    airportAId: "6",
    airportBId: "7",
    distanceKm: 303,
    estimatedDurationMin: 48,
    directionality: "bidirectional",
  },
  {
    id: "7__8",
    airportAId: "7",
    airportBId: "8",
    distanceKm: 126,
    estimatedDurationMin: 35,
    directionality: "bidirectional",
  },
  {
    id: "8__9",
    airportAId: "8",
    airportBId: "9",
    distanceKm: 360,
    estimatedDurationMin: 53,
    directionality: "bidirectional",
  },
] as const;

export function createFixtureDataset(): LoadedDataset {
  const airports = fixtureAirports.map((airport) => ({ ...airport }));
  const routes = fixtureRoutes.map((route) => ({ ...route }));

  return {
    manifest: {
      version: "v1",
      generatedAt: "2026-03-01T00:00:00.000Z",
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

export function createResolvedFixtureItinerary() {
  const dataset = createFixtureDataset();
  const stops = resolveSeededItinerary(dataset.airports);
  const legs = deriveLegs(stops);

  return {
    dataset,
    stops,
    legs,
  };
}
