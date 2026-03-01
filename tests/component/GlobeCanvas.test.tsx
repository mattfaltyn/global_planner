import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobeCanvas } from "../../components/globe/GlobeCanvas";
import {
  getPlaybackSmoothingProfile,
  getPlaybackSmoothingVelocity,
  getVelocityAdjustedPlaybackSmoothingProfile,
  getPlaybackFollowPointOfView,
  interpolatePlaybackPointOfView,
  getStopContextPointOfView,
} from "../../lib/globe/camera";
import { globeColors } from "../../lib/globe/colors";
import { interpolateTravelerPosition } from "../../lib/itinerary/interpolation";
import { createResolvedFixtureItinerary } from "../fixtures/dataset";

let latestGlobeProps: Record<string, unknown> | null = null;
let shouldAttachRef = true;
let resizeCallback:
  | ((entries: Array<{ contentRect: { width: number; height: number } }>) => void)
  | null = null;

const controls = {
  enableDamping: false,
  dampingFactor: 0,
  minDistance: 0,
  maxDistance: 0,
  rotateSpeed: 0,
  zoomSpeed: 0,
};

const renderer = {
  setPixelRatio: vi.fn(),
  capabilities: {
    getMaxAnisotropy: vi.fn(() => 8),
  },
};

const globeApi = {
  getScreenCoords: vi.fn(() => ({ x: 90, y: 120 })),
  controls: vi.fn(() => controls),
  renderer: vi.fn(() => renderer),
  pointOfView: vi.fn((pov?: { lat: number; lng: number; altitude: number }) => {
    if (!pov) {
      return { lat: 0, lng: 0, altitude: 2 };
    }

    return globeApi;
  }),
  globeMaterial: vi.fn(() => ({
    map: {
      anisotropy: 0,
      minFilter: 0,
      magFilter: 0,
      needsUpdate: false,
      colorSpace: "",
    },
    bumpMap: {
      anisotropy: 0,
      minFilter: 0,
      magFilter: 0,
      needsUpdate: false,
    },
    shininess: 0,
    bumpScale: 0,
    specular: null,
    needsUpdate: false,
  })),
};

vi.mock("react-globe.gl", async () => {
  const ReactModule = await import("react");

  const MockGlobe = ReactModule.forwardRef((props: Record<string, unknown>, ref) => {
    latestGlobeProps = props;
    ReactModule.useImperativeHandle(ref, () =>
      shouldAttachRef ? globeApi : undefined
    );

    ReactModule.useEffect(() => {
      (props.onGlobeReady as (() => void) | undefined)?.();
    }, [props]);

    return <div data-testid="mock-globe" />;
  });

  return {
    default: MockGlobe,
  };
});

function createPlayback(overrides?: Partial<{
  status: "idle" | "playing" | "paused";
  speed: 0.5 | 1 | 2 | 4;
  tripProgress: number;
  activeLegIndex: number;
  activeLegProgress: number;
  phase: "travel" | "dwell";
}>) {
  return {
    status: "idle" as const,
    speed: 1 as const,
    tripProgress: 0,
    activeLegIndex: 0,
    activeLegProgress: 0,
    phase: "travel" as const,
    ...overrides,
  };
}

