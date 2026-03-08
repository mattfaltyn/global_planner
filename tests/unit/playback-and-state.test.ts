import { describe, expect, it, vi } from "vitest";
import { createFixtureDataset, createResolvedFixtureItinerary } from "../fixtures/dataset";
import {
  advancePlaybackState,
  createInitialPlaybackState,
  jumpPlaybackToLegEnd,
  jumpPlaybackToLegStart,
  syncPlaybackState,
} from "../../lib/itinerary/playback";
import * as timelineModule from "../../lib/itinerary/timeline";
import {
  buildTimelineSegments,
  getTimelineFrameFromTripProgress,
  getTotalTimelineDurationMs,
  getTripProgressForLegEnd,
  getTripProgressForLegStart,
  getTripProgressFromLegPosition,
} from "../../lib/itinerary/timeline";
import {
  getActiveLegLabel,
  getCurrentStopPair,
  getLegEndProgress,
  getLegStartProgress,
  getPlaybackDaySummary,
  getPlaybackRenderWindow,
  getSelectedLeg,
  getSelectedStop,
  getTimelineFrame,
  getTimelineNavigationProgress,
  getTimelineSegments,
  getTripProgressFromCalendarProgress,
  getVisibleLegRenderState,
  shouldRenderLegInPlaybackWindow,
  shouldRenderStopInPlaybackWindow,
} from "../../lib/state/selectors";
import { appReducer, initialAppState } from "../../lib/state/appState";

