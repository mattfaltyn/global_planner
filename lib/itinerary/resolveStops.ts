import type { AirportRecord, ItineraryStop } from "../data/types";
import { seededItineraryStops, type SeedStopInput } from "./seed";

function parseDateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

export function getDayCount(
  arrivalDate: string | null,
  departureDate: string | null
) {
  if (!arrivalDate || !departureDate) {
    return null;
  }

  const arrival = parseDateParts(arrivalDate);
  const departure = parseDateParts(departureDate);
  const arrivalUtc = Date.UTC(arrival.year, arrival.month - 1, arrival.day);
  const departureUtc = Date.UTC(
    departure.year,
    departure.month - 1,
    departure.day
  );

  return Math.round((departureUtc - arrivalUtc) / 86_400_000);
}

export function resolveAirportAnchorByCityCountry(
  airports: AirportRecord[],
  city: string,
  country: string
) {
  return airports
    .filter((airport) => airport.city === city && airport.country === country)
    .sort((left, right) => {
      return (
        right.routeCount - left.routeCount ||
        left.name.localeCompare(right.name)
      );
    })[0] ?? null;
}

export function buildStopFromAirport(
  airport: AirportRecord,
  nextOrdinal: number,
  insert: Partial<Pick<ItineraryStop, "notes" | "arrivalDate" | "departureDate" | "kind">> = {}
): ItineraryStop {
  const arrivalDate = insert.arrivalDate ?? null;
  const departureDate = insert.departureDate ?? null;

  return {
    id: `stop-${nextOrdinal}`,
    kind: insert.kind ?? "stay",
    label: airport.city,
    city: airport.city,
    country: airport.country,
    anchorAirportId: airport.id,
    lat: airport.lat,
    lon: airport.lon,
    arrivalDate,
    departureDate,
    dayCount: getDayCount(arrivalDate, departureDate),
    notes: insert.notes ?? "",
    unresolved: false,
  };
}

export function resolveSeedStop(
  seed: SeedStopInput,
  airports: AirportRecord[],
  index: number
): ItineraryStop {
  const airport = resolveAirportAnchorByCityCountry(
    airports,
    seed.city,
    seed.country
  );

  return {
    id: `seed-stop-${index}`,
    kind: seed.kind,
    label: seed.city,
    city: seed.city,
    country: seed.country,
    anchorAirportId: airport?.id ?? null,
    lat: airport?.lat ?? null,
    lon: airport?.lon ?? null,
    arrivalDate: seed.arrivalDate,
    departureDate: seed.departureDate,
    dayCount: getDayCount(seed.arrivalDate, seed.departureDate),
    notes: seed.notes,
    unresolved: !airport,
  };
}

export function resolveSeededItinerary(airports: AirportRecord[]) {
  return seededItineraryStops.map((seed, index) =>
    resolveSeedStop(seed, airports, index)
  );
}
