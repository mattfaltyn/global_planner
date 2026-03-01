import type {
  DatasetIndexes,
  DestinationListItem,
  RouteRecord,
  RouteSortKey,
  SelectionState,
} from "../data/types";

export function getAirportBySelection(
  selection: SelectionState,
  indexes: DatasetIndexes
) {
  if (!selection) {
    return null;
  }

  return indexes.airportsById.get(selection.airportId) ?? null;
}

export function getRouteBySelection(
  selection: SelectionState,
  indexes: DatasetIndexes
) {
  if (!selection || selection.kind !== "route") {
    return null;
  }

  return indexes.routesById.get(selection.routeId) ?? null;
}

export function getAirportDestinations(
  airportId: string,
  indexes: DatasetIndexes
): DestinationListItem[] {
  return (indexes.routeIdsByAirportId.get(airportId) ?? [])
    .map((routeId) => indexes.routesById.get(routeId))
    .filter((route): route is RouteRecord => Boolean(route))
    .map((route) => {
      const destinationId =
        route.airportAId === airportId ? route.airportBId : route.airportAId;
      const airport = indexes.airportsById.get(destinationId);

      if (!airport) {
        throw new Error(`Missing airport ${destinationId}`);
      }

      return {
        airport,
        route,
        distanceKm: route.distanceKm,
      };
    });
}

export function filterAndSortDestinations(
  items: DestinationListItem[],
  query: string,
  sortKey: RouteSortKey
) {
  const normalizedQuery = query.trim().toLowerCase();

  return items
    .filter((item) => {
      if (!normalizedQuery) {
        return true;
      }

      return [
        item.airport.name,
        item.airport.city,
        item.airport.country,
        item.airport.iata ?? "",
        item.airport.icao ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .sort((left, right) => {
      if (sortKey === "distance") {
        return left.distanceKm - right.distanceKm || left.airport.name.localeCompare(right.airport.name);
      }

      return left.airport.name.localeCompare(right.airport.name);
    });
}

export function serializeSelectionToQuery(selection: SelectionState) {
  const params = new URLSearchParams();

  if (!selection) {
    return "";
  }

  params.set("airport", selection.airportId);

  if (selection.kind === "route") {
    params.set("route", selection.routeId);
  }

  return `?${params.toString()}`;
}

export function parseSelectionFromQuery(
  search: string,
  indexes: DatasetIndexes
): SelectionState {
  const params = new URLSearchParams(search);
  const airportId = params.get("airport");
  const routeId = params.get("route");

  if (!airportId || !indexes.airportsById.has(airportId)) {
    return null;
  }

  if (!routeId) {
    return {
      kind: "airport",
      airportId,
    };
  }

  const route = indexes.routesById.get(routeId);
  if (!route) {
    return {
      kind: "airport",
      airportId,
    };
  }

  if (route.airportAId !== airportId && route.airportBId !== airportId) {
    return {
      kind: "airport",
      airportId,
    };
  }

  return {
    kind: "route",
    routeId,
    airportId,
  };
}
