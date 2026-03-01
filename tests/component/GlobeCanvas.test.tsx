import React from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobeCanvas } from "../../components/globe/GlobeCanvas";
import { getLegPointOfView } from "../../lib/globe/camera";
import { globeColors } from "../../lib/globe/colors";
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

  it("renders itinerary-only props, configures controls, and focuses a selected stop", async () => {
    const { stops, legs } = createResolvedFixtureItinerary();

    render(
      <GlobeCanvas
        stops={stops}
        legs={legs}
        selection={{ kind: "stop", stopId: stops[0].id }}
        playback={{ status: "idle", activeLegIndex: 0, progress: 0 }}
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
    expect(controls.maxDistance).toBe(360);
    expect(globeApi.pointOfView).toHaveBeenCalledWith(
      getLegPointOfView(legs[0].pathPoints[0], legs[0].pathPoints.at(-1)!),
      0
    );
    expect(globeApi.pointOfView).toHaveBeenCalledWith(
      { lat: 49.1947, lng: -123.1792, altitude: 1.6 },
      900
    );
    expect(latestGlobeProps?.width).toBe(700);
    expect(latestGlobeProps?.height).toBe(500);
    expect(latestGlobeProps?.globeImageUrl).toBe("/textures/earth-day.jpg");
    expect(Array.isArray(latestGlobeProps?.polygonsData)).toBe(true);
    expect((latestGlobeProps?.polygonsData as object[]).length).toBeGreaterThan(150);
    expect((latestGlobeProps?.pointsData as object[])).toHaveLength(stops.length);
    expect((latestGlobeProps?.arcsData as object[])).toHaveLength(2);
    expect((latestGlobeProps?.pathsData as object[])).toHaveLength(6);
    expect(latestGlobeProps?.rendererConfig).toEqual({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    expect(latestGlobeProps).not.toHaveProperty("routes");
    expect((latestGlobeProps?.pointColor as (obj: object) => string)((latestGlobeProps?.pointsData as object[])[0])).toBe(
      globeColors.stopSelected
    );
    expect((latestGlobeProps?.pointAltitude as (obj: object) => number)((latestGlobeProps?.pointsData as object[])[0])).toBe(
      0.02
    );
    expect((latestGlobeProps?.pointRadius as (obj: object) => number)((latestGlobeProps?.pointsData as object[])[0])).toBe(
      0.17
    );
    expect((latestGlobeProps?.pointRadius as (obj: object) => number)((latestGlobeProps?.pointsData as object[])[2])).toBe(
      0.11
    );
    expect((latestGlobeProps?.polygonCapColor as () => string)()).toBe("rgba(0, 0, 0, 0)");
    expect((latestGlobeProps?.polygonSideColor as () => string)()).toBe("rgba(0, 0, 0, 0)");
    expect((latestGlobeProps?.polygonStrokeColor as () => string)()).toBe(
      "rgba(221, 243, 255, 0.36)"
    );
    expect((latestGlobeProps?.arcStartLat as (obj: object) => number)(legs[0])).toBeCloseTo(49.1947);
    expect((latestGlobeProps?.arcStartLng as (obj: object) => number)(legs[0])).toBeCloseTo(-123.1792);
    expect((latestGlobeProps?.arcEndLat as (obj: object) => number)(legs[0])).toBeCloseTo(41.2481);
    expect((latestGlobeProps?.arcEndLng as (obj: object) => number)(legs[0])).toBeCloseTo(-8.6814);
  });

  it("covers focus reuse, playback leg focus, and style fallbacks", () => {
    const { stops, legs } = createResolvedFixtureItinerary();
    const onClearHover = vi.fn();

    globeApi.pointOfView.mockReset();
    globeApi.pointOfView.mockImplementation((pov?: { lat: number; lng: number; altitude: number }) => {
      if (!pov) {
        return { lat: 49.2, lng: -123.1, altitude: 2 };
      }

      return globeApi;
    });

    const { rerender } = render(
      <GlobeCanvas
        stops={stops}
        legs={legs}
        selection={{ kind: "stop", stopId: stops[0].id }}
        playback={{ status: "idle", activeLegIndex: 0, progress: 0 }}
        enableHover
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={onClearHover}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    expect(globeApi.pointOfView).toHaveBeenCalledWith(
      { lat: 49.1947, lng: -123.1792, altitude: 1.6 },
      450
    );

    const initialFocusCallCount = globeApi.pointOfView.mock.calls.length;

    rerender(
      <GlobeCanvas
        stops={stops}
        legs={legs}
        selection={{ kind: "stop", stopId: stops[0].id }}
        playback={{ status: "idle", activeLegIndex: 0, progress: 0 }}
        enableHover
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={onClearHover}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    expect(globeApi.pointOfView).toHaveBeenCalledTimes(initialFocusCallCount + 1);
    expect(globeApi.pointOfView.mock.calls.at(-1)).toEqual([]);

    rerender(
      <GlobeCanvas
        stops={stops.map((stop) =>
          stop.id === stops[0].id ? { ...stop, lat: null, lon: null } : stop
        )}
        legs={legs}
        selection={{ kind: "stop", stopId: stops[0].id }}
        playback={{ status: "idle", activeLegIndex: 0, progress: 0 }}
        enableHover
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={onClearHover}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    expect(globeApi.pointOfView).toHaveBeenCalledTimes(initialFocusCallCount + 1);

    rerender(
      <GlobeCanvas
        stops={stops}
        legs={legs}
        selection={{ kind: "stop", stopId: "missing-stop" }}
        playback={{ status: "idle", activeLegIndex: 0, progress: 0 }}
        enableHover
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={onClearHover}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    expect(globeApi.pointOfView).toHaveBeenCalledTimes(initialFocusCallCount + 1);

    rerender(
      <GlobeCanvas
        stops={stops}
        legs={legs}
        selection={null}
        playback={{ status: "playing", activeLegIndex: 0, progress: 0.2 }}
        enableHover
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={onClearHover}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    const playbackMidpoint = legs[0].pathPoints[Math.floor(legs[0].pathPoints.length / 2)];
    expect(globeApi.pointOfView).toHaveBeenCalledWith(
      { lat: playbackMidpoint.lat, lng: playbackMidpoint.lon, altitude: 1.9 },
      900
    );

    const playbackFocusCallCount = globeApi.pointOfView.mock.calls.length;
    const clonedLegs = legs.map((leg) => ({
      ...leg,
      pathPoints: leg.pathPoints.map((point) => ({ ...point })),
    }));

    rerender(
      <GlobeCanvas
        stops={stops}
        legs={clonedLegs}
        selection={{ kind: "leg", legId: clonedLegs[0].id }}
        playback={{ status: "idle", activeLegIndex: 0, progress: 0 }}
        enableHover
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={onClearHover}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    expect(globeApi.pointOfView).toHaveBeenCalledTimes(playbackFocusCallCount);

    rerender(
      <GlobeCanvas
        stops={stops}
        legs={clonedLegs}
        selection={{ kind: "leg", legId: "missing-leg" }}
        playback={{ status: "idle", activeLegIndex: 0, progress: 0 }}
        enableHover
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={onClearHover}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    expect(globeApi.pointOfView).toHaveBeenCalledTimes(playbackFocusCallCount);

    rerender(
      <GlobeCanvas
        stops={stops}
        legs={[{ ...legs[0], pathPoints: [] }]}
        selection={{ kind: "leg", legId: legs[0].id }}
        playback={{ status: "idle", activeLegIndex: 0, progress: 0 }}
        enableHover
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={onClearHover}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    expect(globeApi.pointOfView).toHaveBeenCalledTimes(playbackFocusCallCount);

    rerender(
      <GlobeCanvas
        stops={stops}
        legs={legs}
        selection={null}
        playback={{ status: "paused", activeLegIndex: 1, progress: 0.5 }}
        enableHover
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={onClearHover}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    const props = latestGlobeProps as Record<string, (arg?: object | null) => unknown>;
    const points = latestGlobeProps?.pointsData as object[];
    expect((props.pointColor as (arg: object) => string)(points[0])).toBe(globeColors.stopVisited);
    expect((props.pointColor as (arg: object) => string)(points[2])).toBe(globeColors.stopActive);
    expect((props.pointColor as (arg: object) => string)(points[5])).toBe(globeColors.stop);
    expect((props.pointAltitude as (arg: object) => number)(points[0])).toBe(0.008);
    expect((props.pointAltitude as (arg: object) => number)(points[5])).toBe(0.011);
    expect((props.pointRadius as (arg: object) => number)(points[0])).toBe(0.09);
    expect((props.pointRadius as (arg: object) => number)(points[5])).toBe(0.11);
    expect((props.arcColor as (arg: object) => string)(legs[0])).toBe(globeColors.airLeg);
    expect((props.arcStroke as (arg: object) => number)(legs[0])).toBe(0.5);
    expect((props.pathStroke as (arg: object) => number)(legs[1])).toBe(0.7);
    expect((props.arcStartLat as (arg: object) => number)({ ...legs[0], pathPoints: [] })).toBe(0);
    expect((props.arcStartLng as (arg: object) => number)({ ...legs[0], pathPoints: [] })).toBe(0);
    expect((props.arcEndLat as (arg: object) => number)({ ...legs[0], pathPoints: [] })).toBe(0);
    expect((props.arcEndLng as (arg: object) => number)({ ...legs[0], pathPoints: [] })).toBe(0);
    props.onArcHover?.({
      id: "broken",
      pathPoints: [undefined] as unknown as typeof legs[0].pathPoints,
    });
    props.onPathHover?.(null);
    expect(onClearHover).toHaveBeenCalledTimes(2);

    rerender(
      <GlobeCanvas
        stops={stops}
        legs={legs}
        selection={null}
        playback={{ status: "paused", activeLegIndex: 99, progress: 0.5 }}
        enableHover
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={vi.fn()}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    expect((latestGlobeProps?.pointsData as object[])).toHaveLength(stops.length);
  });

  it("renders the traveler marker and distinguishes air and ground legs", () => {
    const { stops, legs } = createResolvedFixtureItinerary();
    const selectedAirLeg = legs[4];
    const selectedGroundLeg = legs[1];

    const { rerender } = render(
      <GlobeCanvas
        stops={stops}
        legs={legs}
        selection={{ kind: "leg", legId: selectedAirLeg.id }}
        playback={{ status: "paused", activeLegIndex: 4, progress: 0.5 }}
        enableHover
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={vi.fn()}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    const pointDataWithTraveler = latestGlobeProps?.pointsData as Array<{
      kind: string;
      altitude?: number;
    }>;
    expect(pointDataWithTraveler).toHaveLength(stops.length + 1);
    expect(pointDataWithTraveler.at(-1)?.kind).toBe("traveler");
    expect((latestGlobeProps?.pointColor as (obj: object) => string)(pointDataWithTraveler.at(-1) as object)).toBe(
      globeColors.traveler
    );
    expect((latestGlobeProps?.pointAltitude as (obj: object) => number)(pointDataWithTraveler.at(-1) as object)).toBeGreaterThan(0.04);
    expect((latestGlobeProps?.pointRadius as (obj: object) => number)(pointDataWithTraveler.at(-1) as object)).toBe(
      0.16
    );
    expect((latestGlobeProps?.arcAltitude as (obj: object) => number)(selectedAirLeg)).toBeGreaterThan(0.08);
    expect((latestGlobeProps?.arcStroke as (obj: object) => number)(selectedAirLeg)).toBe(1.1);
    expect((latestGlobeProps?.arcColor as (obj: object) => string)(selectedAirLeg)).toBe(
      globeColors.airLegSelected
    );
    expect((latestGlobeProps?.pathColor as (obj: object) => string)(selectedGroundLeg)).toBe(
      globeColors.groundLeg
    );

    rerender(
      <GlobeCanvas
        stops={stops}
        legs={legs}
        selection={{ kind: "leg", legId: selectedGroundLeg.id }}
        playback={{ status: "paused", activeLegIndex: 1, progress: 0.25 }}
        enableHover
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={vi.fn()}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    expect((latestGlobeProps?.pathColor as (obj: object) => string)(selectedGroundLeg)).toBe(
      globeColors.groundLegSelected
    );
    expect((latestGlobeProps?.pathStroke as (obj: object) => number)(selectedGroundLeg)).toBe(1.2);
    expect((latestGlobeProps?.pointAltitude as (obj: object) => number)((latestGlobeProps?.pointsData as object[])[2])).toBe(
      0.016
    );
    expect((latestGlobeProps?.pointRadius as (obj: object) => number)((latestGlobeProps?.pointsData as object[])[2])).toBe(
      0.15
    );
  });

  it("handles hover, click, disabled hover, and missing refs safely", () => {
    const { stops, legs } = createResolvedFixtureItinerary();
    const onHoverStop = vi.fn();
    const onHoverLeg = vi.fn();
    const onClearHover = vi.fn();
    const onSelectStop = vi.fn();
    const onSelectLeg = vi.fn();
    const onClearSelection = vi.fn();

    render(
      <GlobeCanvas
        stops={stops}
        legs={legs}
        selection={null}
        playback={{ status: "idle", activeLegIndex: 0, progress: 0 }}
        enableHover
        onHoverStop={onHoverStop}
        onHoverLeg={onHoverLeg}
        onClearHover={onClearHover}
        onSelectStop={onSelectStop}
        onSelectLeg={onSelectLeg}
        onClearSelection={onClearSelection}
      />
    );

    act(() => {
      resizeCallback?.([]);
    });

    const props = latestGlobeProps as Record<string, (arg?: object | null) => void>;
    globeApi.getScreenCoords.mockReturnValueOnce(null).mockReturnValueOnce(null);
    props.onPointHover?.((latestGlobeProps?.pointsData as object[])[0]);
    props.onArcHover?.(legs[0]);
    props.onPathHover?.(legs[1]);
    props.onPointHover?.({ kind: "traveler", lat: 0, lon: 0, altitude: 0.1 });
    props.onPointHover?.(null);
    props.onArcHover?.(null);
    props.onPathHover?.({ id: "broken", pathPoints: [] });
    props.onPointClick?.((latestGlobeProps?.pointsData as object[])[0]);
    props.onPointClick?.({ kind: "traveler", lat: 0, lon: 0, altitude: 0.1 });
    props.onArcClick?.(legs[0]);
    props.onPathClick?.(legs[1]);
    props.onGlobeClick?.();

    expect(onHoverStop).toHaveBeenCalledWith("seed-stop-0", 0, 0);
    expect(onHoverLeg).toHaveBeenNthCalledWith(1, legs[0].id, 0, 0);
    expect(onHoverLeg).toHaveBeenNthCalledWith(2, legs[1].id, 90, 120);
    expect(onClearHover).toHaveBeenCalledTimes(5);
    expect(onSelectStop).toHaveBeenCalledWith("seed-stop-0");
    expect(onSelectLeg).toHaveBeenNthCalledWith(1, legs[0].id);
    expect(onSelectLeg).toHaveBeenNthCalledWith(2, legs[1].id);
    expect(onClearSelection).toHaveBeenCalledTimes(1);

    const propsWithDefaults = latestGlobeProps as Record<string, (arg?: object | null) => unknown>;
    expect(
      (propsWithDefaults.arcAltitude as (arg: object) => number)({
        ...legs[0],
        pathPoints: [],
      })
    ).toBe(0.08);
    expect(
      (propsWithDefaults.arcStartLng as (arg: object) => number)({
        ...legs[0],
        pathPoints: [],
      })
    ).toBe(0);
    expect(
      (propsWithDefaults.arcEndLat as (arg: object) => number)({
        ...legs[0],
        pathPoints: [],
      })
    ).toBe(0);
    expect((propsWithDefaults.pathPoints as (arg: object) => unknown[])(legs[1])).toHaveLength(
      legs[1].pathPoints.length
    );

    shouldAttachRef = false;
    render(
      <GlobeCanvas
        stops={stops}
        legs={legs}
        selection={{ kind: "leg", legId: legs[0].id }}
        playback={{ status: "playing", activeLegIndex: 0, progress: 0.1 }}
        enableHover={false}
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={vi.fn()}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    const disabledProps = latestGlobeProps as Record<string, (arg?: object | null) => void>;
    expect(() => disabledProps.onPointHover?.((latestGlobeProps?.pointsData as object[])[0])).not.toThrow();
    expect(() => disabledProps.onArcHover?.(legs[0])).not.toThrow();
    expect(() => disabledProps.onPathHover?.(legs[1])).not.toThrow();

    render(
      <GlobeCanvas
        stops={stops.map((stop) => ({ ...stop }))}
        legs={legs}
        selection={{ kind: "stop", stopId: stops[0].id }}
        playback={{ status: "idle", activeLegIndex: 0, progress: 0 }}
        enableHover
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={vi.fn()}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    render(
      <GlobeCanvas
        stops={[{ ...stops[0], lat: null, lon: null }]}
        legs={[{ ...legs[0], pathPoints: [] }]}
        selection={{ kind: "stop", stopId: stops[0].id }}
        playback={{ status: "paused", activeLegIndex: 0, progress: 0.5 }}
        enableHover
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={vi.fn()}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    render(
      <GlobeCanvas
        stops={stops}
        legs={[{ ...legs[0], pathPoints: [] }]}
        selection={{ kind: "leg", legId: legs[0].id }}
        playback={{ status: "idle", activeLegIndex: 0, progress: 0 }}
        enableHover
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={vi.fn()}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );

    render(
      <GlobeCanvas
        stops={stops}
        legs={legs}
        selection={{ kind: "leg", legId: "missing" }}
        playback={{ status: "idle", activeLegIndex: 0, progress: 0 }}
        enableHover
        onHoverStop={vi.fn()}
        onHoverLeg={vi.fn()}
        onClearHover={vi.fn()}
        onSelectStop={vi.fn()}
        onSelectLeg={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );
  });
});
