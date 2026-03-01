import nextConfig from "../../next.config";
import playwrightConfig from "../../playwright.config";
import { assertExists } from "../../lib/utils/assert";
import { formatCoordinates, formatDistance, formatDuration } from "../../lib/data/formatters";
import { loadDataset } from "../../lib/data/loadDataset";
import { getHoverContent } from "../../components/globe/GlobeShell";
import { getAirportPointOfView, getFlyDurationMs } from "../../lib/globe/camera";
import { globeColors } from "../../lib/globe/colors";
import { getRouteAltitude, getRouteStroke } from "../../lib/globe/routeGeometry";
import { appReducer, initialAppState } from "../../lib/state/appState";
import { createFixtureDataset } from "../fixtures/dataset";

describe("runtime config and utility modules", () => {
  it("exports the expected Next.js and Playwright config", () => {
    expect(nextConfig.reactStrictMode).toBe(true);
    expect(nextConfig.allowedDevOrigins).toEqual(["127.0.0.1", "localhost"]);
    expect(playwrightConfig.webServer?.command).toContain("NEXT_PUBLIC_E2E=1");
    expect(playwrightConfig.use?.baseURL).toBe("http://127.0.0.1:3000");
  });

  it("formats distances, durations, and coordinates", () => {
    expect(formatDistance(5540)).toBe("5,540 km");
    expect(formatDuration(59)).toBe("59 min");
    expect(formatDuration(125)).toBe("2h 5m");
    expect(formatCoordinates(40.6413, -73.7781)).toBe("40.64° N · 73.78° W");
  });

  it("covers globe geometry helpers and constants", () => {
    expect(getAirportPointOfView(10, 20)).toEqual({
      lat: 10,
      lng: 20,
      altitude: 1.6,
    });
    expect(getFlyDurationMs(true)).toBe(450);
    expect(getFlyDurationMs(false)).toBe(900);
    expect(globeColors.routeSelected).toBe("rgba(255, 184, 112, 0.9)");
    expect(getRouteAltitude(100)).toBeCloseTo(0.04);
    expect(getRouteAltitude(30000)).toBeCloseTo(0.2);
    expect(getRouteStroke(1000, false)).toBeCloseTo(0.14);
    expect(getRouteStroke(12000, true)).toBeCloseTo(0.7254545455);
  });

  it("loads the dataset and builds indexes", async () => {
    const dataset = createFixtureDataset();
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(dataset.manifest), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(dataset.airports), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(dataset.routes), { status: 200 })
      );

    const loaded = await loadDataset();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(loaded.indexes.airportsById.get("3797")?.name).toBe(
      "John F Kennedy International Airport"
    );
    fetchMock.mockRestore();
  });

  it("surfaces dataset fetch failures", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response("missing", { status: 500 }));

    await expect(loadDataset()).rejects.toThrow(
      "Failed to load /generated/manifest.v1.json: 500"
    );

    fetchMock.mockRestore();
  });

  it("exercises reducer branches and assertions", () => {
    const dataset = createFixtureDataset();
    let state = appReducer(initialAppState, { type: "dataset/loading" });
    state = appReducer(state, { type: "dataset/loaded", dataset });
    state = appReducer(state, {
      type: "hover/airport",
      airportId: "3797",
      x: 10,
      y: 20,
    });
    state = appReducer(state, {
      type: "hover/route",
      routeId: "3797__507",
      x: 11,
      y: 22,
    });
    state = appReducer(state, { type: "hover/clear" });
    state = appReducer(state, { type: "selection/airport", airportId: "3797" });
    state = appReducer(state, {
      type: "selection/route",
      routeId: "3797__507",
      airportId: "3797",
    });
    state = appReducer(state, {
      type: "selection/hydrate",
      selection: { kind: "airport", airportId: "507" },
    });
    state = appReducer(state, { type: "selection/clear" });
    state = appReducer(state, { type: "search/query", value: "JFK" });
    state = appReducer(state, { type: "panel/filter", value: "lon" });
    state = appReducer(state, { type: "panel/sort", value: "distance" });
    state = appReducer(state, { type: "device/touch", value: true });
    state = appReducer(state, { type: "dataset/error", message: "boom" });
    state = appReducer(state, { type: "unknown" } as never);

    expect(state.loadState).toEqual({ status: "error", message: "boom" });
    expect(state.isTouchDevice).toBe(true);
    expect(assertExists("ok", "missing")).toBe("ok");
    expect(() => assertExists(null, "missing")).toThrow("missing");
  });

  it("handles hover content edge cases", () => {
    const dataset = createFixtureDataset();
    const brokenRouteDataset = createFixtureDataset();
    brokenRouteDataset.indexes.routesById.delete("3797__507");
    const brokenAirportDataset = createFixtureDataset();
    brokenAirportDataset.indexes.airportsById.delete("507");

    expect(getHoverContent(null, dataset)).toBeNull();
    expect(
      getHoverContent(
        { kind: "airport", airportId: "missing", x: 0, y: 0 },
        dataset
      )
    ).toBeNull();
    expect(
      getHoverContent(
        { kind: "route", routeId: "3797__507", x: 0, y: 0 },
        brokenRouteDataset
      )
    ).toBeNull();
    expect(
      getHoverContent(
        { kind: "route", routeId: "3797__507", x: 0, y: 0 },
        brokenAirportDataset
      )
    ).toBeNull();
  });
});