describe("GlobeCanvas", () => {
  beforeEach(() => {
    latestGlobeProps = null;
    shouldAttachRef = true;
    globeApi.getScreenCoords.mockReset();
    globeApi.getScreenCoords.mockReturnValue({ x: 90, y: 120 });
    globeApi.controls.mockClear();
    globeApi.renderer.mockClear();
    renderer.setPixelRatio.mockClear();
    renderer.capabilities.getMaxAnisotropy.mockClear();
    globeApi.pointOfView.mockReset();
    globeApi.pointOfView.mockImplementation((pov?: { lat: number; lng: number; altitude: number }) => {
      if (!pov) {
        return { lat: 0, lng: 0, altitude: 2 };
      }

      return globeApi;
    });
    globeApi.globeMaterial.mockClear();
    resizeCallback = null;

    window.ResizeObserver = class {
      constructor(callback: typeof resizeCallback) {
        resizeCallback = callback;
      }

      observe() {}
      disconnect() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver;
  });

  it("renders itinerary-only path data, configures controls, and focuses a selected stop", async () => {
    const { stops, legs } = createResolvedFixtureItinerary();

    render(
      <GlobeCanvas
        stops={stops}
        legs={legs}
        selection={{ kind: "stop", stopId: stops[0].id }}
        playback={createPlayback()}
        enableHover
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={vi.fn()}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    expect(screen.getByTestId("mock-globe")).toBeInTheDocument();

    await act(async () => {
      resizeCallback?.([{ contentRect: { width: 700, height: 500 } }]);
    });

    expect(globeApi.controls).toHaveBeenCalled();
    expect(globeApi.renderer).toHaveBeenCalled();
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(
      Math.min(window.devicePixelRatio || 1, 2)
    );
    expect(controls.enableDamping).toBe(true);
    expect(controls.maxDistance).toBe(300);
    expect(globeApi.pointOfView).toHaveBeenCalledWith(
      getStopContextPointOfView(stops[0], [null, stops[1]]),
      850
    );
    expect(latestGlobeProps?.width).toBe(700);
    expect(latestGlobeProps?.height).toBe(500);
    expect(latestGlobeProps?.globeImageUrl).toBe("/textures/earth-day.jpg");
    expect(Array.isArray(latestGlobeProps?.polygonsData)).toBe(true);
    expect((latestGlobeProps?.polygonsData as object[]).length).toBeGreaterThan(150);
    expect(latestGlobeProps?.labelsData).toBeUndefined();
    expect((latestGlobeProps?.pointsData as object[])).toHaveLength(stops.length);
    expect((latestGlobeProps?.pathsData as object[])).toHaveLength(legs.length);
    expect(latestGlobeProps?.arcsData).toBeUndefined();
    expect(latestGlobeProps?.rendererConfig).toEqual({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    expect((latestGlobeProps?.pointColor as (obj: object) => string)((latestGlobeProps?.pointsData as object[])[0])).toBe(
      globeColors.stopSelected
    );
    expect((latestGlobeProps?.pointAltitude as (obj: object) => number)((latestGlobeProps?.pointsData as object[])[0])).toBe(
      0
    );
    expect((latestGlobeProps?.pointRadius as (obj: object) => number)((latestGlobeProps?.pointsData as object[])[0])).toBe(
      0.16
    );
  });

  it("tracks the active playback leg and derives active, future, and selected path styling", () => {
    const { stops, legs } = createResolvedFixtureItinerary();

    const { rerender } = render(
      <GlobeCanvas
        stops={stops}
        legs={legs}
        selection={null}
        playback={createPlayback({
          status: "playing",
          tripProgress: 0.2,
          activeLegIndex: 1,
          activeLegProgress: 0.25,
        })}
        enableHover
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={vi.fn()}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    const expectedPlaybackTarget = getPlaybackFollowPointOfView(
      interpolateTravelerPosition(legs[1], 0.25) ?? {
        lat: 0,
        lon: 0,
        altitude: 0,
      },
      stops[2],
      "ground",
      legs[1].distanceKm,
      "travel",
      0.25
    );
    const expectedSmoothedPlaybackView = interpolatePlaybackPointOfView(
      { lat: 0, lng: 0, altitude: 2 },
      expectedPlaybackTarget,
      getVelocityAdjustedPlaybackSmoothingProfile(
        getPlaybackSmoothingProfile("ground", "travel"),
        getPlaybackSmoothingVelocity(
          { lat: 0, lng: 0, altitude: 2 },
          expectedPlaybackTarget
        ),
        "ground"
      )
    );

    expect(globeApi.pointOfView.mock.calls.at(-1)).toEqual([
      expectedSmoothedPlaybackView,
      0,
    ]);
    expect((latestGlobeProps?.pathsData as object[])).toHaveLength(7);
    expect((latestGlobeProps?.pathColor as (obj: object) => string)((latestGlobeProps?.pathsData as object[])[1])).toBe(
      globeColors.groundLegActive
    );
    expect((latestGlobeProps?.pathStroke as (obj: object) => number)((latestGlobeProps?.pathsData as object[])[1])).toBe(
      0.48
    );
    expect((latestGlobeProps?.pathColor as (obj: object) => string)((latestGlobeProps?.pathsData as object[])[4])).toBe(
      globeColors.airLeg
    );
    expect((latestGlobeProps?.pathColor as (obj: object) => string)((latestGlobeProps?.pathsData as object[]).at(-1) as object)).toBe(
      globeColors.travelerTrail
    );
    expect((latestGlobeProps?.pathStroke as (obj: object) => number)((latestGlobeProps?.pathsData as object[]).at(-1) as object)).toBe(
      0.42
    );
    const playingPoints = latestGlobeProps?.pointsData as Array<Record<string, unknown>>;
    const playingTravelerGlow = playingPoints.find((point) => point.kind === "traveler-glow");
    const playingTravelerHalo = playingPoints.find((point) => point.kind === "traveler-halo");
    const playingGlowRadius = (latestGlobeProps?.pointRadius as (obj: object) => number)(
      playingTravelerGlow as object
    );
    const playingHaloRadius = (latestGlobeProps?.pointRadius as (obj: object) => number)(
      playingTravelerHalo as object
    );
    expect(playingGlowRadius).toBeGreaterThan(0.56);
    expect(playingHaloRadius).toBeGreaterThan(0.38);
    expect((latestGlobeProps?.pointColor as (obj: object) => string)(playingTravelerGlow as object)).not.toBe(
      globeColors.travelerGlow
    );
    expect(playingPoints.filter((point) => point.kind === "stop")).toHaveLength(4);

    rerender(
      <GlobeCanvas
        stops={stops}
        legs={legs}
        selection={{ kind: "leg", legId: legs[4].id }}
        playback={createPlayback({
          status: "playing",
          tripProgress: 0.6,
          activeLegIndex: 1,
          activeLegProgress: 1,
          phase: "dwell",
        })}
        enableHover
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={vi.fn()}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    expect((latestGlobeProps?.pathColor as (obj: object) => string)((latestGlobeProps?.pathsData as object[])[0])).toBe(
      globeColors.airLegContext
    );
    expect((latestGlobeProps?.pathColor as (obj: object) => string)((latestGlobeProps?.pathsData as object[])[4])).toBe(
      globeColors.airLegSelected
    );
    expect((latestGlobeProps?.pathStroke as (obj: object) => number)((latestGlobeProps?.pathsData as object[])[4])).toBe(
      0.54
    );
    const dwellPoints = latestGlobeProps?.pointsData as Array<Record<string, unknown>>;
    const dwellTravelerGlow = dwellPoints.find((point) => point.kind === "traveler-glow");
    const dwellTravelerHalo = dwellPoints.find((point) => point.kind === "traveler-halo");
    expect((latestGlobeProps?.pointRadius as (obj: object) => number)(dwellTravelerGlow as object)).toBeLessThan(
      playingGlowRadius
    );
    expect((latestGlobeProps?.pointRadius as (obj: object) => number)(dwellTravelerGlow as object)).toBeGreaterThan(
      0.56
    );
    expect((latestGlobeProps?.pointRadius as (obj: object) => number)(dwellTravelerHalo as object)).toBeLessThan(
      playingHaloRadius
    );
    expect((latestGlobeProps?.pointRadius as (obj: object) => number)(dwellTravelerHalo as object)).toBeGreaterThan(
      0.38
    );
  });

  it("renders the traveler marker and distinguishes active and visited stops", () => {
    const { stops, legs } = createResolvedFixtureItinerary();

    render(
      <GlobeCanvas
        stops={stops}
        legs={legs}
        selection={null}
        playback={createPlayback({
          status: "paused",
          tripProgress: 0.3,
          activeLegIndex: 1,
          activeLegProgress: 0.5,
        })}
        enableHover
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={vi.fn()}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    const points = latestGlobeProps?.pointsData as Array<Record<string, unknown>>;
    const pointColor = latestGlobeProps?.pointColor as (obj: object) => string;
    const pointRadius = latestGlobeProps?.pointRadius as (obj: object) => number;
    const pointAltitude = latestGlobeProps?.pointAltitude as (obj: object) => number;

    expect(points).toHaveLength(stops.length + 3);
    const travelerGlow = points.find((point) => point.kind === "traveler-glow");
    const travelerHalo = points.find((point) => point.kind === "traveler-halo");
    const traveler = points.find((point) => point.kind === "traveler");

    expect(travelerGlow?.kind).toBe("traveler-glow");
    expect(travelerHalo?.kind).toBe("traveler-halo");
    expect(traveler?.kind).toBe("traveler");
    expect(pointAltitude(traveler as object)).toBeGreaterThan(0);
    expect(pointColor(travelerGlow as object)).toBe(globeColors.travelerGlow);
    expect(pointColor(travelerHalo as object)).toBe(globeColors.travelerHalo);
    expect(pointColor(traveler as object)).toBe(globeColors.traveler);
    expect(pointColor(points[0])).toBe(globeColors.stopVisited);
    expect(pointColor(points[1])).toBe(globeColors.stopActive);
    expect(pointColor(points[2])).toBe(globeColors.stopActive);
    expect(pointRadius(travelerGlow as object)).toBe(0.56);
    expect(pointRadius(travelerHalo as object)).toBe(0.38);
    expect(pointRadius(traveler as object)).toBe(0.2);
  });

  it("handles hover, click, disabled hover, and missing refs safely", () => {
    const { stops, legs } = createResolvedFixtureItinerary();
    const onHoverStop = vi.fn();
    const onHoverLeg = vi.fn();
    const onClearHover = vi.fn();
    const onSelectStop = vi.fn();
    const onSelectLeg = vi.fn();
    const onClearSelection = vi.fn();

    const { rerender } = render(
      <GlobeCanvas
        stops={stops}
        legs={legs}
        selection={null}
        playback={createPlayback()}
        enableHover
        onHoverStop={onHoverStop}
        onHoverLeg={onHoverLeg}
        onClearHover={onClearHover}
        onSelectStop={onSelectStop}
        onSelectLeg={onSelectLeg}
        onClearSelection={onClearSelection}
      />
    );

    const firstPoint = (latestGlobeProps?.pointsData as object[])[0];
    const firstPath = (latestGlobeProps?.pathsData as object[])[0];
    const traveler = {
      kind: "traveler",
      lat: 0,
      lon: 0,
      altitude: 0.01,
    };
    const travelerGlow = {
      kind: "traveler-glow",
      lat: 0,
      lon: 0,
      altitude: 0.01,
    };
    const travelerHalo = {
      kind: "traveler-halo",
      lat: 0,
      lon: 0,
      altitude: 0.01,
    };
    const travelerTrail = {
      kind: "traveler-trail",
      pathPoints: [
        { lat: 0, lon: 0, altitude: 0.01 },
        { lat: 1, lon: 1, altitude: 0.01 },
      ],
    };

    (latestGlobeProps?.onPointHover as (obj: object | null) => void)(firstPoint);
    (latestGlobeProps?.onPathHover as (obj: object | null) => void)(firstPath);
    (latestGlobeProps?.onPointHover as (obj: object | null) => void)(travelerGlow);
    (latestGlobeProps?.onPointHover as (obj: object | null) => void)(traveler);
    (latestGlobeProps?.onPointHover as (obj: object | null) => void)(travelerHalo);
    (latestGlobeProps?.onPathHover as (obj: object | null) => void)(travelerTrail);
    (latestGlobeProps?.onPathHover as (obj: object | null) => void)(null);
    (latestGlobeProps?.onPointClick as (obj: object | null) => void)(firstPoint);
    (latestGlobeProps?.onPathClick as (obj: object | null) => void)(firstPath);
    (latestGlobeProps?.onPathClick as (obj: object | null) => void)(travelerTrail);
    (latestGlobeProps?.onGlobeClick as () => void)();

    expect(onHoverStop).toHaveBeenCalledWith("seed-stop-0", 90, 120);
    expect(onHoverLeg).toHaveBeenCalledWith("seed-stop-0__seed-stop-1", 90, 120);
    expect(onClearHover).toHaveBeenCalled();
    expect(onSelectStop).toHaveBeenCalledWith("seed-stop-0");
    expect(onSelectLeg).toHaveBeenCalledWith("seed-stop-0__seed-stop-1");
    expect(onClearSelection).toHaveBeenCalled();

    shouldAttachRef = false;
    rerender(
      <GlobeCanvas
        stops={stops}
        legs={legs}
        selection={null}
        playback={createPlayback()}
        enableHover={false}
        onHoverStop={onHoverStop}
        onHoverLeg={onHoverLeg}
        onClearHover={onClearHover}
        onSelectStop={onSelectStop}
        onSelectLeg={onSelectLeg}
        onClearSelection={onClearSelection}
      />
    );

    (latestGlobeProps?.onPointHover as (obj: object | null) => void)(firstPoint);
    (latestGlobeProps?.onPathHover as (obj: object | null) => void)(firstPath);
    expect(onHoverStop).toHaveBeenCalledTimes(1);
    expect(onHoverLeg).toHaveBeenCalledTimes(1);
  });

  it("suspends auto-follow on manual interaction and clears it on recenter", () => {
    const { stops, legs } = createResolvedFixtureItinerary();
    const onAutoFollowSuspendedChange = vi.fn();
    const { rerender } = render(
      <GlobeCanvas
        stops={stops}
        legs={legs}
        selection={null}
        playback={createPlayback({
          status: "playing",
          tripProgress: 0.2,
          activeLegIndex: 1,
          activeLegProgress: 0.25,
        })}
        enableHover
        forceRecenterToken={0}
        onAutoFollowSuspendedChange={onAutoFollowSuspendedChange}
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={vi.fn()}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    fireEvent.pointerDown(screen.getByTestId("globe-canvas"));
    expect(onAutoFollowSuspendedChange).toHaveBeenCalledWith(true);

    rerender(
      <GlobeCanvas
        stops={stops}
        legs={legs}
        selection={null}
        playback={createPlayback({
          status: "playing",
          tripProgress: 0.2,
          activeLegIndex: 1,
          activeLegProgress: 0.25,
        })}
        enableHover
        forceRecenterToken={1}
        onAutoFollowSuspendedChange={onAutoFollowSuspendedChange}
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={vi.fn()}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    expect(onAutoFollowSuspendedChange).toHaveBeenCalledWith(false);
  });
});
