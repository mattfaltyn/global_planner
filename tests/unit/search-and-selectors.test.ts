import { searchAirports } from "../../lib/data/search";
import { deriveLegs, inferTravelMode } from "../../lib/itinerary/deriveLegs";
import {
  buildLegPathPoints,
  interpolateTravelerPosition,
} from "../../lib/itinerary/interpolation";
import {
  advancePlaybackState,
  createInitialPlaybackState,
  jumpPlaybackToLegStart,
} from "../../lib/itinerary/playback";
import {
  buildTimelineSegments,
  getTimelineFrameFromTripProgress,
  getTotalTimelineDurationMs,
  getTripProgressFromLegPosition,
} from "../../lib/itinerary/timeline";
import {
  buildStopFromAirport,
  getDayCount,
  resolveAirportAnchorByCityCountry,
  resolveSeedStop,
  resolveSeededItinerary,
} from "../../lib/itinerary/resolveStops";
import { seededTravelModes } from "../../lib/itinerary/seed";
import {
  parseItinerarySelectionFromQuery,
  serializeItinerarySelectionToQuery,
} from "../../lib/itinerary/urls";
import {
  getItineraryFitPointOfView,
  getPlaybackCalendarProgressPercent,
  getCurrentStopPair,
  getLegByIndex,
  getPlaybackDaySummary,
  getPlaybackProgressPercent,
  getTripProgressFromCalendarProgress,
  getPlaybackRenderWindow,
  getSelectedLeg,
  getSelectedStop,
  getTravelModeCounts,
  getTripDateSpan,
  shouldRenderLegInPlaybackWindow,
  shouldRenderStopInPlaybackWindow,
} from "../../lib/state/selectors";
import { createFixtureDataset, createResolvedFixtureItinerary } from "../fixtures/dataset";

