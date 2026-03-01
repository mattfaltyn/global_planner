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
import {
  parseItinerarySelectionFromQuery,
  serializeItinerarySelectionToQuery,
} from "../../lib/itinerary/urls";
import {
  getItineraryFitPointOfView,
  getLegByIndex,
  getPlaybackProgressPercent,
  getSelectedLeg,
  getSelectedStop,
  getTravelModeCounts,
  getTripDateSpan,
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

    expect(legs).toHaveLength(8);
    expect(legs.map((leg) => leg.mode)).toEqual([
      "air",
      "ground",
      "ground",
      "ground",
      "air",
      "ground",
      "ground",
      "ground",
    ]);
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
    expect(getTravelModeCounts(legs)).toEqual({ air: 2, ground: 6 });
    expect(getTripDateSpan(stops)).toEqual({
      start: "2026-02-20",
      end: "2026-04-10",
    });
    expect(getTripDateSpan([{ ...stops[0], departureDate: null }])).toBeNull();
    expect(getPlaybackProgressPercent(playback)).toBe(34);
    const itineraryPointOfView = getItineraryFitPointOfView(stops);
    expect(itineraryPointOfView.lat).toBeGreaterThan(35);
    expect(itineraryPointOfView.lat).toBeLessThan(45);
    expect(itineraryPointOfView.lng).toBeLessThan(-10);
    expect(itineraryPointOfView.lng).toBeGreaterThan(-90);
    expect(itineraryPointOfView.altitude).toBeGreaterThanOrEqual(2.55);
  });

  it("builds whole-trip timeline frames, low path endpoints, and playback progression", () => {
    const { stops, legs } = createResolvedFixtureItinerary();
    const playback = createInitialPlaybackState();
    const segments = buildTimelineSegments(legs);
    const midAirProgress = getTripProgressFromLegPosition(segments, 0, 0.5, "travel", 1);
    const dwellProgress = getTripProgressFromLegPosition(segments, 0, 0, "dwell", 1);
    const midAirFrame = getTimelineFrameFromTripProgress(segments, midAirProgress, 1);
    const dwellFrame = getTimelineFrameFromTripProgress(
      segments,
      Math.min(1, dwellProgress + 0.001),
      1
    );
    const startedAtLegFour = jumpPlaybackToLegStart(playback, legs, 4);
    const progressed = advancePlaybackState({ ...playback, status: "playing" }, legs, 1000);
    const completed = advancePlaybackState({ ...playback, status: "playing" }, legs, 50_000);
    const airPath = buildLegPathPoints(stops[0], stops[1], "air");
    const groundPath = buildLegPathPoints(stops[1], stops[2], "ground");

    expect(segments).toHaveLength(15);
    expect(segments[0]).toMatchObject({ kind: "travel", legIndex: 0, durationMs: 1800 });
    expect(segments[1]).toMatchObject({ kind: "dwell", legIndex: 0, durationMs: 700 });
    expect(getTotalTimelineDurationMs(segments, 1)).toBe(22900);
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
});
