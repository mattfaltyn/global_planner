import { searchAirports } from "../../lib/data/search";
import { createFixtureDataset } from "../fixtures/dataset";
import {
  filterAndSortDestinations,
  getAirportBySelection,
  getAirportDestinations,
  getRouteBySelection,
  parseSelectionFromQuery,
  serializeSelectionToQuery,
} from "../../lib/state/selectors";

describe("search and selectors", () => {
  it("prioritizes exact code matches", () => {
    const dataset = createFixtureDataset();
    const results = searchAirports(dataset.airports, "JFK");

    expect(results[0]?.id).toBe("3797");
  });

  it("covers prefix and substring search branches", () => {
    const dataset = createFixtureDataset();

    expect(searchAirports(dataset.airports, "L").map((airport) => airport.id)).toContain("507");
    expect(searchAirports(dataset.airports, "Los")[0]?.id).toBe("3484");
    expect(searchAirports(dataset.airports, "New")[0]?.id).toBe("3797");
    expect(searchAirports(dataset.airports, "united").map((airport) => airport.country)).toContain(
      "United States"
    );
    expect(searchAirports(dataset.airports, "")).toEqual([]);
    expect(searchAirports(dataset.airports, "zzzz")).toEqual([]);
  });

  it("serializes and hydrates query state", () => {
    const dataset = createFixtureDataset();
    const selection = {
      kind: "route" as const,
      routeId: "3797__507",
      airportId: "3797",
    };

    const query = serializeSelectionToQuery(selection);
    expect(query).toBe("?airport=3797&route=3797__507");
    expect(serializeSelectionToQuery(null)).toBe("");

    expect(parseSelectionFromQuery(query, dataset.indexes)).toEqual(selection);
    expect(parseSelectionFromQuery("?airport=3797&route=missing", dataset.indexes)).toEqual({
      kind: "airport",
      airportId: "3797",
    });
    expect(parseSelectionFromQuery("?airport=missing", dataset.indexes)).toBeNull();
    expect(
      parseSelectionFromQuery("?airport=507&route=3484__3797", dataset.indexes)
    ).toEqual({
      kind: "airport",
      airportId: "507",
    });
  });

  it("filters and sorts airport destinations", () => {
    const dataset = createFixtureDataset();
    const items = filterAndSortDestinations(
      [
        {
          airport: dataset.airports[1],
          route: dataset.routes[0],
          distanceKm: dataset.routes[0].distanceKm,
        },
        {
          airport: dataset.airports[2],
          route: dataset.routes[1],
          distanceKm: dataset.routes[1].distanceKm,
        },
      ],
      "los",
      "distance"
    );

    expect(items).toHaveLength(1);
    expect(items[0].airport.id).toBe("3484");

    const alphaSorted = filterAndSortDestinations(
      [
        {
          airport: dataset.airports[2],
          route: dataset.routes[1],
          distanceKm: dataset.routes[1].distanceKm,
        },
        {
          airport: dataset.airports[1],
          route: dataset.routes[0],
          distanceKm: dataset.routes[0].distanceKm,
        },
      ],
      "",
      "name"
    );

    expect(alphaSorted.map((item) => item.airport.id)).toEqual(["507", "3484"]);

    const distanceTieSorted = filterAndSortDestinations(
      [
        {
          airport: dataset.airports[2],
          route: dataset.routes[1],
          distanceKm: 100,
        },
        {
          airport: dataset.airports[1],
          route: dataset.routes[0],
          distanceKm: 100,
        },
      ],
      "",
      "distance"
    );

    expect(distanceTieSorted.map((item) => item.airport.id)).toEqual(["507", "3484"]);
  });

  it("looks up selected airports and routes and handles missing edges", () => {
    const dataset = createFixtureDataset();

    expect(getAirportBySelection(null, dataset.indexes)).toBeNull();
    expect(
      getAirportBySelection({ kind: "airport", airportId: "3797" }, dataset.indexes)?.id
    ).toBe("3797");
    expect(getRouteBySelection(null, dataset.indexes)).toBeNull();
    expect(
      getRouteBySelection(
        { kind: "route", routeId: "3797__507", airportId: "3797" },
        dataset.indexes
      )?.id
    ).toBe("3797__507");
    expect(
      getRouteBySelection(
        { kind: "airport", airportId: "3797" },
        dataset.indexes
      )
    ).toBeNull();
    expect(
      getAirportBySelection({ kind: "airport", airportId: "missing" }, dataset.indexes)
    ).toBeNull();
    expect(
      getRouteBySelection(
        { kind: "route", routeId: "missing", airportId: "3797" },
        dataset.indexes
      )
    ).toBeNull();

    expect(getAirportDestinations("3797", dataset.indexes)).toHaveLength(2);
    expect(getAirportDestinations("missing", dataset.indexes)).toEqual([]);

    const brokenIndexes = {
      ...dataset.indexes,
      airportsById: new Map(dataset.indexes.airportsById),
    };
    brokenIndexes.airportsById.delete("507");

    expect(() => getAirportDestinations("3797", brokenIndexes)).toThrow("Missing airport 507");
  });

  it("filters destinations when codes are unavailable", () => {
    const dataset = createFixtureDataset();
    const items = filterAndSortDestinations(
      [
        {
          airport: {
            ...dataset.airports[0],
            iata: null,
            icao: null,
          },
          route: dataset.routes[0],
          distanceKm: dataset.routes[0].distanceKm,
        },
      ],
      "kennedy",
      "name"
    );

    expect(items).toHaveLength(1);
    expect(items[0].airport.id).toBe("3797");
  });
});