describe("itinerary search, selectors, and helpers", () => {
  it("prioritizes exact code matches and covers prefix and substring search branches", () => {
    const dataset = createFixtureDataset();

    expect(searchAirports(dataset.airports, "MAD")[0]?.id).toBe("9");
    expect(searchAirports(dataset.airports, "V").map((airport) => airport.id)).toContain("7");
    expect(searchAirports(dataset.airports, "Bar")[0]?.id).toBe("6");
    expect(searchAirports(dataset.airports, "Van")[0]?.id).toBe("1");
    expect(searchAirports(dataset.airports, "Por")[0]?.id).toBe("2");
    expect(searchAirports(dataset.airports, "spain").map((airport) => airport.country)).toContain(
      "Spain"
    );
    expect(
      searchAirports(
        [
          {
            ...dataset.airports[0],
            id: "x",
            name: "Alpha Airport",
            city: "Alpha",
            country: "Portugal",
            routeCount: 10,
            searchText: "alpha airport alpha portugal",
          },
          {
            ...dataset.airports[1],
            id: "y",
            name: "Zulu Airport",
            city: "Zulu",
            country: "Portugal",
            routeCount: 10,
            searchText: "zulu airport zulu portugal",
          },
        ],
        "portugal"
      ).map((airport) => airport.id)
    ).toEqual(["x", "y"]);
    expect(searchAirports(dataset.airports, "")).toEqual([]);
    expect(searchAirports(dataset.airports, "zzzz")).toEqual([]);
  });

  it("resolves seed stops by city and country and computes day counts", () => {
    const dataset = createFixtureDataset();
    const itinerary = resolveSeededItinerary(dataset.airports);
    const lisbonStops = itinerary.filter((stop) => stop.city === "Lisbon");
    const alphabeticalTie = resolveAirportAnchorByCityCountry(
      [
        {
          ...dataset.airports[0],
          id: "10",
          name: "Beta Airport",
          city: "Testville",
          country: "Testland",
          routeCount: 25,
          searchText: "beta airport testville testland",
        },
        {
          ...dataset.airports[1],
          id: "11",
          name: "Alpha Airport",
          city: "Testville",
          country: "Testland",
          routeCount: 25,
          searchText: "alpha airport testville testland",
        },
      ],
      "Testville",
      "Testland"
    );

    expect(resolveAirportAnchorByCityCountry(dataset.airports, "Lisbon", "Portugal")?.id).toBe("3");
    expect(alphabeticalTie?.id).toBe("11");
    expect(itinerary[0]).toMatchObject({
      label: "Vancouver",
      kind: "origin",
      anchorAirportId: "1",
      dayCount: null,
    });
    expect(lisbonStops).toHaveLength(2);
    expect(lisbonStops.every((stop) => stop.anchorAirportId === "3")).toBe(true);
    expect(getDayCount("2026-03-02", "2026-03-09")).toBe(7);
    expect(getDayCount(null, "2026-03-09")).toBeNull();
  });

  it("creates unresolved seed stops and airport-backed custom stops", () => {
    const dataset = createFixtureDataset();
    const unresolved = resolveSeedStop(
      {
        city: "Missing City",
        country: "Portugal",
        kind: "stay",
        arrivalDate: "2026-05-01",
        departureDate: "2026-05-02",
        notes: "",
      },
      dataset.airports,
      9
    );
    const built = buildStopFromAirport(dataset.airports[2], 10, {
      kind: "stay",
      arrivalDate: "2026-05-03",
      departureDate: "2026-05-05",
      notes: "anchor",
    });

    expect(unresolved.unresolved).toBe(true);
    expect(unresolved.anchorAirportId).toBeNull();
    expect(built).toMatchObject({
      id: "stop-10",
      label: "Lisbon",
      dayCount: 2,
      notes: "anchor",
    });
  });

  it("derives itinerary legs, preserves overrides, and infers travel mode", () => {
    const { stops, legs } = createResolvedFixtureItinerary();
    const overridden = deriveLegs(stops, [{ ...legs[4], mode: "ground" }]);
    const unresolvedLegs = deriveLegs([
      {
        ...stops[0],
        id: "u-1",
        lat: null,
      },
      {
        ...stops[1],
        id: "u-2",
      },
    ]);

    expect(legs).toHaveLength(stops.length - 1);
    expect(legs.map((leg) => leg.mode)).toEqual([...seededTravelModes]);
    expect(overridden[4].mode).toBe("ground");
    expect(inferTravelMode(stops[0], stops[1], 7490)).toBe("air");
    expect(inferTravelMode(stops[1], stops[2], 275)).toBe("ground");
    expect(inferTravelMode(stops[5], stops[8], 1200)).toBe("air");
    expect(inferTravelMode(stops[1], stops[2], null)).toBe("ground");
    expect(unresolvedLegs[0]).toMatchObject({
      distanceKm: null,
      pathPoints: [],
    });
  });

  it("serializes and parses itinerary query state", () => {
    const { stops, legs } = createResolvedFixtureItinerary();

    expect(serializeItinerarySelectionToQuery({ kind: "stop", stopId: stops[1].id })).toBe(
      "?stop=seed-stop-1"
    );
    expect(serializeItinerarySelectionToQuery({ kind: "leg", legId: legs[4].id })).toBe(
      "?leg=seed-stop-4__seed-stop-5"
    );
    expect(serializeItinerarySelectionToQuery(null)).toBe("");
    expect(parseItinerarySelectionFromQuery("?stop=seed-stop-1", stops, legs)).toEqual({
      kind: "stop",
      stopId: "seed-stop-1",
    });
    expect(parseItinerarySelectionFromQuery("?leg=seed-stop-4__seed-stop-5", stops, legs)).toEqual({
      kind: "leg",
      legId: "seed-stop-4__seed-stop-5",
    });
    expect(parseItinerarySelectionFromQuery("?airport=1&route=1__2", stops, legs)).toBeNull();
    expect(parseItinerarySelectionFromQuery("?stop=missing", stops, legs)).toBeNull();
  });

  it("selects itinerary entities and computes summary selectors", () => {
    const { stops, legs } = createResolvedFixtureItinerary();
    const playback = {
      status: "paused" as const,
      speed: 1 as const,
      tripProgress: 0.34,
      activeLegIndex: 2,
      activeLegProgress: 0.1,
      phase: "travel" as const,
    };

    expect(getSelectedStop({ kind: "stop", stopId: "seed-stop-1" }, stops)?.label).toBe("Porto");
    expect(getSelectedStop(null, stops)).toBeNull();
    expect(getSelectedStop({ kind: "stop", stopId: "missing" }, stops)).toBeNull();
    expect(getSelectedLeg({ kind: "leg", legId: legs[4].id }, legs)?.id).toBe(legs[4].id);
    expect(getSelectedLeg({ kind: "stop", stopId: "seed-stop-1" }, legs)).toBeNull();
    expect(getSelectedLeg({ kind: "leg", legId: "missing" }, legs)).toBeNull();
    expect(getLegByIndex(legs, 4)?.id).toBe(legs[4].id);
    expect(getLegByIndex(legs, 99)).toBeNull();
    const expectedModeCounts = seededTravelModes.reduce(
      (counts, mode) => {
        counts[mode] += 1;
        return counts;
      },
      { air: 0, ground: 0 }
    );
    expect(getTravelModeCounts(legs)).toEqual(expectedModeCounts);
    expect(getTripDateSpan(stops)).toEqual({
      start: "2026-02-20",
      end: "2026-04-30",
    });
    expect(getTripDateSpan([{ ...stops[0], departureDate: null }])).toBeNull();
    expect(getPlaybackProgressPercent(playback)).toBe(34);
    expect(getPlaybackCalendarProgressPercent(stops, legs, playback)).toBe(36);
    expect(getPlaybackDaySummary(stops, legs, playback)).toEqual({
      currentDay: 26,
      totalDays: 70,
      currentDateLabel: "Tue, Mar 17, 2026",
      rangeLabel: "Fri, Feb 20, 2026 -> Thu, Apr 30, 2026",
    });
    const itineraryPointOfView = getItineraryFitPointOfView(stops);
    expect(itineraryPointOfView.lat).toBeGreaterThan(35);
    expect(itineraryPointOfView.lat).toBeLessThan(65);
    expect(itineraryPointOfView.lng).toBeLessThan(20);
    expect(itineraryPointOfView.lng).toBeGreaterThan(-130);
    expect(itineraryPointOfView.altitude).toBe(1.62);
    expect(getTripProgressFromCalendarProgress(stops, legs, 1, 0.25)).toBeGreaterThan(0.2);
    expect(getTripProgressFromCalendarProgress(stops, legs, 1, 0.25)).toBeLessThan(0.25);
  });

  it("handles playback date summaries for orphaned legs and medium-haul air altitude", () => {
    const { stops } = createResolvedFixtureItinerary();
    const orphanLeg = {
      id: "missing-a__missing-b",
      fromStopId: "missing-a",
      toStopId: "missing-b",
      mode: "air" as const,
      distanceKm: 2000,
      pathPoints: [],
    };
    const orphanPlayback = {
      status: "paused" as const,
      speed: 1 as const,
      tripProgress: 0.5,
      activeLegIndex: 0,
      activeLegProgress: 0.5,
      phase: "travel" as const,
    };
    const mediumHaulPath = buildLegPathPoints(
      {
        ...stops[1],
        id: "mh-a",
        lat: 41.1579,
        lon: -8.6291,
      },
      {
        ...stops[2],
        id: "mh-b",
        lat: 52.52,
        lon: 13.405,
      },
      "air"
    );

    expect(getPlaybackDaySummary(stops, [orphanLeg], orphanPlayback)).toEqual({
      currentDay: 48,
      totalDays: 70,
      currentDateLabel: "Wed, Apr 8, 2026",
      rangeLabel: "Fri, Feb 20, 2026 -> Thu, Apr 30, 2026",
    });
    expect(getPlaybackCalendarProgressPercent(stops, [orphanLeg], orphanPlayback)).toBe(69);
    expect(Math.max(...mediumHaulPath.map((point) => point.altitude))).toBeCloseTo(0.018, 6);
  });

  it("covers playback date fallbacks for missing active legs and zero-duration segment math", () => {
    const { stops, legs } = createResolvedFixtureItinerary();

    expect(
      getPlaybackDaySummary(stops, [], {
        status: "paused",
        speed: 1,
        tripProgress: 0.4,
        activeLegIndex: 0,
        activeLegProgress: 0,
        phase: "travel",
      })
    ).toEqual({
      currentDay: 70,
      totalDays: 70,
      currentDateLabel: "Thu, Apr 30, 2026",
      rangeLabel: "Fri, Feb 20, 2026 -> Thu, Apr 30, 2026",
    });

    expect(
      getPlaybackDaySummary(stops, legs, {
        status: "paused",
        speed: Infinity as unknown as 1,
        tripProgress: 0.5,
        activeLegIndex: 0,
        activeLegProgress: 0,
        phase: "travel",
      })
    ).toEqual({
      currentDay: 2,
      totalDays: 70,
      currentDateLabel: "Sat, Feb 21, 2026",
      rangeLabel: "Fri, Feb 20, 2026 -> Thu, Apr 30, 2026",
    });

    expect(
      getPlaybackCalendarProgressPercent(
        [{ ...stops[0], arrivalDate: "2026-02-20", departureDate: "2026-02-20" }],
        [],
        {
          status: "paused",
          speed: 1,
          tripProgress: 0.5,
          activeLegIndex: 0,
          activeLegProgress: 0,
          phase: "travel",
        }
      )
    ).toBe(100);

    expect(
      getTripProgressFromCalendarProgress(
        [{ ...stops[0], departureDate: null }],
        [],
        1,
        0.4
      )
    ).toBe(0.4);

    expect(
      getCurrentStopPair(stops, createInitialPlaybackState(), [
        {
          id: "ghost-a__ghost-b",
          fromStopId: "ghost-a",
          toStopId: "ghost-b",
          mode: "ground",
          distanceKm: null,
          pathPoints: [],
        },
      ])
    ).toEqual({
      currentStop: null,
      nextStop: null,
    });

    expect(
      getPlaybackDaySummary(
        [
          {
            ...stops[0],
            id: "fallback-from",
            arrivalDate: "2026-02-20",
            departureDate: null,
          },
          {
            ...stops[1],
            id: "fallback-to",
            arrivalDate: null,
            departureDate: "2026-02-21",
          },
        ],
        [
          {
            id: "fallback-from__fallback-to",
            fromStopId: "fallback-from",
            toStopId: "fallback-to",
            mode: "ground",
            distanceKm: 10,
            pathPoints: [],
          },
        ],
        {
          status: "paused",
          speed: 1,
          tripProgress: 0.5,
          activeLegIndex: 0,
          activeLegProgress: 0,
          phase: "travel",
        }
      )
    ).toEqual({
      currentDay: 1,
      totalDays: 1,
      currentDateLabel: "Fri, Feb 20, 2026",
      rangeLabel: "Sat, Feb 21, 2026 -> Sat, Feb 21, 2026",
    });
  });

  it("builds whole-trip timeline frames, low path endpoints, and playback progression", () => {
    const { stops, legs } = createResolvedFixtureItinerary();
    const playback = createInitialPlaybackState();
    const segments = buildTimelineSegments(legs, stops);
    const midAirProgress = getTripProgressFromLegPosition(segments, 0, 0.5, "travel", 1);
    const dwellProgress = getTripProgressFromLegPosition(segments, 0, 0, "dwell", 1);
    const midAirFrame = getTimelineFrameFromTripProgress(segments, midAirProgress, 1);
    const dwellFrame = getTimelineFrameFromTripProgress(
      segments,
      Math.min(1, dwellProgress + 0.001),
      1
    );
    const startedAtLegFour = jumpPlaybackToLegStart(playback, legs, stops, 4);
    const progressed = advancePlaybackState({ ...playback, status: "playing" }, legs, stops, 1000);
    const completed = advancePlaybackState(
      { ...playback, status: "playing" },
      legs,
      stops,
      50_000
    );
    const airPath = buildLegPathPoints(stops[0], stops[1], "air");
    const groundPath = buildLegPathPoints(stops[1], stops[2], "ground");

    expect(segments).toHaveLength(26);
    expect(segments[0]).toMatchObject({ kind: "travel", legIndex: 0, durationMs: 1800 });
    expect(segments[1]).toMatchObject({ kind: "dwell", legIndex: 0, durationMs: 700 });
    expect(getTotalTimelineDurationMs(segments, 1)).toBe(38500);
    expect(midAirFrame).toMatchObject({
      activeLegIndex: 0,
      phase: "travel",
    });
    expect(midAirFrame.activeLegProgress).toBeCloseTo(0.5, 2);
    expect(dwellFrame).toMatchObject({
      activeLegIndex: 0,
      phase: "dwell",
      activeLegProgress: 1,
    });
    expect(startedAtLegFour.activeLegIndex).toBe(4);
    expect(progressed.tripProgress).toBeGreaterThan(0);
    expect(progressed.status).toBe("playing");
    expect(completed).toMatchObject({
      status: "paused",
      tripProgress: 1,
      activeLegIndex: legs.length - 1,
      activeLegProgress: 1,
      phase: "dwell",
    });

    expect(airPath[0]?.lat).toBeCloseTo(stops[0].lat ?? 0, 6);
    expect(airPath[0]?.lon).toBeCloseTo(stops[0].lon ?? 0, 6);
    expect(airPath[0]?.altitude).toBeCloseTo(0, 12);
    expect(airPath.at(-1)?.lat).toBeCloseTo(stops[1].lat ?? 0, 6);
    expect(airPath.at(-1)?.lon).toBeCloseTo(stops[1].lon ?? 0, 6);
    expect(airPath.at(-1)?.altitude).toBeCloseTo(0, 12);
    expect(Math.max(...airPath.map((point) => point.altitude))).toBeLessThanOrEqual(0.028);
    expect(groundPath[0]?.altitude).toBe(0);
    expect(groundPath.at(-1)?.altitude).toBe(0);

    expect(interpolateTravelerPosition(legs[0], 0)?.lat).toBe(legs[0].pathPoints[0].lat);
    expect(interpolateTravelerPosition(legs[0], 1)?.lon).toBe(
      legs[0].pathPoints.at(-1)?.lon
    );
    expect(interpolateTravelerPosition({ ...legs[0], pathPoints: [] }, 0.5)).toBeNull();
    expect(
      buildLegPathPoints(
        { ...stops[0], lat: null },
        stops[1],
        "ground"
      )
    ).toEqual([]);
  });

  it("uses deterministic playback windows", () => {
    const { stops, legs } = createResolvedFixtureItinerary();
    const playbackWindow = getPlaybackRenderWindow(stops, legs, {
      status: "playing",
      speed: 1,
      tripProgress: 0.33,
      activeLegIndex: 3,
      activeLegProgress: 0.5,
      phase: "travel",
    });
    const pausedWindow = getPlaybackRenderWindow(stops, legs, {
      status: "paused",
      speed: 1,
      tripProgress: 0.33,
      activeLegIndex: 3,
      activeLegProgress: 0.5,
      phase: "travel",
    });

    expect(playbackWindow).toEqual({
      showAll: false,
      minLegIndex: 0,
      maxLegIndex: 7,
      visibleStopRangeStart: 2,
      visibleStopRangeEnd: 5,
    });
    expect(pausedWindow.showAll).toBe(true);
    expect(shouldRenderLegInPlaybackWindow(7, playbackWindow)).toBe(true);
    expect(shouldRenderLegInPlaybackWindow(8, playbackWindow)).toBe(false);
    expect(
      shouldRenderStopInPlaybackWindow(0, stops[0].id, null, playbackWindow)
    ).toBe(false);
    expect(
      shouldRenderStopInPlaybackWindow(
        0,
        stops[0].id,
        { kind: "stop", stopId: stops[0].id },
        playbackWindow
      )
    ).toBe(true);
  });
});
