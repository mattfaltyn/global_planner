import { searchAirports } from "../../lib/data/search";
import { createFixtureDataset } from "../fixtures/dataset";
import {
  filterAndSortDestinations,
  parseSelectionFromQuery,
  serializeSelectionToQuery,
} from "../../lib/state/selectors";

describe("search and selectors", () => {
  it("prioritizes exact code matches", () => {
    const dataset = createFixtureDataset();
    const results = searchAirports(dataset.airports, "JFK");

    expect(results[0]?.id).toBe("3797");
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

    expect(parseSelectionFromQuery(query, dataset.indexes)).toEqual(selection);
    expect(parseSelectionFromQuery("?airport=3797&route=missing", dataset.indexes)).toEqual({
      kind: "airport",
      airportId: "3797",
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
  });
});
