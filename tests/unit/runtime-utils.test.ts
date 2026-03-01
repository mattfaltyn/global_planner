import nextConfig from "../../next.config";
import playwrightConfig from "../../playwright.config";
import { formatCoordinates, formatDistance, formatDuration } from "../../lib/data/formatters";
import { loadDataset } from "../../lib/data/loadDataset";
import {
  getAirportPointOfView,
  getBufferedLegPointOfView,
  getFlyDurationMs,
  getLegFocusCameraIntent,
  getLegPointOfView,
  getOverviewCameraIntent,
  getOverviewPointOfView,
  getPlaybackFollowCameraIntent,
  getPlaybackSmoothingProfile,
  getPlaybackSmoothingVelocity,
  getPlaybackFollowPointOfView,
  getStopFocusCameraIntent,
  getStopContextPointOfView,
  getVelocityAdjustedPlaybackSmoothingProfile,
  interpolatePlaybackPointOfView,
  interpolatePointOfView,
  resolveCameraIntent,
  shouldApplyPointOfViewUpdate,
} from "../../lib/globe/camera";
import { globeColors } from "../../lib/globe/colors";
import { getRouteAltitude, getRouteStroke } from "../../lib/globe/routeGeometry";
import { appReducer, initialAppState } from "../../lib/state/appState";
import { assertExists } from "../../lib/utils/assert";
import { createFixtureDataset, createResolvedFixtureItinerary } from "../fixtures/dataset";