describe("playback, timeline, reducer, and selector edges", () => {
  it("covers timeline helpers and empty/zero-duration branches", () => {
    const { stops, legs } = createResolvedFixtureItinerary();
    const segments = buildTimelineSegments(legs, stops);

    expect(segments.at(-1)).toEqual({
      kind: "dwell",
      legIndex: legs.length - 1,
      durationMs: 700,
    });
    expect(getTotalTimelineDurationMs(segments, 2)).toBeGreaterThan(0);
    expect(getTimelineSegments(legs, stops)).toEqual(segments);

    expect(getTimelineFrameFromTripProgress([], 0.4, 1)).toEqual({
      tripProgress: 0.4,
      activeLegIndex: 0,
      activeLegProgress: 0,
      phase: "travel",
    });

    const zeroSegments = [{ kind: "travel", legIndex: 0, durationMs: 0 }] as const;
    expect(getTimelineFrameFromTripProgress(zeroSegments as never, 0.7, 1)).toEqual({
      tripProgress: 0.7,
      activeLegIndex: 0,
      activeLegProgress: 1,
      phase: "travel",
    });
    expect(getTripProgressFromLegPosition([], 0, 0.4, "travel", 1)).toBe(0);
    expect(getTripProgressFromLegPosition(zeroSegments as never, 0, 0.4, "travel", 1)).toBe(0);
    expect(getTripProgressFromLegPosition(segments, 0, 0.5, "dwell", 1)).toBeCloseTo(
      segments[0].durationMs / getTotalTimelineDurationMs(segments, 1)
    );
    expect(getTripProgressFromLegPosition(segments, 999, 0.2, "travel", 1)).toBe(1);
    const nanFrame = getTimelineFrameFromTripProgress(segments, Number.NaN, 1);
    expect(Number.isNaN(nanFrame.tripProgress)).toBe(true);
    expect(nanFrame.activeLegIndex).toBe(segments.at(-1)?.legIndex ?? 0);
    expect(nanFrame.activeLegProgress).toBe(1);
    expect(nanFrame.phase).toBe(segments.at(-1)?.kind ?? "travel");
    expect(getTripProgressForLegStart(segments, 0, 1)).toBe(0);
    expect(getTripProgressForLegEnd(segments, 0, 1)).toBeGreaterThan(0);
  });

  it("covers playback helpers including total-duration zero and bounded jumps", () => {
    const { stops, legs } = createResolvedFixtureItinerary();
    const initial = createInitialPlaybackState();

    expect(syncPlaybackState(initial, [], stops)).toEqual(initial);
    expect(
      advancePlaybackState({ ...initial, status: "paused" }, legs, stops, 200)
    ).toEqual({ ...initial, status: "paused" });
    expect(advancePlaybackState({ ...initial, status: "playing" }, [], stops, 200)).toEqual({
      ...initial,
      status: "playing",
    });

    const spy = vi
      .spyOn(timelineModule, "buildTimelineSegments")
      .mockReturnValue([{ kind: "travel", legIndex: 0, durationMs: 0 }]);
    expect(
      advancePlaybackState({ ...initial, status: "playing" }, legs, stops, 200)
    ).toMatchObject({
      status: "paused",
    });
    spy.mockRestore();

    expect(
      jumpPlaybackToLegStart(initial, legs, stops, -1)
    ).toMatchObject({ activeLegIndex: 0, status: "paused" });
    expect(
      jumpPlaybackToLegEnd(initial, legs, stops, 999, "playing")
    ).toMatchObject({ activeLegIndex: legs.length - 1, status: "playing" });
  });

  it("covers selector edge branches for missing spans, labels, windows, and navigation", () => {
    const { stops, legs } = createResolvedFixtureItinerary();
    const pausedPlayback = {
      status: "paused" as const,
      speed: 1 as const,
      tripProgress: 0.3,
      activeLegIndex: 1,
      activeLegProgress: 0.4,
      phase: "travel" as const,
    };
    const idlePlayback = {
      ...pausedPlayback,
      status: "idle" as const,
    };
    const playingPlayback = {
      ...pausedPlayback,
      status: "playing" as const,
      activeLegIndex: 3,
    };

    expect(getPlaybackDaySummary([{ ...stops[0], departureDate: null }], [], pausedPlayback)).toBeNull();
    expect(getTripProgressFromCalendarProgress([{ ...stops[0], departureDate: null }], legs, 1, 0.2)).toBe(
      0.2
    );
    expect(getTripProgressFromCalendarProgress(stops, [], 1, 0.2)).toBe(0.2);
    expect(getActiveLegLabel(stops, [], pausedPlayback)).toBe("Trip not started");
    expect(
      getActiveLegLabel([stops[0]], [{ ...legs[0], fromStopId: "missing", toStopId: "missing" }], {
        ...pausedPlayback,
        activeLegIndex: 0,
      })
    ).toBe("missing to missing");
    expect(getCurrentStopPair([stops[0]], pausedPlayback, [])).toEqual({
      currentStop: stops[0],
      nextStop: null,
    });
    expect(getSelectedStop({ kind: "stop", stopId: "missing" }, stops)).toBeNull();
    expect(getSelectedLeg({ kind: "leg", legId: "missing" }, legs)).toBeNull();

    const playWindow = getPlaybackRenderWindow(stops, legs, playingPlayback);
    expect(playWindow.showAll).toBe(false);
    expect(shouldRenderLegInPlaybackWindow(playingPlayback.activeLegIndex, playWindow)).toBe(true);
    expect(shouldRenderLegInPlaybackWindow(8, playWindow)).toBe(false);
    expect(
      shouldRenderStopInPlaybackWindow(0, stops[0].id, { kind: "stop", stopId: stops[0].id }, playWindow)
    ).toBe(true);
    expect(
      shouldRenderStopInPlaybackWindow(0, stops[0].id, null, playWindow)
    ).toBe(false);
    expect(getPlaybackRenderWindow(stops, legs, idlePlayback).showAll).toBe(true);

    expect(
      getVisibleLegRenderState(legs[0], legs, pausedPlayback, { kind: "leg", legId: legs[0].id })
    ).toBe("selected");
    expect(getVisibleLegRenderState(legs[1], legs, pausedPlayback, null)).toBe("active");
    expect(
      getVisibleLegRenderState(legs[2], legs, pausedPlayback, { kind: "stop", stopId: stops[2].id })
    ).toBe("context");
    expect(getVisibleLegRenderState(legs[0], legs, pausedPlayback, null)).toBe("past");
    expect(getVisibleLegRenderState(legs[3], legs, idlePlayback, null)).toBe("future");

    const segments = getTimelineSegments(legs, stops);
    expect(getTimelineFrame(pausedPlayback, legs, stops).activeLegIndex).toBeGreaterThanOrEqual(0);
    expect(getTimelineNavigationProgress([], pausedPlayback, "next")).toBe(0);
    expect(
      getTimelineNavigationProgress(
        segments,
        { ...pausedPlayback, phase: "dwell", activeLegProgress: 1, activeLegIndex: 2 },
        "prev"
      )
    ).toBeCloseTo(getTripProgressForLegStart(segments, 2, 1));
    expect(
      getTimelineNavigationProgress(
        segments,
        { ...pausedPlayback, activeLegIndex: legs.length - 1 },
        "next"
      )
    ).toBeCloseTo(getTripProgressForLegStart(segments, legs.length - 1, 1));
    expect(getLegStartProgress(segments, pausedPlayback, "missing", legs)).toBe(pausedPlayback.tripProgress);
    expect(getLegEndProgress(segments, pausedPlayback, "missing", legs)).toBe(pausedPlayback.tripProgress);
    expect(getLegStartProgress(segments, pausedPlayback, legs[1].id, legs)).toBeCloseTo(
      getTripProgressForLegStart(segments, 1, 1)
    );
    expect(getLegEndProgress(segments, pausedPlayback, legs[1].id, legs)).toBeCloseTo(
      getTripProgressForLegEnd(segments, 1, 1)
    );
  });

  it("covers remaining reducer branches for dock and playback jump actions", () => {
    const dataset = createFixtureDataset();
    const { stops, legs } = createResolvedFixtureItinerary();

    let state = appReducer(
      {
        ...initialAppState,
        loadState: { status: "ready", dataset },
        itinerary: { ...initialAppState.itinerary, stops, legs },
      },
      { type: "dock/toggle-collapsed" }
    );
    expect(state.dockCollapsed).toBe(true);

    state = appReducer(state, { type: "playback/jump-to-stop", stopId: "seed-stop-0" });
    expect(state.selection).toEqual({ kind: "stop", stopId: "seed-stop-0" });
    expect(state.playback.tripProgress).toBe(0);

    state = appReducer(state, { type: "playback/jump-to-stop", stopId: "seed-stop-1" });
    expect(state.playback.tripProgress).toBeGreaterThan(0);

    state = appReducer(state, { type: "playback/jump-to-stop", stopId: "missing-stop" });
    expect(state.playback.tripProgress).toBe(0);

    state = appReducer(state, {
      type: "playback/recompute-frame",
    });
    expect(state.playback.activeLegIndex).toBeGreaterThanOrEqual(0);

    state = appReducer(state, {
      type: "playback/jump-to-leg-start",
      legId: "missing-leg",
    });
    expect(state.selection).toEqual({ kind: "leg", legId: "missing-leg" });

    state = appReducer(state, { type: "dock/set-mode", mode: "edit" });
    expect(state.dockMode).toBe("edit");
  });
});