describe("runtime config and utility modules", () => {
  it("exports the expected Next.js and Playwright config", () => {
    expect(nextConfig.reactStrictMode).toBe(true);
    expect(nextConfig.allowedDevOrigins).toEqual(["127.0.0.1", "localhost"]);
    expect(playwrightConfig.webServer?.command).toContain("NEXT_PUBLIC_E2E=1");
    expect(playwrightConfig.use?.baseURL).toBe("http://127.0.0.1:3100");
  });

  it("formats distances, durations, and coordinates", () => {
    expect(formatDistance(7490)).toBe("7,490 km");
    expect(formatDuration(59)).toBe("59 min");
    expect(formatDuration(125)).toBe("2h 5m");
    expect(formatCoordinates(40.6413, -73.7781)).toBe("40.64° N · 73.78° W");
  });

  it("covers globe geometry helpers and constants", () => {
    expect(getAirportPointOfView(10, 20)).toEqual({
      lat: 10,
      lng: 20,
      altitude: 0.76,
    });
    expect(getFlyDurationMs(true)).toBe(450);
    expect(getFlyDurationMs(false)).toBe(900);
    const transatlanticLegPointOfView = getLegPointOfView(
      { lat: 49.1947, lon: -123.1792 },
      { lat: 41.2481, lon: -8.6814 }
    );
    expect(transatlanticLegPointOfView.lat).toBeCloseTo(45.2214);
    expect(transatlanticLegPointOfView.lng).toBeCloseTo(-65.9303);
    expect(transatlanticLegPointOfView.altitude).toBe(1.42);
    const bufferedLegPointOfView = getBufferedLegPointOfView(
      { lat: 49.1947, lon: -123.1792 },
      { lat: 41.2481, lon: -8.6814 }
    );
    expect(bufferedLegPointOfView.lat).toBeCloseTo(transatlanticLegPointOfView.lat);
    expect(bufferedLegPointOfView.lng).toBeCloseTo(transatlanticLegPointOfView.lng);
    expect(bufferedLegPointOfView.altitude).toBeCloseTo(1.54);

    const stopContextPointOfView = getStopContextPointOfView(
      { lat: 49.1947, lon: -123.1792 },
      [{ lat: 41.2481, lon: -8.6814 }]
    );
    expect(stopContextPointOfView.lat).toBeCloseTo(46.5458, 3);
    expect(stopContextPointOfView.lng).toBeCloseTo(-93.3236, 3);
    expect(stopContextPointOfView.altitude).toBe(1.02);
    expect(
      getLegPointOfView(
        { lat: null, lon: null },
        { lat: 41.2481, lon: -8.6814 }
      )
    ).toEqual(getOverviewPointOfView([{ lat: null, lon: null }, { lat: 41.2481, lon: -8.6814 }]));
    expect(getOverviewPointOfView([])).toEqual({ lat: 22, lng: -32, altitude: 1.32 });
    expect(
      getOverviewPointOfView([
        { kind: "stop" as const, stopId: "a", lat: 10, lon: 20 },
        { kind: "stop" as const, stopId: "b", lat: 30, lon: 40 },
      ])
    ).toEqual({ lat: 20, lng: 30, altitude: 1.32 });
    const playbackFollowPointOfView = getPlaybackFollowPointOfView(
      { lat: 44, lon: -40 },
      { lat: 41.2481, lon: -8.6814 },
      "air",
      7490,
      "travel"
    );
    expect(playbackFollowPointOfView.lat).toBeCloseTo(43.284506);
    expect(playbackFollowPointOfView.lng).toBeCloseTo(-31.85716400000001);
    expect(playbackFollowPointOfView.altitude).toBe(1.34);
    const groundPlaybackFollowPointOfView = getPlaybackFollowPointOfView(
      { lat: 38, lon: -9.5 },
      { lat: 37.0144, lon: -7.9659 },
      "ground",
      216,
      "travel"
    );
    expect(groundPlaybackFollowPointOfView.lat).toBeCloseTo(37.822592);
    expect(groundPlaybackFollowPointOfView.lng).toBeCloseTo(-9.223862);
    expect(groundPlaybackFollowPointOfView.altitude).toBe(0.56);
    const lateGroundPlaybackFollowPointOfView = getPlaybackFollowPointOfView(
      { lat: 37.5, lon: -8.2 },
      { lat: 37.0144, lon: -7.9659 },
      "ground",
      216,
      "travel",
      0.75
    );
    expect(lateGroundPlaybackFollowPointOfView.lat).toBeCloseTo(37.376172);
    expect(lateGroundPlaybackFollowPointOfView.lng).toBeCloseTo(-8.1403045);
    expect(lateGroundPlaybackFollowPointOfView.altitude).toBe(0.56);
    expect(
      getPlaybackFollowPointOfView(
        { lat: 37.5, lon: -8.2 },
        { lat: 37.0144, lon: -7.9659 },
        "ground",
        216,
        "dwell"
      )
      ).toEqual({
      lat: 37.0144,
      lng: -7.9659,
      altitude: 0.56,
    });
    const { stops, legs } = createResolvedFixtureItinerary();
    expect(getOverviewCameraIntent(stops).target.altitude).toBe(1.62);
    expect(
      getStopFocusCameraIntent(stops[1], [stops[0], stops[2]], [legs[0], legs[1]]).target
        .altitude
    ).toBe(1.02);
    expect(getLegFocusCameraIntent(legs[2], stops[2], stops[3]).target.altitude).toBe(0.86);
    expect(
      getPlaybackFollowCameraIntent(
        legs[0],
        legs[0].pathPoints[10],
        stops[1],
        "travel"
      ).target.altitude
    ).toBe(1.34);
    expect(
      getPlaybackFollowCameraIntent(
        legs[1],
        legs[1].pathPoints[8],
        stops[2],
        "travel"
      ).target.altitude
    ).toBe(0.56);
    expect(
      resolveCameraIntent({
        stops,
        legs,
        selection: null,
        playback: {
          status: "playing",
          speed: 1,
          tripProgress: 0.2,
          activeLegIndex: 0,
          activeLegProgress: 0.3,
          phase: "travel",
        },
        travelerPoint: legs[0].pathPoints[12],
        isTouchDevice: false,
        autoFollowSuspendedUntil: null,
        nowMs: 1000,
        currentPointOfView: { lat: 0, lng: 0, altitude: 2 },
      }).mode
    ).toBe("playback-follow");
    expect(
      resolveCameraIntent({
        stops,
        legs,
        selection: null,
        playback: {
          status: "playing",
          speed: 1,
          tripProgress: 0.2,
          activeLegIndex: 0,
          activeLegProgress: 0.3,
          phase: "travel",
        },
        travelerPoint: legs[0].pathPoints[12],
        isTouchDevice: false,
        autoFollowSuspendedUntil: 5000,
        nowMs: 1000,
        currentPointOfView: { lat: 10, lng: 20, altitude: 1.5 },
      }).mode
    ).toBe("manual-override");
    expect(
      shouldApplyPointOfViewUpdate(
        { lat: 10, lng: 20, altitude: 1.5 },
        { lat: 10.01, lng: 20.01, altitude: 1.51 }
      )
    ).toBe(false);
    expect(
      shouldApplyPointOfViewUpdate(
        { lat: 10, lng: 20, altitude: 1.5 },
        { lat: 10.2, lng: 20.3, altitude: 1.7 }
      )
    ).toBe(true);
    expect(getPlaybackSmoothingProfile("ground", "travel")).toEqual({
      latLngFactor: 0.34,
      altitudeFactor: 0.14,
    });
    expect(
      getPlaybackSmoothingVelocity(
        { lat: 10, lng: 20, altitude: 1.5 },
        { lat: 10.4, lng: 20.2, altitude: 1.35 }
      )
    ).toMatchObject({
      angularDelta: 0.40000000000000036,
      altitudeDelta: 0.1499999999999999,
    });
    expect(
      getVelocityAdjustedPlaybackSmoothingProfile(
        getPlaybackSmoothingProfile("ground", "travel"),
        { angularDelta: 0.05, altitudeDelta: 0.01 },
        "ground"
      )
    ).toEqual({
      latLngFactor: 0.250512,
      altitudeFactor: 0.11676,
    });
    expect(
      getVelocityAdjustedPlaybackSmoothingProfile(
        getPlaybackSmoothingProfile("ground", "travel"),
        { angularDelta: 1.4, altitudeDelta: 0.24 },
        "ground"
      )
    ).toEqual({
      latLngFactor: 0.3876,
      altitudeFactor: 0.15400000000000003,
    });
    expect(
      getVelocityAdjustedPlaybackSmoothingProfile(
        getPlaybackSmoothingProfile("air", "travel"),
        { angularDelta: 2.4, altitudeDelta: 0.3 },
        "air"
      )
    ).toEqual({
      latLngFactor: 0.2304,
      altitudeFactor: 0.1368,
    });
    expect(
      interpolatePlaybackPointOfView(
        { lat: 10, lng: 20, altitude: 1.5 },
        { lat: 20, lng: 30, altitude: 1.1 },
        getPlaybackSmoothingProfile("ground", "travel")
      )
    ).toMatchObject({
      lat: 13.4,
      altitude: 1.444,
    });
    const interpolatedPointOfView = interpolatePointOfView(
      { lat: 40, lng: 170, altitude: 2 },
      { lat: 50, lng: -170, altitude: 1 },
      0.5
    );
    expect(interpolatedPointOfView.lat).toBe(45);
    expect(interpolatedPointOfView.lng).toBe(-180);
    expect(interpolatedPointOfView.altitude).toBe(1.5);
    expect(globeColors.airLegSelected).toBe("rgba(142, 251, 255, 0.96)");
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
      );

    const loaded = await loadDataset();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(loaded.indexes.airportsById.get("3")?.name).toBe("Humberto Delgado Airport");
    expect(loaded.routes).toEqual([]);
    expect(loaded.indexes.routesById.size).toBe(0);
    fetchMock.mockRestore();
  });

  it("surfaces dataset fetch failures", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response("missing", { status: 500 }));

    await expect(loadDataset()).rejects.toThrow(
      "Failed to load /generated/airports.v1.json: 500"
    );

    fetchMock.mockRestore();
  });

  it("exercises reducer branches and assertions", () => {
    const dataset = createFixtureDataset();
    const { stops, legs } = createResolvedFixtureItinerary();
    let state = appReducer(initialAppState, { type: "dataset/loading" });
    state = appReducer(state, { type: "dataset/loaded", dataset });
    state = appReducer(state, { type: "hover/stop", stopId: "seed-stop-0", x: 10, y: 20 });
    state = appReducer(state, { type: "hover/leg", legId: legs[0].id, x: 11, y: 22 });
    state = appReducer(state, { type: "hover/clear" });
    state = appReducer(state, { type: "selection/hydrate", selection: { kind: "stop", stopId: "seed-stop-1" } });
    state = appReducer(state, { type: "selection/clear" });
    state = appReducer(state, { type: "itinerary/seed", stops });
    state = appReducer(state, { type: "itinerary/select-stop", stopId: "seed-stop-1" });
    state = appReducer(state, { type: "itinerary/select-leg", legId: legs[0].id });
    state = appReducer(state, { type: "itinerary/set-insert-index", index: 1 });
    state = appReducer(state, { type: "search/query", value: "MAD" });
    state = appReducer(state, { type: "device/touch", value: true });
    state = appReducer(state, { type: "itinerary/add-stop", airport: dataset.airports[8] });
    const addedStopId = state.itinerary.stops.at(-1)?.id ?? "";
    state = appReducer(state, {
      type: "itinerary/update-stop",
      stopId: addedStopId,
      patch: { notes: "added" },
    });
    state = appReducer(state, { type: "itinerary/move-stop-up", stopId: addedStopId });
    state = appReducer(state, { type: "itinerary/move-stop-down", stopId: addedStopId });
    state = appReducer(state, { type: "itinerary/set-leg-mode", legId: state.itinerary.legs[0].id, mode: "ground" });
    state = appReducer(state, { type: "itinerary/replace-anchor", stopId: "seed-stop-1" });
    state = appReducer(state, { type: "itinerary/add-stop", airport: dataset.airports[4] });
    state = appReducer(state, { type: "playback/play", legIndex: 1 });
    state = appReducer(state, { type: "playback/pause" });
    state = appReducer(state, { type: "playback/set-speed", speed: 2 });
    state = appReducer(state, { type: "playback/set-progress", progress: 0.4 });
    state = appReducer(state, { type: "playback/step-next" });
    state = appReducer(state, { type: "playback/step-prev" });
    state = appReducer(state, { type: "playback/advance-frame", deltaMs: 100 });
    state = appReducer(state, { type: "itinerary/remove-stop", stopId: addedStopId });
    state = appReducer(state, { type: "itinerary/move-stop-up", stopId: "seed-stop-0" });
    state = appReducer(state, {
      type: "itinerary/move-stop-down",
      stopId: state.itinerary.stops.at(-1)?.id ?? "",
    });
    state = appReducer(state, { type: "playback/reset" });
    state = appReducer(state, { type: "dataset/error", message: "boom" });
    state = appReducer(state, { type: "unknown" } as never);

    const addAfterSelectedStop = appReducer(
      appReducer(
        appReducer(initialAppState, { type: "itinerary/seed", stops }),
        { type: "itinerary/select-stop", stopId: "seed-stop-1" }
      ),
      { type: "itinerary/add-stop", airport: dataset.airports[5] }
    );
    const removedSelectedStop = appReducer(
      appReducer(
        appReducer(initialAppState, { type: "itinerary/seed", stops }),
        { type: "itinerary/select-stop", stopId: "seed-stop-1" }
      ),
      { type: "itinerary/remove-stop", stopId: "seed-stop-1" }
    );
    const removedSelectedLeg = appReducer(
      appReducer(
        appReducer(initialAppState, { type: "itinerary/seed", stops }),
        { type: "itinerary/select-leg", legId: legs[0].id }
      ),
      { type: "itinerary/remove-stop", stopId: "seed-stop-0" }
    );
    const addAfterHydratedSelection = appReducer(
      appReducer(
        appReducer(initialAppState, { type: "itinerary/seed", stops }),
        { type: "selection/hydrate", selection: { kind: "stop", stopId: "seed-stop-1" } }
      ),
      { type: "itinerary/add-stop", airport: dataset.airports[6] }
    );

    expect(state.loadState).toEqual({ status: "error", message: "boom" });
    expect(addAfterSelectedStop.itinerary.stops[2]?.label).toBe("Barcelona");
    expect(addAfterHydratedSelection.itinerary.stops[2]?.label).toBe("Valencia");
    expect(removedSelectedStop.selection).toBeNull();
    expect(removedSelectedLeg.selection).toBeNull();
    expect(state.isTouchDevice).toBe(true);
    expect(assertExists("ok", "missing")).toBe("ok");
    expect(() => assertExists(null, "missing")).toThrow("missing");
  });

  it("covers reducer playback and insertion edge branches", () => {
    const dataset = createFixtureDataset();
    const { stops, legs } = createResolvedFixtureItinerary();

    const pausedFromPlaying = appReducer(
      {
        ...initialAppState,
        itinerary: { ...initialAppState.itinerary, stops, legs },
        playback: {
          ...initialAppState.playback,
          status: "playing",
        },
      },
      { type: "itinerary/select-stop", stopId: "seed-stop-1" }
    );

    const playingLegSelection = appReducer(
      {
        ...initialAppState,
        itinerary: { ...initialAppState.itinerary, stops, legs },
        playback: {
          ...initialAppState.playback,
          status: "playing",
        },
      },
      { type: "itinerary/select-leg", legId: legs[0].id }
    );

    const appendedStop = appReducer(
      {
        ...initialAppState,
        itinerary: { ...initialAppState.itinerary, stops, legs },
      },
      { type: "itinerary/add-stop", airport: dataset.airports[8] }
    );

    const removedToEmpty = appReducer(
      {
        ...initialAppState,
        itinerary: {
          ...initialAppState.itinerary,
          stops: stops.slice(0, 2),
          legs: legs.slice(0, 1),
        },
        playback: {
          ...initialAppState.playback,
          status: "playing",
          activeLegIndex: 0,
          tripProgress: 0.6,
        },
      },
      { type: "itinerary/remove-stop", stopId: "seed-stop-0" }
    );

    const playWithoutLegIndex = appReducer(
      {
        ...initialAppState,
        itinerary: { ...initialAppState.itinerary, stops, legs },
        playback: {
          ...initialAppState.playback,
          activeLegIndex: 2,
          tripProgress: 0.4,
          status: "paused",
        },
      },
      { type: "playback/play" }
    );

    const scrubFromIdle = appReducer(initialAppState, {
      type: "playback/set-progress",
      progress: 1.4,
    });

    expect(pausedFromPlaying.playback.status).toBe("paused");
    expect(playingLegSelection.playback.status).toBe("paused");
    expect(appendedStop.itinerary.stops.at(-1)?.label).toBe("Madrid");
    expect(appendedStop.itinerary.selectedInsertIndex).toBe(stops.length);
    expect(removedToEmpty.itinerary.legs).toHaveLength(0);
    expect(removedToEmpty.playback.tripProgress).toBe(0);
    expect(removedToEmpty.playback.status).toBe("idle");
    expect(playWithoutLegIndex.playback.activeLegIndex).toBe(2);
    expect(playWithoutLegIndex.playback.tripProgress).toBe(0.4);
    expect(scrubFromIdle.playback.tripProgress).toBe(1);
    expect(scrubFromIdle.playback.status).toBe("paused");
  });
});
